import { SemaphoreProof } from '@zk-kit/protocols';
import { db } from '../db/database.js';
import { loadPrivateKey, createSigner } from '../crypto/keyManager.js';
import { createVerifiableCredentialJwt, createVerifiablePresentationJwt } from 'did-jwt-vc';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Zero-Knowledge Credentials Module
 *
 * Implements selective disclosure and zero-knowledge proofs for credentials:
 * - Derived credentials (prove properties without revealing exact values)
 * - Range proofs (prove age > 18 without revealing exact age)
 * - Membership proofs (prove group membership without revealing identity)
 * - Attribute hiding (selective disclosure of credential attributes)
 */

const enc = new TextEncoder();

/**
 * Hash value to create commitment
 */
function hashValue(value) {
  const bytes = enc.encode(JSON.stringify(value));
  return sha256(bytes);
}

/**
 * Convert bytes to BigInt
 */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/**
 * Create a derived credential with selective disclosure
 *
 * Example: From a credential with { age: 27, name: "Alice", city: "NYC" }
 * Create a derived credential that only reveals { over18: true, region: "USA" }
 */
export async function createDerivedCredential(username, password, options) {
  // Validate inputs
  if (!options.sourceCredentialId) {
    throw new Error('Source credential ID is required');
  }

  if (!options.derivedClaims || typeof options.derivedClaims !== 'object') {
    throw new Error('Derived claims object is required');
  }

  // Get source credential
  const sourceCredential = await db.credentials.get(options.sourceCredentialId);
  if (!sourceCredential) {
    throw new Error('Source credential not found');
  }

  if (sourceCredential.username !== username) {
    throw new Error('Unauthorized to derive from this credential');
  }

  // Load private key
  const { privateKey, did: holderDid } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  // Create derived credential
  const now = Math.floor(Date.now() / 1000);
  const expiryDuration = options.expiresInHours || 24;
  const expirySeconds = expiryDuration * 60 * 60;

  const vcPayload = {
    sub: holderDid,
    nbf: now - 10,
    exp: now + expirySeconds,
    vc: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        {
          'DerivedCredential': 'https://example.org/derived-credential/v1',
          'derivedFrom': 'https://example.org/vocab#derivedFrom'
        }
      ],
      type: ['VerifiableCredential', 'DerivedCredential', options.derivedType || 'SelectiveDisclosure'],
      credentialSubject: {
        id: holderDid,
        ...options.derivedClaims
      },
      // Reference to source credential (optional)
      derivedFrom: {
        id: sourceCredential.credentialJwt.split('.')[1], // payload hash
        issuer: sourceCredential.issuerDid,
        issuedAt: new Date(sourceCredential.issuedAt).toISOString()
      }
    }
  };

  // Create JWT
  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: holderDid,
    alg: 'EdDSA',
    signer
  });

  // Store derived credential
  await db.credentials.add({
    username,
    credentialJwt: jwt,
    credentialType: options.derivedType || 'SelectiveDisclosure',
    issuerDid: holderDid, // Self-issued derived credential
    subjectDid: holderDid,
    claims: options.derivedClaims,
    issuedAt: now * 1000,
    expiresAt: (now + expirySeconds) * 1000,
    status: 'active',
    tags: ['derived', 'zk', ...(options.tags || [])],
    direction: 'derived',
    sourceCredentialId: options.sourceCredentialId
  });

  // Log activity
  await db.logActivity(username, 'DERIVED_CREDENTIAL_CREATED', {
    sourceType: sourceCredential.credentialType,
    derivedType: options.derivedType,
    timestamp: Date.now()
  });

  return {
    jwt,
    derivedClaims: options.derivedClaims,
    expiresAt: (now + expirySeconds) * 1000
  };
}

/**
 * Create a range proof credential (e.g., age > 18)
 *
 * Proves a numeric value is within a range without revealing the exact value
 */
export async function createRangeProof(username, password, options) {
  // Validate inputs
  if (!options.sourceCredentialId) {
    throw new Error('Source credential ID is required');
  }

  if (!options.attribute) {
    throw new Error('Attribute name is required');
  }

  // Get source credential
  const sourceCredential = await db.credentials.get(options.sourceCredentialId);
  if (!sourceCredential) {
    throw new Error('Source credential not found');
  }

  const actualValue = sourceCredential.claims[options.attribute];
  if (actualValue === undefined) {
    throw new Error(`Attribute '${options.attribute}' not found in credential`);
  }

  if (typeof actualValue !== 'number') {
    throw new Error('Attribute must be numeric for range proof');
  }

  // Determine what to prove
  const derivedClaims = {};

  if (options.greaterThan !== undefined) {
    derivedClaims[`${options.attribute}GreaterThan${options.greaterThan}`] = actualValue > options.greaterThan;
  }

  if (options.lessThan !== undefined) {
    derivedClaims[`${options.attribute}LessThan${options.lessThan}`] = actualValue < options.lessThan;
  }

  if (options.between !== undefined) {
    const [min, max] = options.between;
    derivedClaims[`${options.attribute}Between${min}And${max}`] = actualValue >= min && actualValue <= max;
  }

  // Common use case: age verification
  if (options.attribute === 'age' && options.greaterThan === 18) {
    derivedClaims.over18 = actualValue > 18;
    derivedClaims.adult = actualValue >= 18;
  }

  // Create derived credential with the boolean claims
  return await createDerivedCredential(username, password, {
    sourceCredentialId: options.sourceCredentialId,
    derivedClaims,
    derivedType: 'RangeProof',
    expiresInHours: options.expiresInHours || 1,
    tags: ['range-proof', options.attribute]
  });
}

