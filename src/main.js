import { ed25519 } from '@noble/curves/ed25519';
import { base58btc } from 'multiformats/bases/base58';
import { Resolver } from 'did-resolver';
import { getResolver as keyDidResolver } from 'key-did-resolver';
import {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyCredential,
  verifyPresentation
} from 'did-jwt-vc';
import QRCodeStyling from 'qr-code-styling';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let issuerDid = null;
let secretKey = null;
let publicKey = null;

let lastVcJwt = null;

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
const enc = new TextEncoder();

const b64u = (bytes) => {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function multibaseDidKeyFromPub(pubKey) {
  const prefix = new Uint8Array([0xed, 0x01]);
  const prefixed = new Uint8Array(prefix.length + pubKey.length);
  prefixed.set(prefix, 0);
  prefixed.set(pubKey, prefix.length);
  return 'did:key:' + base58btc.encode(prefixed);
}

// signer for did-jwt (returns base64url signature)
const ed25519Signer = async (data) => {
  let dataToSign = data;
  if (typeof data === 'string') {
    dataToSign = new TextEncoder().encode(data);
  }
  const sig = await ed25519.sign(dataToSign, secretKey);
  return b64u(sig);
};

const resolver = new Resolver(keyDidResolver());

// ─────────────────────────────────────────────────────────────────────────────
// 1) GENERATE DID
// ─────────────────────────────────────────────────────────────────────────────
const issuerDidEl = document.getElementById('issuerDid');
const pubB58El = document.getElementById('pubB58');
document.getElementById('genDidBtn').addEventListener('click', () => {
  secretKey = ed25519.utils.randomPrivateKey();
  publicKey = ed25519.getPublicKey(secretKey);
  issuerDid = multibaseDidKeyFromPub(publicKey);
  issuerDidEl.textContent = issuerDid;
  pubB58El.textContent = base58btc.encode(publicKey);
});

// Export (encrypt with AES-GCM)
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!secretKey) return alert('Generate a DID first.');
  const pass = prompt('Enter passphrase to encrypt your wallet:');
  if (!pass) return;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, secretKey));
  const blob = new Blob([salt, iv, ct], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'wallet.didkey.enc' });
  a.click();
  URL.revokeObjectURL(url);
});

// Import (decrypt)
document.getElementById('importBtn').addEventListener('click', async () => {
  const [fileHandle] = await window.showOpenFilePicker({
    types: [{ description: 'Encrypted Wallet', accept: { 'application/octet-stream': ['.enc'] } }]
  });
  const file = await fileHandle.getFile();
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 16 + 12 + 32) return alert('Invalid file.');
  const salt = buf.slice(0, 16);
  const iv = buf.slice(16, 28);
  const ct = buf.slice(28);
  const pass = prompt('Enter passphrase to decrypt your wallet:');
  if (!pass) return;
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    secretKey = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct));
    publicKey = ed25519.getPublicKey(secretKey);
    issuerDid = multibaseDidKeyFromPub(publicKey);
    issuerDidEl.textContent = issuerDid;
    pubB58El.textContent = base58btc.encode(publicKey);
    alert('Wallet imported.');
  } catch (e) {
    console.error(e);
    alert('Decryption failed.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) ISSUE VC (JWT)
// ─────────────────────────────────────────────────────────────────────────────
const vcOut = document.getElementById('vcOut');
const qrDiv = document.getElementById('qr');

document.getElementById('issueVcBtn').addEventListener('click', async () => {
  if (!issuerDid) return alert('Generate a DID first.');
  const subject = (document.getElementById('subjectName').value || 'Unknown').trim();
  let claim;
  try {
    claim = JSON.parse(document.getElementById('claimJson').value);
  } catch {
    return alert('Invalid JSON claim');
  }

  const now = Math.floor(Date.now() / 1000);
  const holderDid = `did:example:${subject.toLowerCase()}`; // demo only

  const vcPayload = {
    sub: holderDid,
    nbf: now - 10,
    exp: now + 60 * 60 * 24 * 365, // 1 year
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'DemoCredential'],
      credentialSubject: { id: holderDid, ...claim }
    }
  };

  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: issuerDid,
    alg: 'EdDSA',
    signer: ed25519Signer
  });

  lastVcJwt = jwt;
  vcOut.textContent = jwt;

  // QR for quick transfer
  qrDiv.innerHTML = '';
  const qr = new QRCodeStyling({ width: 220, height: 220, data: jwt, dotsOptions: { type: 'rounded' } });
  qr.append(qrDiv);
});

