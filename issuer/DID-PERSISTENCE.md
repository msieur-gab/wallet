# Issuer DID Persistence

## Current Behavior (Demo Mode)

**The issuer generates NEW random DIDs every time it restarts.**

This means:
- Every restart → new DIDs for all 5 issuers
- Credentials issued before restart won't match new DIDs
- Previous credentials will show "unknown issuer" after restart

### Why This Happens

```javascript
// In issuer.js, on every startup:
for (const profile of issuerProfiles) {
  const privateKey = ed25519.utils.randomPrivateKey(); // NEW random key!
  const publicKey = ed25519.getPublicKey(privateKey);
  const did = createDidKey(publicKey); // NEW DID!
}
```

### Impact for Demo

**For testing/demo purposes, this is FINE:**
- ✅ Shows how multiple issuers work
- ✅ Each issuer has unique DID per session
- ✅ Credentials work within same session
- ⚠️ But DIDs change between restarts

**Example:**
```
Session 1:
University DID: did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH
→ Issue credential
→ User receives it ✅

Restart issuer...

Session 2:
University DID: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
→ Different DID!
→ Previous credential now from "unknown issuer" ⚠️
```

---

## Production Solution: Persistent DIDs

For production, you need to **persist issuer private keys** so DIDs remain constant.

### Option 1: Environment Variables (Recommended)

**Store private keys in environment:**

```javascript
// .env file (NEVER commit to git!)
UNIVERSITY_PRIVATE_KEY=a1b2c3d4e5f6...
EMPLOYER_PRIVATE_KEY=b2c3d4e5f6g7...
GOVERNMENT_PRIVATE_KEY=c3d4e5f6g7h8...
MEMBERSHIP_PRIVATE_KEY=d4e5f6g7h8i9...
HEALTH_PRIVATE_KEY=e5f6g7h8i9j0...
```

**Load in issuer.js:**

```javascript
import dotenv from 'dotenv';
dotenv.config();

async function initializeIssuer() {
  const response = await fetch('./issuers.json');
  const data = await response.json();
  issuerProfiles = data.issuers;

  for (const profile of issuerProfiles) {
    const envKey = `${profile.id.toUpperCase()}_PRIVATE_KEY`;
    const storedKey = process.env[envKey];

    let privateKey;
    if (storedKey) {
      // Load existing key
      privateKey = hexToBytes(storedKey);
      console.log(`✅ Loaded persisted key for ${profile.name}`);
    } else {
      // Generate new key
      privateKey = ed25519.utils.randomPrivateKey();
      console.warn(`⚠️  Generated NEW key for ${profile.name}`);
      console.warn(`   Add to .env: ${envKey}=${bytesToHex(privateKey)}`);
    }

    const publicKey = ed25519.getPublicKey(privateKey);
    const did = createDidKey(publicKey);
    const privateKeyHex = bytesToHex(privateKey);
    const signer = EdDSASigner(privateKeyHex);

    issuerKeys[profile.id] = { privateKey, publicKey, did, signer };
  }
}
```

**Pros:**
- ✅ Simple to implement
- ✅ Keys persist across restarts
- ✅ Easy to back up
- ✅ Standard practice

**Cons:**
- ❌ Must manage .env file
- ❌ Must set up on each deployment

---

### Option 2: JSON Key File

**Create issuer-keys.json (excluded from git):**

```json
{
  "university": {
    "privateKey": "a1b2c3d4e5f6...",
    "did": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH"
  },
  "employer": {
    "privateKey": "b2c3d4e5f6g7...",
    "did": "did:key:z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V"
  }
}
```

**Load in issuer.js:**

```javascript
async function loadOrGenerateKeys() {
  let storedKeys = {};

  try {
    const response = await fetch('./issuer-keys.json');
    storedKeys = await response.json();
  } catch (e) {
    console.warn('⚠️  No issuer-keys.json found, will generate new keys');
  }

  for (const profile of issuerProfiles) {
    const stored = storedKeys[profile.id];

    if (stored) {
      const privateKey = hexToBytes(stored.privateKey);
      const publicKey = ed25519.getPublicKey(privateKey);
      const did = createDidKey(publicKey);

      // Verify stored DID matches
      if (did !== stored.did) {
        throw new Error(`DID mismatch for ${profile.id}`);
      }

      const signer = EdDSASigner(stored.privateKey);
      issuerKeys[profile.id] = { privateKey, publicKey, did, signer };
      console.log(`✅ Loaded ${profile.name}: ${did}`);
    } else {
      // Generate new key
      const privateKey = ed25519.utils.randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const did = createDidKey(publicKey);
      const privateKeyHex = bytesToHex(privateKey);
      const signer = EdDSASigner(privateKeyHex);

      issuerKeys[profile.id] = { privateKey, publicKey, did, signer };

      console.warn(`⚠️  Generated NEW key for ${profile.name}`);
      console.warn(`   DID: ${did}`);
      console.warn(`   Add to issuer-keys.json:`);
      console.warn(JSON.stringify({
        [profile.id]: {
          privateKey: privateKeyHex,
          did: did
        }
      }, null, 2));
    }
  }
}
```

