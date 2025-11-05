# Issuer Trust System Options

## Current Behavior

The wallet currently **accepts credentials from any issuer** with a valid signature. This means:
- ✅ Cryptographic verification works
- ✅ Signature tampering is detected
- ❌ No verification of issuer authority
- ❌ No trusted issuer registry

## Problem Scenario

```
Bad Actor Issuer                        Your Wallet
┌──────────────────┐                   ┌──────────────┐
│ "Harvard Univ"   │                   │              │
│ (fake issuer)    │ ─── PhD JWT ────► │ Accepts! ✅  │
│ Valid signature  │                   │              │
└──────────────────┘                   └──────────────┘

Why it accepts:
- Signature is valid (signed by issuer's key)
- JWT format is correct
- No check if issuer is real Harvard
```

## Solution Options

### Option 1: User Confirmation (Recommended for MVP) ⭐

**Show issuer info, let user decide to accept/reject**

**Implementation:**

```javascript
// src/credentials/credentialManager.js

export async function receiveCredential(username, jwt, options = {}) {
  // Verify signature (as before)
  const verified = await verifyCredential(jwt, resolver);
  const issuerDid = verified.issuer;
  const credentialType = vc.type.find(t => t !== 'VerifiableCredential');

  // NEW: Return issuer info for user confirmation
  return {
    needsConfirmation: true,
    issuer: {
      did: issuerDid,
      name: vc.issuer?.name || 'Unknown Issuer',
      type: credentialType,
      claims: vc.credentialSubject
    },
    jwt // Store for later if user confirms
  };
}

// NEW: Separate function to store after confirmation
export async function confirmCredential(username, jwt) {
  // ... store credential (existing code)
}
```

**UI Flow:**

```javascript
// src/app.js

async function handleShowReceiveCredential() {
  const jwt = prompt('Paste credential JWT:');
  if (!jwt) return;

  try {
    const result = await receiveCredential(currentUser, jwt);

    if (result.needsConfirmation) {
      // Show issuer info modal
      const accept = confirm(`
        📜 Credential Received

        Type: ${result.issuer.type}
        Issuer: ${result.issuer.name}
        DID: ${result.issuer.did.substring(0, 40)}...

        Claims:
        ${JSON.stringify(result.issuer.claims, null, 2)}

        ⚠️ WARNING: Verify this issuer is legitimate!

        Accept this credential?
      `);

      if (accept) {
        await confirmCredential(currentUser, jwt);
        showMessage('✅ Credential accepted!', 'success');
      } else {
        showMessage('❌ Credential rejected', 'info');
      }
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}
```

**Pros:**
- ✅ Simple to implement
- ✅ User controls trust decisions
- ✅ No database changes needed

**Cons:**
- ❌ User must manually verify issuer
- ❌ No memory of past trust decisions

---

### Option 2: Trusted Issuer Registry (Recommended for Production) 🔒

**Maintain a list of trusted issuer DIDs**

**Database Schema:**

```javascript
// Add to src/db/database.js

this.version(3).stores({
  trustedIssuers: '++id, issuerDid, issuerName, credentialTypes, trustedBy, addedAt, verified'
});
```

**Implementation:**

```javascript
// src/credentials/issuerRegistry.js

import { db } from '../db/database.js';

/**
 * Check if issuer is trusted
 */
export async function isIssuerTrusted(username, issuerDid) {
  const trusted = await db.trustedIssuers
    .where('issuerDid')
    .equals(issuerDid)
    .and(entry => entry.trustedBy === username || entry.verified === true)
    .first();

  return !!trusted;
}

/**
 * Add trusted issuer
 */
export async function addTrustedIssuer(username, issuerData) {
  await db.trustedIssuers.add({
    issuerDid: issuerData.did,
    issuerName: issuerData.name,
    credentialTypes: issuerData.credentialTypes || [],
    trustedBy: username,
    addedAt: Date.now(),
    verified: false, // Admin verification flag
    notes: issuerData.notes || ''
  });
}

/**
 * Get all trusted issuers
 */
export async function getTrustedIssuers(username) {
  return await db.trustedIssuers
    .where('trustedBy')
    .equals(username)
    .or('verified')
    .equals(true)
    .toArray();
}

/**
 * Remove trusted issuer
 */
export async function removeTrustedIssuer(username, issuerDid) {
  await db.trustedIssuers
    .where('issuerDid')
    .equals(issuerDid)
    .and(entry => entry.trustedBy === username)
    .delete();
}
```