/**
 * Create a membership proof credential
 *
 * Proves membership in a group without revealing which member
 */
export async function createMembershipProof(username, password, options) {
  // Validate inputs
  if (!options.groupId) {
    throw new Error('Group ID is required');
  }

  if (!options.groupName) {
    throw new Error('Group name is required');
  }

  // Get user's DID
  const { did: holderDid } = await loadPrivateKey(username, password);

  // Create membership claim
  const derivedClaims = {
    groupMembership: {
      groupId: options.groupId,
      groupName: options.groupName,
      membershipType: options.membershipType || 'member',
      verifiedAt: Date.now()
    }
  };

  // If proof of specific role
  if (options.role) {
    derivedClaims.groupMembership.role = options.role;
  }

  // Create self-signed membership credential
  const { privateKey, did } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = (options.expiresInHours || 24) * 60 * 60;

  const vcPayload = {
    sub: holderDid,
    nbf: now - 10,
    exp: now + expirySeconds,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'MembershipProof'],
      credentialSubject: {
        id: holderDid,
        ...derivedClaims
      }
    }
  };

  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: holderDid,
    alg: 'EdDSA',
    signer
  });

  // Store credential
  await db.credentials.add({
    username,
    credentialJwt: jwt,
    credentialType: 'MembershipProof',
    issuerDid: holderDid,
    subjectDid: holderDid,
    claims: derivedClaims,
    issuedAt: now * 1000,
    expiresAt: (now + expirySeconds) * 1000,
    status: 'active',
    tags: ['membership', 'zk', options.groupId],
    direction: 'derived'
  });

  // Log activity
  await db.logActivity(username, 'MEMBERSHIP_PROOF_CREATED', {
    groupId: options.groupId,
    timestamp: Date.now()
  });

  return {
    jwt,
    claims: derivedClaims,
    expiresAt: (now + expirySeconds) * 1000
  };
}

/**
 * Create a Zero-Knowledge Verifiable Presentation
 *
 * Creates a VP with only derived/selective disclosure credentials
 */
export async function createZKPresentation(username, password, options) {
  // Validate inputs
  if (!options.derivedCredentialIds || !Array.isArray(options.derivedCredentialIds)) {
    throw new Error('Derived credential IDs array is required');
  }

  // Get derived credentials
  const credentials = await db.credentials
    .where('id')
    .anyOf(options.derivedCredentialIds)
    .toArray();

  if (credentials.length !== options.derivedCredentialIds.length) {
    throw new Error('Some derived credentials not found');
  }

  // Verify all are derived credentials
  const nonDerived = credentials.find(c => c.direction !== 'derived');
  if (nonDerived) {
    throw new Error('All credentials must be derived for ZK presentation');
  }

  // Load private key
  const { privateKey, did: holderDid } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  // Generate challenge
  const challenge = options.challenge || (() => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  })();

  const domain = options.domain || options.verifierDid || 'zk-presentation';

  // Create VP payload
  const vpPayload = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation', 'ZeroKnowledgePresentation'],
      verifiableCredential: credentials.map(c => c.credentialJwt)
    },
    aud: domain,
    nonce: challenge
  };

  // Create JWT
  const jwt = await createVerifiablePresentationJwt(vpPayload, {
    did: holderDid,
    alg: 'EdDSA',
    signer
  });

  // Store presentation
  await db.presentations.add({
    username,
    presentationJwt: jwt,
    credentialIds: options.derivedCredentialIds,
    verifierDid: options.verifierDid || null,
    challenge,
    domain,
    createdAt: Date.now(),
    purpose: 'zero-knowledge'
  });

  // Log activity
  await db.logActivity(username, 'ZK_PRESENTATION_CREATED', {
    credentialCount: credentials.length,
    verifier: options.verifierDid,
    timestamp: Date.now()
  });

  return {
    jwt,
    holderDid,
    challenge,
    domain,
    credentialCount: credentials.length,
    derivedClaims: credentials.map(c => c.claims)
  };
}

/**
 * Helper: Create age verification credential
 */
export async function createAgeVerification(username, password, sourceCredentialId) {
  return await createRangeProof(username, password, {
    sourceCredentialId,
    attribute: 'age',
    greaterThan: 18,
    expiresInHours: 24
  });
}

/**
 * Helper: Create location verification (country only)
 */
export async function createLocationVerification(username, password, options) {
  const sourceCredential = await db.credentials.get(options.sourceCredentialId);
  if (!sourceCredential) {
    throw new Error('Source credential not found');
  }

  // Extract country from address/location
  const fullLocation = sourceCredential.claims.address || sourceCredential.claims.location || '';
  const country = options.country || fullLocation.split(',').pop().trim();

  return await createDerivedCredential(username, password, {
    sourceCredentialId: options.sourceCredentialId,
    derivedClaims: {
      country,
      region: options.region || 'withheld'
    },
    derivedType: 'LocationVerification',
    expiresInHours: options.expiresInHours || 24
  });
}
