# Third-Party Issuer Integration Guide

## Overview

This document explains how to integrate a third-party credential issuer service with the Personal Identity Wallet.

## Architecture Options

### Option 1: Manual JWT Transfer (Current - No API Needed) ✅

**Flow:**
1. User visits issuer website
2. User authenticates with issuer
3. Issuer generates signed VC JWT
4. Issuer displays JWT as text or QR code
5. User copies JWT or scans QR code
6. User pastes JWT into wallet's "Receive Credential" feature

**Pros:**
- ✅ No API needed
- ✅ Simple to implement
- ✅ Issuer stays stateless
- ✅ Works offline after credential generated

**Cons:**
- ❌ Manual process
- ❌ User must copy/paste
- ❌ Requires two browser tabs/devices

**Best for:** Simple use cases, proof of concept, demo scenarios

---

### Option 2: QR Code Flow (Recommended for Web) ✅

**Flow:**
1. User visits issuer website
2. User authenticates with issuer
3. Issuer generates signed VC JWT
4. Issuer displays QR code containing JWT
5. User scans QR code with wallet's scanner
6. Wallet automatically imports credential

**Pros:**
- ✅ No API needed
- ✅ Fast user experience
- ✅ Works cross-device (desktop issuer → mobile wallet)
- ✅ Already implemented in wallet

**Cons:**
- ❌ Requires QR scanner access
- ❌ JWT size limits (~4KB max for QR codes)

**Best for:** In-person credential issuance, web-to-mobile flows

---

### Option 3: Deep Link / URL Scheme ⚡

**Flow:**
1. User visits issuer website
2. User authenticates with issuer
3. Issuer generates signed VC JWT
4. Issuer creates deep link: `wallet://import-credential?jwt=...`
5. User clicks link
6. Browser opens wallet app
7. Wallet automatically imports credential

**Pros:**
- ✅ One-click experience
- ✅ Works same-device
- ✅ No manual copying

**Cons:**
- ❌ Requires URL scheme registration
- ❌ Browser support varies
- ❌ URL length limits

**Best for:** Same-device web flows, mobile apps

**Implementation needed:** Register custom URL scheme in wallet

---

### Option 4: Issuer API with Polling (API-Based) 🔧

**Flow:**
1. User initiates credential request in wallet
2. Wallet redirects to issuer website
3. User authenticates with issuer
4. Issuer creates pending credential offer
5. User returns to wallet with offer ID
6. Wallet polls issuer API to fetch credential
7. Wallet imports credential automatically

**Pros:**
- ✅ Automated flow
- ✅ Can handle large credentials
- ✅ Issuer can revoke offers
- ✅ Better security (credentials not in URLs)

**Cons:**
- ❌ Requires issuer API endpoint
- ❌ Requires wallet to make HTTP requests
- ❌ More complex implementation

**Best for:** Production systems, enterprise use cases

---

### Option 5: OIDC4VCI (Industry Standard) 🌐

**Flow:**
1. Uses OpenID Connect for Verifiable Credential Issuance
2. Standard OAuth 2.0 flow
3. Industry-standard protocol

**Pros:**
- ✅ Industry standard
- ✅ Interoperable with other wallets
- ✅ Well-documented

**Cons:**
- ❌ Complex to implement
- ❌ Requires OAuth server
- ❌ Overkill for simple use cases

**Best for:** Enterprise, interoperability requirements

---

## Recommended Approach for Your Use Case

For a third-party issuer service in a separate folder, I recommend **Option 2 (QR Code)** or **Option 4 (API-based)** depending on your needs:

- **Use QR Code if:** Simple demo, in-person issuance, minimal infrastructure
- **Use API if:** Production system, automated flows, need revocation

---

## Implementation Examples

### Implementation: QR Code Flow (No API Needed)

#### Issuer Service Structure
```
issuer/
├── index.html          # Issuer web interface
├── issuer.js           # Issuer logic
├── server.js           # Simple HTTP server
└── package.json
```

#### issuer/package.json
```json
{
  "name": "credential-issuer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@noble/curves": "^1.2.0",
    "@noble/hashes": "^1.3.0",
    "did-jwt": "^7.4.0",
    "qr-code-styling": "^1.6.0-rc.1"
  }
}
```