**Updated Credential Reception:**

```javascript
// src/credentials/credentialManager.js

export async function receiveCredential(username, jwt, options = {}) {
  const verified = await verifyCredential(jwt, resolver);
  const issuerDid = verified.issuer;

  // Check if issuer is trusted
  const trusted = await isIssuerTrusted(username, issuerDid);

  if (!trusted && !options.skipTrustCheck) {
    // Get issuer info
    const issuerName = vc.issuer?.name || 'Unknown Issuer';

    return {
      needsTrustDecision: true,
      issuerDid,
      issuerName,
      credentialType,
      claims: vc.credentialSubject,
      jwt
    };
  }

  // Issuer is trusted, store credential
  // ... (existing storage code)
}
```

**UI for Managing Trust:**

```javascript
// Add to index.html - Settings panel

<div class="card">
  <h2>🔒 Trusted Issuers</h2>
  <div id="trustedIssuersList"></div>
  <button id="addTrustedIssuerBtn">➕ Add Trusted Issuer</button>
</div>
```

```javascript
// src/app.js

async function loadTrustedIssuers() {
  const issuers = await getTrustedIssuers(currentUser);
  const container = document.getElementById('trustedIssuersList');

  container.innerHTML = issuers.map(issuer => `
    <div class="issuer-item">
      <strong>${issuer.issuerName}</strong>
      <div class="issuer-did">${issuer.issuerDid}</div>
      <button onclick="removeTrustedIssuer('${issuer.issuerDid}')">Remove</button>
    </div>
  `).join('');
}

async function handleReceiveWithTrust(jwt) {
  const result = await receiveCredential(currentUser, jwt);

  if (result.needsTrustDecision) {
    const trust = confirm(`
      Credential from UNTRUSTED issuer:

      ${result.issuerName}
      ${result.issuerDid}

      Do you trust this issuer?
    `);

    if (trust) {
      // Add to trusted list
      await addTrustedIssuer(currentUser, {
        did: result.issuerDid,
        name: result.issuerName
      });

      // Accept credential
      await receiveCredential(currentUser, jwt, { skipTrustCheck: true });
      showMessage('✅ Issuer added to trusted list and credential accepted', 'success');
    } else {
      showMessage('❌ Credential rejected', 'info');
    }
  }
}
```

**Pros:**
- ✅ Remember trust decisions
- ✅ Auto-accept from trusted issuers
- ✅ User control over trust

**Cons:**
- ❌ Requires database changes
- ❌ More complex implementation

---

### Option 3: Global Registry (Enterprise/Production) 🌐

**Use a published list of verified issuers**

**Architecture:**

```javascript
// Fetch from trusted registry API or blockchain
const TRUSTED_ISSUERS_URL = 'https://registry.example.com/issuers.json';

export async function fetchGlobalRegistry() {
  const response = await fetch(TRUSTED_ISSUERS_URL);
  const registry = await response.json();

  return registry; // { "did:key:z6Mk...": { name: "Harvard", verified: true } }
}

export async function isIssuerVerified(issuerDid) {
  const registry = await fetchGlobalRegistry();
  return !!registry[issuerDid]?.verified;
}
```

**Implementation:**

