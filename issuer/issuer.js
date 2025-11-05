/**
 * Credential Issuer - Multi-Profile System
 *
 * Generates and signs verifiable credentials compatible with the Identity Wallet
 * Supports multiple issuer profiles with verification domains
 */

import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex } from '@noble/hashes/utils';
import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { EdDSASigner } from 'did-jwt';

// Issuer profiles and their keys
let issuerProfiles = [];
let currentIssuer = null;
let issuerKeys = {}; // Map of issuer ID to {privateKey, publicKey, did, signer}

/**
 * Initialize issuer system
 */
async function initializeIssuer() {
  try {
    // Load issuer profiles
    const response = await fetch('./issuers.json');
    const data = await response.json();
    issuerProfiles = data.issuers;

    // Generate keys for each issuer profile
    for (const profile of issuerProfiles) {
      const privateKey = ed25519.utils.randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const did = createDidKey(publicKey);

      // EdDSASigner expects hex string, not Uint8Array
      const privateKeyHex = bytesToHex(privateKey);
      const signer = EdDSASigner(privateKeyHex);

      issuerKeys[profile.id] = {
        privateKey,
        publicKey,
        did,
        signer
      };

      console.log(`🔑 Generated keys for ${profile.name}: ${did}`);
    }

    // Populate issuer selector
    populateIssuerSelector();

    // Select first issuer by default
    if (issuerProfiles.length > 0) {
      selectIssuer(issuerProfiles[0].id);
    }

  } catch (error) {
    console.error('Failed to initialize issuer:', error);
    alert('Failed to load issuer profiles. Check console for details.');
  }
}

/**
 * Create did:key from Ed25519 public key
 */
function createDidKey(publicKey) {
  const prefix = new Uint8Array([0xed, 0x01]); // Ed25519 multicodec
  const prefixed = new Uint8Array(prefix.length + publicKey.length);
  prefixed.set(prefix, 0);
  prefixed.set(publicKey, prefix.length);
  return 'did:key:z' + base58Encode(prefixed);
}

/**
 * Base58 encoding (Bitcoin alphabet)
 */
function base58Encode(bytes) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';

  while (num > 0) {
    result = ALPHABET[Number(num % 58n)] + result;
    num = num / 58n;
  }

  // Handle leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = '1' + result;
  }

  return result;
}

/**
 * Populate issuer selector dropdown
 */
function populateIssuerSelector() {
  const selector = document.getElementById('issuerSelector');

  selector.innerHTML = issuerProfiles.map(profile => `
    <option value="${profile.id}">
      ${profile.logo} ${profile.name} (${profile.domain})
    </option>
  `).join('');

  selector.addEventListener('change', (e) => {
    selectIssuer(e.target.value);
  });
}

/**
 * Select an issuer profile
 */
function selectIssuer(issuerId) {
  currentIssuer = issuerProfiles.find(p => p.id === issuerId);
  if (!currentIssuer) return;

  const keys = issuerKeys[issuerId];

  // Update UI
  document.getElementById('issuerName').textContent = currentIssuer.name;
  document.getElementById('issuerDomain').textContent = currentIssuer.domain;
  document.getElementById('issuerDescription').textContent = currentIssuer.description;
  document.getElementById('issuerDid').textContent = keys.did;

  // Populate credential types
  populateCredentialTypes();
}

/**
 * Populate credential type dropdown
 */
function populateCredentialTypes() {
  const selector = document.getElementById('credentialType');

  selector.innerHTML = currentIssuer.credentialTypes.map(ct => `
    <option value="${ct.type}">${ct.name}</option>
  `).join('');

  // Update example claims when type changes
  selector.addEventListener('change', (e) => {
    updateExampleClaims(e.target.value);
  });

  // Load first type's example
  if (currentIssuer.credentialTypes.length > 0) {
    updateExampleClaims(currentIssuer.credentialTypes[0].type);
  }
}

/**
 * Update example claims based on selected credential type
 */