// ─────────────────────────────────────────────────────────────────────────────
// Make a VP (with challenge + domain)
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('makeVpBtn').addEventListener('click', async () => {
  if (!issuerDid) return alert('Generate a DID first.');
  if (!lastVcJwt) return alert('Issue a VC first.');

  const challengeBytes = new Uint8Array(8);
  crypto.getRandomValues(challengeBytes);
  const challengeNonce = b64u(challengeBytes);
  const domain = 'verifier.example.org';

  const vpPayload = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: [lastVcJwt]
    },
    aud: domain,
    nonce: challengeNonce
  };

  const vpJwt = await createVerifiablePresentationJwt(vpPayload, {
    did: issuerDid,
    alg: 'EdDSA',
    signer: ed25519Signer
  });

  const challengeInput = document.getElementById('challenge');
  const domainInput = document.getElementById('domain');
  challengeInput.value = challengeNonce;
  domainInput.value = domain;
  document.getElementById('incomingJwt').value = vpJwt;

  navigator.clipboard.writeText(vpJwt).catch(() => {});
  alert(`VP created and copied to clipboard.\n\nchallenge: ${vpPayload.nonce}\ndomain: ${domain}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) VERIFY VC / VP
// ─────────────────────────────────────────────────────────────────────────────
const verifyResult = document.getElementById('verifyResult');
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const token = (document.getElementById('incomingJwt').value || '').trim();
  const challenge = (document.getElementById('challenge').value || '').trim();
  const domain = (document.getElementById('domain').value || '').trim();
  if (!token) return alert('Paste a VC or VP JWT');

  try {
    // Try VP verify first (it will check nonce/audience if provided)
    const vp = await verifyPresentation(token, resolver, { audience: domain || undefined, nonce: challenge || undefined });
    verifyResult.textContent = '✅ VP verified\n' + JSON.stringify(vp.verifiablePresentation, null, 2);
    return;
  } catch (e) {
    // fallthrough to VC
  }

  try {
    const vc = await verifyCredential(token, resolver);
    verifyResult.textContent = '✅ VC verified\n' + JSON.stringify(vc.verifiableCredential, null, 2);
  } catch (e) {
    verifyResult.textContent = '❌ Verification failed:\n' + e;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) Derived claim VP (over18 only) — didactic
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('makeDerivedVpBtn').addEventListener('click', async () => {
  if (!issuerDid) return alert('Generate a DID first.');
  if (!lastVcJwt) return alert('Issue a VC first to derive from it');

  // Decode the VC payload (header.payload.sig)
  const [, payloadB64] = lastVcJwt.split('.');
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
  const cs = payload?.vc?.credentialSubject || {};
  const age = Number(cs.age);
  if (!Number.isFinite(age)) return alert('VC has no numeric age to derive from.');

  const derived = { over18: age >= 18 };
  const now = Math.floor(Date.now() / 1000);
  const holderDid = cs.id || issuerDid;

  const derivedNonceBytes = new Uint8Array(8);
  crypto.getRandomValues(derivedNonceBytes);
  const derivedNonce = b64u(derivedNonceBytes);
  const derivedDomain = 'verifier.example.org';

  const vpPayload = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      // embed a tiny derived VC purely for demonstration
      verifiableCredential: [
        await createVerifiableCredentialJwt({
          sub: holderDid,
          nbf: now - 10,
          exp: now + 3600,
          vc: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'AgePredicate'],
            credentialSubject: { id: holderDid, ...derived }
          }
        }, {
          did: issuerDid,
          alg: 'EdDSA',
          signer: ed25519Signer
        })
      ]
    },
    aud: derivedDomain,
    nonce: derivedNonce
  };

  const vpJwt = await createVerifiablePresentationJwt(vpPayload, {
    did: issuerDid,
    alg: 'EdDSA',
    signer: ed25519Signer
  });
  const challengeInput = document.getElementById('challenge');
  const domainInput = document.getElementById('domain');
  challengeInput.value = derivedNonce;
  domainInput.value = derivedDomain;
  document.getElementById('derivedVpOut').textContent = vpJwt;
});