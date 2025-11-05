/**
 * Credential Issuer
 *
 * Generates and signs verifiable credentials compatible with the Identity Wallet
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// Issuer's key pair (in production, load from secure storage/environment)
let issuerPrivateKey;
let issuerPublicKey;
let issuerDid;

/**
 * Initialize issuer identity
 * In production: Load private key from secure environment
 */
function initializeIssuer() {
  // Generate new keys (for demo - in production, load from secure storage)
  issuerPrivateKey = ed25519.utils.randomPrivateKey();
  issuerPublicKey = ed25519.getPublicKey(issuerPrivateKey);
  issuerDid = createDidKey(issuerPublicKey);

  console.log('🔑 Issuer initialized with DID:', issuerDid);

  // Display issuer DID in UI
  document.getElementById('issuerDidDisplay').textContent = issuerDid;
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
 * Base64 URL encoding (JWT standard)
 */
function base64UrlEncode(data) {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create and sign JWT
 */
function createJWT(payload) {
  const header = {
    alg: 'EdDSA',
    typ: 'JWT'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign message
  const messageBytes = new TextEncoder().encode(message);
  const messageHash = sha256(messageBytes);
  const signature = ed25519.sign(messageHash, issuerPrivateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Issue a verifiable credential
 */
async function issueCredential(recipientDid, credentialType, claims, expiresInDays) {
  const now = Math.floor(Date.now() / 1000);
  const expirationTime = now + (expiresInDays * 24 * 60 * 60);

  // W3C Verifiable Credential payload
  const vcPayload = {
    iss: issuerDid,
    sub: recipientDid,
    iat: now,
    exp: expirationTime,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', credentialType],
      credentialSubject: {
        id: recipientDid,
        ...claims
      },
      issuer: {
        id: issuerDid,
        name: 'Demo Credential Issuer'
      },
      issuanceDate: new Date(now * 1000).toISOString(),
      expirationDate: new Date(expirationTime * 1000).toISOString()
    }
  };

  return createJWT(vcPayload);
}

/**
 * Generate QR code on canvas
 */
function generateQRCode(text, canvas) {
  const size = 300;
  const qrSize = Math.ceil(Math.sqrt(text.length * 8 / 2956)); // Estimate QR version
  const moduleCount = 21 + (qrSize - 1) * 4;
  const moduleSize = size / moduleCount;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Simple QR code generation (basic implementation)
  // For production, use a proper QR library like qr-code-styling
  ctx.fillStyle = '#000000';
  ctx.font = '12px monospace';

  // Draw text fallback (for demo - replace with proper QR library in production)
  ctx.fillStyle = '#059669';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QR Code', size / 2, size / 2 - 40);
  ctx.font = '12px sans-serif';
  ctx.fillText('Install qr-code-styling', size / 2, size / 2);
  ctx.fillText('for full QR generation', size / 2, size / 2 + 20);
  ctx.fillText('(Copy JWT instead)', size / 2, size / 2 + 40);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeIssuer();

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

  // Populate example data for testing
  document.getElementById('claims').value = JSON.stringify({
    name: 'John Doe',
    memberSince: '2024',
    level: 'gold',
    verified: true
  }, null, 2);
});