function updateExampleClaims(credentialType) {
  const credType = currentIssuer.credentialTypes.find(ct => ct.type === credentialType);
  if (!credType) return;

  // Show description
  document.getElementById('credentialDescription').textContent = credType.description;

  // Fill in example claims
  document.getElementById('claims').value = JSON.stringify(credType.exampleClaims, null, 2);
}

/**
 * Issue a verifiable credential using did-jwt-vc
 */
async function issueCredential(recipientDid, credentialType, claims, expiresInDays) {
  const keys = issuerKeys[currentIssuer.id];
  const now = Math.floor(Date.now() / 1000);
  const expirationTime = now + (expiresInDays * 24 * 60 * 60);

  // Create verifiable credential payload
  const vcPayload = {
    sub: recipientDid,
    nbf: now,
    exp: expirationTime,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', credentialType],
      credentialSubject: {
        id: recipientDid,
        ...claims
      }
    }
  };

  // Create the JWT using did-jwt-vc (same library as wallet!)
  const vcJwt = await createVerifiableCredentialJwt(
    vcPayload,
    {
      did: keys.did,
      signer: keys.signer,
      domain: currentIssuer.domain // Add verification domain
    }
  );

  return vcJwt;
}

/**
 * Generate QR code on canvas
 */
function generateQRCode(text, canvas) {
  const size = 300;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Draw placeholder
  ctx.fillStyle = '#059669';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QR Code Placeholder', size / 2, size / 2 - 40);
  ctx.font = '12px sans-serif';
  ctx.fillText('Copy JWT instead', size / 2, size / 2);
  ctx.fillText('(QR library not loaded)', size / 2, size / 2 + 20);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializeIssuer();

  const issueBtn = document.getElementById('issueBtn');
  const resultDiv = document.getElementById('result');
  const jwtDisplay = document.getElementById('jwtDisplay');
  const qrCanvas = document.getElementById('qrCanvas');
  const copyBtn = document.getElementById('copyBtn');

  // Issue credential button
  issueBtn.addEventListener('click', async () => {
    // Get form values
    const recipientDid = document.getElementById('recipientDid').value.trim();
    const credentialType = document.getElementById('credentialType').value;
    const claimsText = document.getElementById('claims').value.trim();
    const expiresIn = parseInt(document.getElementById('expiresIn').value);

    // Validate DID
    if (!recipientDid.startsWith('did:')) {
      alert('❌ Invalid DID format. Must start with "did:"');
      return;
    }

    // Validate and parse claims
    let claims;
    try {
      claims = JSON.parse(claimsText);
      if (typeof claims !== 'object' || Array.isArray(claims)) {
        throw new Error('Claims must be a JSON object');
      }
    } catch (e) {
      alert('❌ Invalid JSON in claims field:\n' + e.message);
      return;
    }

    // Validate expiration
    if (expiresIn < 1 || expiresIn > 3650) {
      alert('❌ Expiration must be between 1 and 3650 days');
      return;
    }

    // Disable button during processing
    issueBtn.disabled = true;
    issueBtn.textContent = '⏳ Issuing...';

    try {
      // Issue the credential
      const jwt = await issueCredential(recipientDid, credentialType, claims, expiresIn);

      console.log('✅ Credential issued:', {
        issuer: currentIssuer.name,
        domain: currentIssuer.domain,
        recipientDid,
        credentialType,
        claims,
        expiresIn,
        jwtLength: jwt.length
      });

      // Display JWT
      jwtDisplay.textContent = jwt;

      // Generate QR code
      generateQRCode(jwt, qrCanvas);

      // Show result section
      resultDiv.style.display = 'block';

      // Scroll to result
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Setup copy button
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(jwt);
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy JWT to Clipboard';
          }, 2000);
        } catch (err) {
          alert('Failed to copy to clipboard');
        }
      };

    } catch (error) {
      alert('❌ Error issuing credential:\n' + error.message);
      console.error(error);
    } finally {
      // Re-enable button
      issueBtn.disabled = false;
      issueBtn.textContent = '🎫 Issue Credential';
    }
  });
});