#### issuer/server.js
```javascript
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = createServer(async (req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = await readFile(join(__dirname, filePath));
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🏢 Credential Issuer running at http://localhost:${PORT}`);
});
```

#### issuer/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credential Issuer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 { color: #1f2937; margin-bottom: 8px; }
    p { color: #6b7280; margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 500; margin-bottom: 6px; color: #374151; }
    input, select, textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
    }
    textarea { min-height: 100px; resize: vertical; }
    button {
      width: 100%;
      padding: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #1e40af; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    #result { margin-top: 24px; padding-top: 24px; border-top: 2px solid #e5e7eb; }
    #qrCode { margin: 20px 0; text-align: center; }
    #jwtDisplay {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      margin: 12px 0;
      max-height: 150px;
      overflow-y: auto;
    }
    .success { color: #059669; font-weight: 500; }
    .error { color: #dc2626; }
    .copy-btn {
      background: #10b981;
      margin-top: 12px;
    }
    .copy-btn:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏢 Credential Issuer</h1>
    <p>Issue verifiable credentials to wallet users</p>

    <div class="form-group">
      <label for="recipientDid">Recipient DID</label>
      <input type="text" id="recipientDid" placeholder="did:key:z6Mk..." required>
      <small>Enter the DID of the credential recipient</small>
    </div>

    <div class="form-group">
      <label for="credentialType">Credential Type</label>
      <select id="credentialType">
        <option value="MembershipCredential">Membership Credential</option>
        <option value="AgeCredential">Age Credential</option>
        <option value="EducationCredential">Education Credential</option>
        <option value="EmploymentCredential">Employment Credential</option>
      </select>
    </div>

    <div class="form-group">
      <label for="claims">Claims (JSON)</label>
      <textarea id="claims" placeholder='{"name": "John Doe", "memberSince": "2024"}'></textarea>
      <small>Enter claims as valid JSON object</small>
    </div>

    <div class="form-group">
      <label for="expiresIn">Expires In (days)</label>
      <input type="number" id="expiresIn" value="365" min="1">
    </div>

    <button id="issueBtn">Issue Credential</button>

    <div id="result" style="display: none;">
      <p class="success">✅ Credential issued successfully!</p>

      <h3 style="margin: 20px 0 12px 0;">Scan with Wallet:</h3>
      <div id="qrCode"></div>

      <h3 style="margin: 20px 0 12px 0;">Or copy JWT:</h3>
      <div id="jwtDisplay"></div>
      <button class="copy-btn" id="copyBtn">📋 Copy JWT</button>

      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">
        📱 User can scan the QR code or copy the JWT and paste it into their wallet's "Receive Credential" feature.
      </p>
    </div>
  </div>

  <script type="importmap">
  {
    "imports": {
      "@noble/curves/ed25519": "https://esm.sh/@noble/curves@1.2.0/ed25519",
      "@noble/hashes/sha256": "https://esm.sh/@noble/hashes@1.3.0/sha256",
      "qr-code-styling": "https://esm.sh/qr-code-styling@1.6.0-rc.1"
    }
  }
  </script>
  <script type="module" src="./issuer.js"></script>
</body>
</html>
```

#### issuer/issuer.js
```javascript
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import QRCodeStyling from 'qr-code-styling';

// Issuer's key pair (in production, load from secure storage)
let issuerPrivateKey;
let issuerPublicKey;
let issuerDid;

// Initialize issuer identity
function initializeIssuer() {
  // In production, load from environment or secure key storage
  // For demo, generate new keys each time
  issuerPrivateKey = ed25519.utils.randomPrivateKey();
  issuerPublicKey = ed25519.getPublicKey(issuerPrivateKey);
  issuerDid = createDidKey(issuerPublicKey);

  console.log('🔑 Issuer DID:', issuerDid);
}

// Create did:key from public key
function createDidKey(publicKey) {
  const prefix = new Uint8Array([0xed, 0x01]);
  const prefixed = new Uint8Array(prefix.length + publicKey.length);
  prefixed.set(prefix, 0);
  prefixed.set(publicKey, prefix.length);
  return 'did:key:z' + base58Encode(prefixed);
}

// Base58 encoding
function base58Encode(bytes) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';

  while (num > 0) {
    result = ALPHABET[Number(num % 58n)] + result;
    num = num / 58n;
  }

  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = '1' + result;
  }

  return result;
}

// Create JWT header and payload
function createJWT(payload) {
  const header = {
    alg: 'EdDSA',
    typ: 'JWT'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign
  const messageBytes = new TextEncoder().encode(message);
  const signature = ed25519.sign(sha256(messageBytes), issuerPrivateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

// Base64 URL encoding
function base64UrlEncode(data) {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Issue credential
async function issueCredential(recipientDid, credentialType, claims, expiresInDays) {
  const now = Math.floor(Date.now() / 1000);
  const expirationTime = now + (expiresInDays * 24 * 60 * 60);

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

// Generate QR code
function generateQRCode(jwt, container) {
  const qr = new QRCodeStyling({
    width: 300,
    height: 300,
    data: jwt,
    margin: 10,
    qrOptions: {
      errorCorrectionLevel: 'M'
    },
    dotsOptions: {
      color: '#2563eb',
      type: 'rounded'
    },
    cornersSquareOptions: {
      color: '#1e40af',
      type: 'extra-rounded'
    },
    backgroundOptions: {
      color: '#ffffff'
    }
  });

  container.innerHTML = '';
  qr.append(container);
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  initializeIssuer();

  document.getElementById('issueBtn').addEventListener('click', async () => {
    const recipientDid = document.getElementById('recipientDid').value.trim();
    const credentialType = document.getElementById('credentialType').value;
    const claimsText = document.getElementById('claims').value.trim();
    const expiresIn = parseInt(document.getElementById('expiresIn').value);

    // Validate
    if (!recipientDid.startsWith('did:')) {
      alert('Invalid DID format');
      return;
    }

    let claims;
    try {
      claims = JSON.parse(claimsText);
    } catch (e) {
      alert('Invalid JSON in claims field');
      return;
    }

    // Issue credential
    try {
      const jwt = await issueCredential(recipientDid, credentialType, claims, expiresIn);

      // Display result
      document.getElementById('jwtDisplay').textContent = jwt;
      generateQRCode(jwt, document.getElementById('qrCode'));
      document.getElementById('result').style.display = 'block';

      // Copy button
      document.getElementById('copyBtn').onclick = () => {
        navigator.clipboard.writeText(jwt);
        alert('JWT copied to clipboard!');
      };

    } catch (error) {
      alert('Error issuing credential: ' + error.message);
    }
  });
});
```

