/**
 * Credential Issuer - Multi-Profile System
 *
 * Generates and signs verifiable credentials compatible with the Identity Wallet
 * Supports multiple issuer profiles with verification domains
 */

import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { encode as cborEncode } from 'cbor2';
import { encode as base45Encode } from 'base45';
import pako from 'pako';

// Text encoder for signing
const enc = new TextEncoder();

/**
 * Convert bytes to base64url (for JWT signatures)
 */
function bytesToBase64url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create Ed25519 signer for did-jwt (compatible with wallet)
 */
function createSigner(privateKey) {
  return async (data) => {
    let dataToSign = data;
    if (typeof data === 'string') {
      dataToSign = enc.encode(data);
    }
    const signature = await ed25519.sign(dataToSign, privateKey);
    return bytesToBase64url(signature);
  };
}

/**
 * Encode JWT as HC1 format for smaller QR codes
 *
 * This wraps the JWT (which includes the signature) in HC1 encoding
 * so it can be transferred with a smaller QR code while preserving
 * the cryptographic signature for verification.
 */
function encodeJWTAsHC1(jwt) {
  try {
    // Create payload indicating this is a JWT transfer
    const payload = {
      type: 'JWT-VC', // JWT Verifiable Credential
      jwt: jwt,
      encodedAt: Math.floor(Date.now() / 1000)
    };

    // Step 1: Encode as CBOR (binary format)
    const cborData = cborEncode(payload);

    // Step 2: Compress with zlib
    const compressed = pako.deflate(cborData);

    // Step 3: Encode with Base45 (QR-optimized)
    const base45Data = base45Encode(compressed);

    // Step 4: Add HC1 prefix
    return `HC1:${base45Data}`;

  } catch (error) {
    console.error('HC1 encoding failed:', error);
    throw new Error(`HC1 encoding failed: ${error.message}`);
  }
}

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

    // Load or generate keys for each issuer profile
    await loadOrGenerateKeys();

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
 * Load keys from issuer-keys.json or generate new ones
 */
async function loadOrGenerateKeys() {
  let storedKeys = {};

  try {
    const response = await fetch('./issuer-keys.json');
    const data = await response.json();
    storedKeys = data.keys || {};
  } catch (e) {
    console.warn('⚠️  No issuer-keys.json found, will generate new keys');
  }

  for (const profile of issuerProfiles) {
    const stored = storedKeys[profile.id];

    if (stored) {
      // Load existing persistent keys from JSON file
      const privateKeyHex = stored.privateKey;
      const privateKey = hexToBytes(privateKeyHex);
      const publicKey = ed25519.getPublicKey(privateKey);
      const did = createDidKey(publicKey);

      // Verify stored DID matches derived DID
      if (did !== stored.did) {
        console.error(`❌ DID mismatch for ${profile.name}!`);
        console.error(`   Stored: ${stored.did}`);
        console.error(`   Derived: ${did}`);
        throw new Error(`DID mismatch for ${profile.id}`);
      }

      const signer = createSigner(privateKey);
      issuerKeys[profile.id] = { privateKey, publicKey, did, signer };
      console.log(`✅ Loaded ${profile.name}: ${did}`);
    } else {
      // Generate new key
      const privateKey = ed25519.utils.randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const did = createDidKey(publicKey);
      const privateKeyHex = bytesToHex(privateKey);
      const signer = createSigner(privateKey);

      issuerKeys[profile.id] = { privateKey, publicKey, did, signer };

      console.warn(`⚠️  Generated NEW key for ${profile.name}`);
      console.warn(`   DID: ${did}`);
      console.warn(`   Add to issuer-keys.json under "keys":`);
      console.warn(JSON.stringify({
        [profile.id]: {
          privateKey: privateKeyHex,
          did: did
        }
      }, null, 2));
    }
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
      },
      // Include issuer information for display purposes
      issuerName: currentIssuer.name,
      issuerDomain: currentIssuer.domain
    }
  };

  // Create the JWT using did-jwt-vc (same library and format as wallet!)
  const vcJwt = await createVerifiableCredentialJwt(
    vcPayload,
    {
      did: keys.did,
      alg: 'EdDSA',
      signer: keys.signer
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

      // Encode JWT as HC1 for smaller QR code
      const hc1 = encodeJWTAsHC1(jwt);

      console.log('✅ Credential issued:', {
        issuer: currentIssuer.name,
        domain: currentIssuer.domain,
        recipientDid,
        credentialType,
        claims,
        expiresIn,
        jwtLength: jwt.length,
        hc1Length: hc1.length,
        sizeReduction: `${(((jwt.length - hc1.length) / jwt.length) * 100).toFixed(1)}%`
      });

      // Display HC1 (compact format for scanning)
      jwtDisplay.textContent = hc1;

      // Generate QR code with HC1 (smaller, more scannable)
      generateQRCode(hc1, qrCanvas);

      // Show result section
      resultDiv.style.display = 'block';

      // Scroll to result
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Setup copy button
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(hc1);
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy HC1 to Clipboard';
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
