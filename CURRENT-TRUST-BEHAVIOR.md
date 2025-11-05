# Current Trust Behavior - Test Results

## What Happens NOW When You Receive a Credential

### Test: Receive credential from unknown issuer

```bash
# Terminal 1: Start issuer
cd /home/user/wallet/issuer
npm start  # Port 3001

# Terminal 2: Start wallet
cd /home/user/wallet
npm start  # Port 3000
```

### Current Flow:

```
1. User visits issuer (http://localhost:3001)
2. Issuer generates NEW random DID (different every restart)
3. Issuer shows: "Issuer DID: did:key:z6MkXYZ..."
4. User issues credential
5. User copies JWT
6. User goes to wallet
7. User clicks "Receive Credential"
8. User pastes JWT
9. Wallet does:
   ✅ Verify signature is valid
   ✅ Check credential format
   ✅ Extract issuer DID
   ❌ NO check if issuer is trusted
   ✅ ACCEPTS and stores credential
10. ✅ Shows "Credential received!"
```

### What the Wallet Verifies:

```javascript
// src/credentials/credentialManager.js:130
verified = await verifyCredential(jwt, resolver);

// This checks:
✅ JWT signature is valid
✅ Issuer DID can be resolved
✅ Public key matches signature
✅ Credential hasn't been tampered with
✅ JWT format is correct

// This DOES NOT check:
❌ Is this issuer trustworthy?
❌ Does issuer have authority for this credential type?
❌ Is issuer in any trust registry?
❌ Has user approved this issuer before?
```

## Example: Malicious Issuer Scenario

### Attacker's Issuer:
```javascript
// attacker-issuer.js
const issuerDid = "did:key:z6MkAttackerDID...";
const issuerName = "Harvard University"; // FAKE!

// Issue fake PhD credential
const credential = {
  type: "PhDCredential",
  issuer: {
    id: issuerDid,
    name: "Harvard University"  // Lying!
  },
  credentialSubject: {
    name: "Victim Name",
    degree: "PhD in Computer Science",
    graduationDate: "2024-01-01"
  }
};
```

### What Happens:
```
Attacker Issues Fake Credential
         ↓
   Signs with attacker's private key
         ↓
   Creates valid JWT
         ↓
User receives and pastes in wallet
         ↓
Wallet verifies signature ✅ (it IS validly signed by attacker!)
         ↓
Wallet accepts credential ✅
         ↓
User now has "Harvard PhD" from attacker
```

**Why it works:**
- The signature IS valid (signed by attacker's key)
- The JWT format IS correct
- The DID resolves properly
- **BUT: The issuer is NOT really Harvard!**

## The Problem

The wallet verifies **cryptographic authenticity** but not **authority legitimacy**.

It's like:
- ✅ Verifying a signature is real
- ❌ Not checking if signer has authority

Similar to:
- ✅ Check ID card isn't forged
- ❌ Don't check if issuer is real DMV

## Solution

You need to add **ONE** of these trust checks:

### Option A: Show Issuer Info (Simplest)
```
Before accepting credential, show:

┌────────────────────────────────────┐
│ ⚠️  CREDENTIAL RECEIVED             │
├────────────────────────────────────┤
│ Type: PhDCredential                │
│ Issuer: Harvard University         │
│ DID: did:key:z6MkAttacker...       │
│                                    │
│ ⚠️  WARNING: Verify this issuer!   │
│                                    │
│ [ Accept ]  [ Reject ]             │
└────────────────────────────────────┘
```

User can:
- Search "did:key:z6MkAttacker..." → see it's not Harvard
- Check Harvard's real DID
- Reject fake credential

### Option B: Trust Registry (Better)
```
Before accepting credential, check:

1. Is issuer in global registry?
   "did:key:z6MkHarvardReal..." ✅ Verified

2. Is issuer in user's trust list?
   User previously trusted this DID ✅

3. Unknown issuer?
   Ask user to trust or reject ❌
```

## Test It Yourself

### Test Current Behavior:

```bash
# 1. Start both services
cd issuer && npm start &
cd .. && npm start

# 2. In wallet, copy your DID from profile

# 3. In issuer (http://localhost:3001):
   - Paste your DID
   - Issue credential
   - Copy JWT

# 4. In wallet (http://localhost:3000):
   - Go to Credentials
   - Click "Receive Credential"
   - Paste JWT
   - Result: ✅ Accepted immediately!

# 5. Notice:
   - No warning about unknown issuer
   - No confirmation prompt
   - Just "Credential received!"
```

### Test With Fake Issuer:

```bash
# 1. Edit issuer/issuer.js line ~30:
const issuerName = "Harvard University"; // Change this

# 2. Restart issuer
# 3. Issue credential
# 4. Wallet still accepts it! ⚠️
```

## Recommendation

**For your use case, implement Option 1 from TRUST-SYSTEM-OPTIONS.md:**

This adds a simple confirmation dialog showing:
- Issuer name
- Issuer DID
- Credential type
- Claims

User can verify issuer is legitimate before accepting.

**Implementation time:** ~15 minutes
**Database changes:** None
**Security improvement:** Significant

See: `TRUST-SYSTEM-OPTIONS.md` for full implementation code.