---

### Implementation: API-Based Flow

If you need an API-based approach, here's the architecture:

#### Issuer API Endpoints

```javascript
// issuer/api.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Storage for pending credential offers (use Redis in production)
const pendingOffers = new Map();

// Endpoint 1: Create credential offer
app.post('/api/create-offer', async (req, res) => {
  const { recipientDid, credentialType, claims } = req.body;

  // Validate request
  if (!recipientDid || !credentialType || !claims) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Generate offer ID
  const offerId = generateRandomId();

  // Store pending offer
  pendingOffers.set(offerId, {
    recipientDid,
    credentialType,
    claims,
    createdAt: Date.now(),
    status: 'pending'
  });

  // Return offer ID
  res.json({ offerId, expiresIn: 300 }); // 5 minutes
});

// Endpoint 2: Fetch credential by offer ID
app.get('/api/credential/:offerId', async (req, res) => {
  const { offerId } = req.params;

  const offer = pendingOffers.get(offerId);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found or expired' });
  }

  // Issue credential
  const jwt = await issueCredential(
    offer.recipientDid,
    offer.credentialType,
    offer.claims,
    365
  );

  // Mark as claimed
  pendingOffers.delete(offerId);

  res.json({ credential: jwt });
});

// Endpoint 3: Revoke offer
app.delete('/api/offer/:offerId', (req, res) => {
  const { offerId } = req.params;
  pendingOffers.delete(offerId);
  res.json({ success: true });
});

app.listen(3001, () => {
  console.log('🏢 Issuer API running on http://localhost:3001');
});
```

#### Wallet Integration (fetch credential from issuer API)

```javascript
// In wallet src/app.js
async function handleFetchFromIssuer() {
  const issuerUrl = prompt('Enter issuer URL:');
  const offerId = prompt('Enter offer ID:');

  if (!issuerUrl || !offerId) return;

  try {
    showMessage('⏳ Fetching credential from issuer...', 'info');

    const response = await fetch(`${issuerUrl}/api/credential/${offerId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch credential');
    }

    // Import credential
    await receiveCredential(currentUser, data.credential);
    showMessage('✅ Credential received from issuer!', 'success');
    switchPanel('credentials');

  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}
```

---

## Recommended Setup

For your use case, I recommend starting with **QR Code flow** (no API needed):

1. Create `issuer/` folder with the files above
2. Run issuer on port 3001: `cd issuer && npm start`
3. Run wallet on port 3000: `cd wallet && npm start`
4. User visits issuer → gets credential → scans QR → imports to wallet

This gives you:
- ✅ No API complexity
- ✅ Works immediately
- ✅ Easy to demo
- ✅ Can upgrade to API later

---

## Security Considerations

### For Issuer:
- 🔒 Store issuer private key securely (environment variables, key vault)
- 🔒 Validate user authentication before issuing
- 🔒 Rate limit credential issuance
- 🔒 Log all issued credentials for audit
- 🔒 Implement credential revocation list

### For Wallet:
- 🔒 Verify credential signature before storing
- 🔒 Check issuer DID is trusted
- 🔒 Validate expiration dates
- 🔒 Store credentials encrypted
- 🔒 Allow user to review before accepting

---

## Next Steps

1. **Phase 1:** Implement QR code issuer (provided above)
2. **Phase 2:** Add wallet feature to scan issuer QR codes (already done!)
3. **Phase 3:** Test end-to-end flow
4. **Phase 4:** (Optional) Add API-based flow for automation

Need help implementing? Let me know which approach you prefer!