**Pros:**
- ✅ Easy to see all DIDs at once
- ✅ Can commit DID (not private key) to docs
- ✅ Portable

**Cons:**
- ❌ File must be secured
- ❌ Risk of committing to git

---

### Option 3: Database Storage

**Store in database:**

```javascript
// Using SQLite, PostgreSQL, etc.
async function loadIssuerKeys() {
  for (const profile of issuerProfiles) {
    const result = await db.query(
      'SELECT private_key, did FROM issuer_keys WHERE issuer_id = ?',
      [profile.id]
    );

    if (result) {
      // Load existing
      const privateKey = hexToBytes(result.private_key);
      const did = result.did;
      const signer = EdDSASigner(result.private_key);
      issuerKeys[profile.id] = { privateKey, did, signer };
    } else {
      // Generate and store
      const privateKey = ed25519.utils.randomPrivateKey();
      const did = createDidKey(ed25519.getPublicKey(privateKey));
      const privateKeyHex = bytesToHex(privateKey);

      await db.query(
        'INSERT INTO issuer_keys (issuer_id, private_key, did) VALUES (?, ?, ?)',
        [profile.id, privateKeyHex, did]
      );

      const signer = EdDSASigner(privateKeyHex);
      issuerKeys[profile.id] = { privateKey, did, signer };
    }
  }
}
```

**Pros:**
- ✅ Secure storage
- ✅ Encrypted at rest
- ✅ Audit trail

**Cons:**
- ❌ Requires database setup
- ❌ More complex

---

### Option 4: Hardware Security Module (Enterprise)

**Use HSM for key storage:**

```javascript
import { HSMClient } from 'cloud-hsm-sdk';

async function loadFromHSM() {
  const hsm = new HSMClient({ region: 'us-east-1' });

  for (const profile of issuerProfiles) {
    const keyId = `issuer-${profile.id}`;
    const key = await hsm.getKey(keyId);

    if (!key) {
      await hsm.createKey(keyId, { algorithm: 'ED25519' });
    }

    const signer = await hsm.getSigner(keyId);
    const did = await hsm.getDID(keyId);

    issuerKeys[profile.id] = { signer, did };
  }
}
```

**Pros:**
- ✅ Maximum security
- ✅ Keys never leave HSM
- ✅ Compliance ready

**Cons:**
- ❌ Expensive
- ❌ Complex setup
- ❌ Overkill for most use cases

---

## Recommendation

### For Development/Demo (Current)
- ✅ Keep current behavior (generate on startup)
- ✅ Accept that DIDs change between restarts
- ✅ Re-issue test credentials after restart

### For Production
- 🥇 **Use Option 1 (Environment Variables)**
- Simple, secure, standard practice
- Easy to implement
- Works with Docker/Kubernetes

---

## Quick Implementation Guide

### Add Persistence Now (5 minutes)

1. **Install dotenv:**
   ```bash
   cd issuer
   npm install dotenv
   ```

2. **Create .env file:**
   ```bash
   # Add to .gitignore first!
   echo "issuer/.env" >> ../.gitignore

   # Run issuer once to get keys
   npm start
   # Copy the keys from console

   # Create .env with those keys
   cat > .env << EOF
   UNIVERSITY_PRIVATE_KEY=paste_here
   EMPLOYER_PRIVATE_KEY=paste_here
   GOVERNMENT_PRIVATE_KEY=paste_here
   MEMBERSHIP_PRIVATE_KEY=paste_here
   HEALTH_PRIVATE_KEY=paste_here
   EOF
   ```

3. **Update issuer.js** (see Option 1 code above)

4. **Restart issuer:**
   ```bash
   npm start
   # Should now show "✅ Loaded persisted key for..."
   ```

---

## Security Best Practices

### DO:
- ✅ Store private keys encrypted
- ✅ Use environment variables in production
- ✅ Add .env to .gitignore
- ✅ Rotate keys periodically
- ✅ Back up keys securely (encrypted)
- ✅ Use different keys per environment (dev/staging/prod)

### DON'T:
- ❌ Commit private keys to git
- ❌ Store keys in plain text files
- ❌ Share keys via email/chat
- ❌ Use same keys across environments
- ❌ Hard-code keys in source code
- ❌ Store keys in public locations

---

## Summary

**Current State:**
- Issuer generates random DIDs on every startup
- Works for demo, but DIDs change between sessions

**Production Needs:**
- Persistent private keys
- Stable DIDs
- Secure storage

**Recommended Solution:**
- Environment variables (.env file)
- Load existing keys or generate new ones
- Log new keys for admin to save

**Implementation:**
- See "Option 1: Environment Variables" above
- Takes ~5 minutes to implement
- Solves DID persistence issue