```javascript
export async function receiveCredential(username, jwt) {
  const verified = await verifyCredential(jwt, resolver);
  const issuerDid = verified.issuer;

  // Check global registry
  const globallyVerified = await isIssuerVerified(issuerDid);

  // Check local trust list
  const locallyTrusted = await isIssuerTrusted(username, issuerDid);

  if (!globallyVerified && !locallyTrusted) {
    return {
      status: 'untrusted',
      warning: 'Issuer not in global registry',
      issuerDid,
      jwt
    };
  }

  // Store with trust level
  await db.credentials.add({
    // ... existing fields
    trustLevel: globallyVerified ? 'verified' : 'trusted',
    verifiedAt: Date.now()
  });
}
```

**Registry Format (JSON):**

```json
{
  "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK": {
    "name": "Harvard University",
    "verified": true,
    "credentialTypes": ["EducationCredential", "DegreeCredential"],
    "website": "https://harvard.edu",
    "verifiedBy": "W3C",
    "verifiedAt": "2024-01-15T00:00:00Z"
  },
  "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJqBrze8M8w": {
    "name": "California DMV",
    "verified": true,
    "credentialTypes": ["DriversLicenseCredential"],
    "website": "https://dmv.ca.gov",
    "verifiedBy": "US Government",
    "verifiedAt": "2024-02-20T00:00:00Z"
  }
}
```

**Pros:**
- ✅ Centralized verification
- ✅ No user decision needed
- ✅ Industry standard approach

**Cons:**
- ❌ Requires external registry
- ❌ Centralization (defeats some DID benefits)
- ❌ Registry maintenance needed

---

## Recommendation: Hybrid Approach

Combine Option 2 + Option 3:

```javascript
export async function receiveCredential(username, jwt) {
  const verified = await verifyCredential(jwt, resolver);
  const issuerDid = verified.issuer;

  // Level 1: Check global registry (if available)
  let trustLevel = 'untrusted';
  try {
    const globallyVerified = await isIssuerVerified(issuerDid);
    if (globallyVerified) trustLevel = 'verified';
  } catch (e) {
    // Global registry not available, continue
  }

  // Level 2: Check user's trust list
  if (trustLevel === 'untrusted') {
    const locallyTrusted = await isIssuerTrusted(username, issuerDid);
    if (locallyTrusted) trustLevel = 'trusted';
  }

  // Level 3: Ask user
  if (trustLevel === 'untrusted') {
    return {
      needsTrustDecision: true,
      issuerDid,
      issuerName: vc.issuer?.name,
      credentialType,
      jwt
    };
  }

  // Store with trust level
  await db.credentials.add({
    // ... existing fields
    trustLevel, // 'verified', 'trusted', or 'untrusted'
    trustedAt: Date.now()
  });

  return { success: true, trustLevel };
}
```

**Trust Levels:**
- 🟢 **Verified**: In global registry (highest trust)
- 🟡 **Trusted**: User personally added to trust list
- 🔴 **Untrusted**: Unknown issuer, needs user decision

---

## Quick Implementation Guide

### For MVP (Start Here):

1. **Implement Option 1** (User Confirmation)
   - Takes 15 minutes
   - No database changes
   - User sees issuer info before accepting

### For Production:

2. **Add Option 2** (Local Trust Registry)
   - Database version bump
   - Trust management UI
   - Remember user's trust decisions

3. **(Optional) Add Option 3** (Global Registry)
   - Create registry JSON file
   - Host on GitHub/CDN
   - Fetch and cache locally

---

## Summary

**Your Question:**
> "so i would need for this to work to add issuer did, am i correct?"

**Answer:**
- ❌ **No, you don't NEED to** - it works now without trust checks
- ✅ **But you SHOULD add trust** - for security and production use
- 🎯 **Start with Option 1** - show issuer, let user decide
- 🚀 **Upgrade to Option 2** - for better UX and security

The system works cryptographically without trust checks, but you'll want trust validation for real-world use!
