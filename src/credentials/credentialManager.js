import { Resolver } from 'did-resolver';
import { getResolver as keyDidResolver } from 'key-did-resolver';
import {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyCredential,
  verifyPresentation
} from 'did-jwt-vc';
import { db } from '../db/database.js';
import { loadPrivateKey, createSigner } from '../crypto/keyManager.js';
import { getContact } from '../contacts/contactManager.js';

/**
 * Credential Management Module
 *
 * Handles Verifiable Credentials and Verifiable Presentations:
 * - Issue VCs to contacts
 * - Receive VCs from others
 * - Create VPs for verification
 * - Verify incoming VCs and VPs
 */

// DID resolver for verification
const resolver = new Resolver(keyDidResolver());

/**
 * Generate random bytes as base64url
 */
function randomBase64url(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Issue a Verifiable Credential
 */
export async function issueCredential(username, password, credentialData) {
  // Validate required fields
  if (!credentialData.subjectDid) {
    throw new Error('Subject DID is required');
  }

  if (!credentialData.claims || typeof credentialData.claims !== 'object') {
    throw new Error('Claims object is required');
  }

  if (!credentialData.type) {
    throw new Error('Credential type is required');
  }

  // Load private key for signing
  const { privateKey, did: issuerDid } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  // Prepare credential payload
  const now = Math.floor(Date.now() / 1000);
  const expiryDuration = credentialData.expiresInDays || 365;
  const expirySeconds = expiryDuration * 24 * 60 * 60;

  const vcPayload = {
    sub: credentialData.subjectDid,
    nbf: now - 10, // Not before (with 10s buffer)
    exp: now + expirySeconds,
    vc: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        ...(credentialData.additionalContexts || [])
      ],
      type: ['VerifiableCredential', credentialData.type],
      credentialSubject: {
        id: credentialData.subjectDid,
        ...credentialData.claims
      }
    }
  };

  // Add optional fields
  if (credentialData.credentialId) {
    vcPayload.jti = credentialData.credentialId;
  }

  // Create JWT
  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: issuerDid,
    alg: 'EdDSA',
    signer
  });

  // Store credential
  await db.credentials.add({
    username,
    credentialJwt: jwt,
    credentialType: credentialData.type,
    issuerDid,
    subjectDid: credentialData.subjectDid,
    claims: credentialData.claims,
    issuedAt: now * 1000,
    expiresAt: (now + expirySeconds) * 1000,
    status: 'active',
    tags: credentialData.tags || [],
    direction: 'issued' // This user issued it
  });

  // Log activity
  await db.logActivity(username, 'CREDENTIAL_ISSUED', {
    type: credentialData.type,
    subject: credentialData.subjectDid,
    timestamp: Date.now()
  });

  return {
    jwt,
    issuerDid,
    subjectDid: credentialData.subjectDid,
    type: credentialData.type,
    expiresAt: (now + expirySeconds) * 1000
  };
}

/**
 * Receive and verify a Verifiable Credential
 */
export async function receiveCredential(username, jwt, options = {}) {
  // Verify the credential
  let verified;
  try {
    verified = await verifyCredential(jwt, resolver);
  } catch (error) {
    throw new Error(`Credential verification failed: ${error.message}`);
  }

  const vc = verified.verifiableCredential;
  const payload = verified.payload;

  // Extract credential data
  const credentialType = vc.type.find(t => t !== 'VerifiableCredential') || 'UnknownType';
  const issuerDid = verified.issuer;
  const subjectDid = payload.sub || vc.credentialSubject.id;

  // Extract issuer name and domain from VC (if provided by issuer)
  const issuerName = vc.issuerName || 'Unknown Issuer';
  const issuerDomain = vc.issuerDomain || '';

  // Check if credential already exists
  const existing = await db.credentials
    .where('credentialJwt')
    .equals(jwt)
    .first();

  if (existing) {
    return {
      message: 'Credential already exists',
      credential: existing
    };
  }

  // Store credential
  await db.credentials.add({
    username,
    credentialJwt: jwt,
    credentialType,
    issuerDid,
    issuerName,
    issuerDomain,
    subjectDid,
    claims: vc.credentialSubject,
    issuedAt: (payload.nbf || payload.iat) * 1000,
    expiresAt: payload.exp ? payload.exp * 1000 : null,
    status: 'active',
    tags: options.tags || [],
    direction: 'received' // This user received it
  });

  // Log activity
  await db.logActivity(username, 'CREDENTIAL_RECEIVED', {
    type: credentialType,
    issuer: issuerDid,
    timestamp: Date.now()
  });

  return {
    message: 'Credential received and verified',
    issuerDid,
    subjectDid,
    type: credentialType,
    claims: vc.credentialSubject
  };
}

/**
 * Create a Verifiable Presentation
 */
export async function createPresentation(username, password, presentationData) {
  // Validate required fields
  if (!presentationData.credentialIds || !Array.isArray(presentationData.credentialIds)) {
    throw new Error('Credential IDs array is required');
  }

  if (presentationData.credentialIds.length === 0) {
    throw new Error('At least one credential must be included');
  }

  // Load private key for signing
  const { privateKey, did: holderDid } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  // Get credentials from database
  const credentials = await db.credentials
    .where('id')
    .anyOf(presentationData.credentialIds)
    .toArray();

  if (credentials.length !== presentationData.credentialIds.length) {
    throw new Error('Some credentials not found');
  }

  // Extract JWTs
  const credentialJwts = credentials.map(c => c.credentialJwt);

  // Generate challenge if not provided
  const challenge = presentationData.challenge || randomBase64url(16);
  const domain = presentationData.domain || presentationData.verifierDid || 'self-presentation';

  // Create VP payload
  const vpPayload = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: credentialJwts
    },
    aud: domain,
    nonce: challenge
  };

  // Add holder claim if specified
  if (presentationData.holder) {
    vpPayload.vp.holder = holderDid;
  }

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
    credentialIds: presentationData.credentialIds,
    verifierDid: presentationData.verifierDid || null,
    challenge,
    domain,
    createdAt: Date.now(),
    purpose: presentationData.purpose || 'general'
  });

  // Log activity
  await db.logActivity(username, 'PRESENTATION_CREATED', {
    credentialCount: credentialJwts.length,
    verifier: presentationData.verifierDid,
    timestamp: Date.now()
  });

  return {
    jwt,
    holderDid,
    challenge,
    domain,
    credentialCount: credentialJwts.length
  };
}

/**
 * Verify a Verifiable Presentation
 */
export async function verifyPresentationJwt(username, jwt, expectedChallenge, expectedDomain) {
  try {
    const verified = await verifyPresentation(jwt, resolver, {
      challenge: expectedChallenge,
      domain: expectedDomain
    });

    const vp = verified.verifiablePresentation;
    const credentials = vp.verifiableCredential || [];

    // Log activity
    await db.logActivity(username, 'PRESENTATION_VERIFIED', {
      holder: verified.holder,
      credentialCount: credentials.length,
      timestamp: Date.now()
    });

    return {
      valid: true,
      holder: verified.holder,
      credentials: credentials.map(vc => ({
        type: vc.type,
        issuer: vc.issuer,
        credentialSubject: vc.credentialSubject
      })),
      presentation: vp
    };
  } catch (error) {
    // Log failed verification
    await db.logActivity(username, 'PRESENTATION_VERIFICATION_FAILED', {
      error: error.message,
      timestamp: Date.now()
    });

    throw new Error(`Presentation verification failed: ${error.message}`);
  }
}

/**
 * Get all credentials for a user
 */
export async function getCredentials(username, filters = {}) {
  let query = db.credentials.where('username').equals(username);

  const credentials = await query.toArray();

  // Apply filters
  let filtered = credentials;

  if (filters.direction) {
    filtered = filtered.filter(c => c.direction === filters.direction);
  }

  if (filters.status) {
    filtered = filtered.filter(c => c.status === filters.status);
  }

  if (filters.type) {
    filtered = filtered.filter(c => c.credentialType === filters.type);
  }

  if (filters.issuerDid) {
    filtered = filtered.filter(c => c.issuerDid === filters.issuerDid);
  }

  if (filters.tag) {
    filtered = filtered.filter(c => c.tags && c.tags.includes(filters.tag));
  }

  // Filter expired credentials if requested
  if (filters.excludeExpired) {
    const now = Date.now();
    filtered = filtered.filter(c => !c.expiresAt || c.expiresAt > now);
  }

  // Sort by issuance date (newest first)
  filtered.sort((a, b) => b.issuedAt - a.issuedAt);

  return filtered;
}

/**
 * Get a specific credential
 */
export async function getCredential(credentialId) {
  return await db.credentials.get(credentialId);
}

/**
 * Revoke a credential (mark as revoked)
 */
export async function revokeCredential(username, credentialId) {
  const credential = await db.credentials.get(credentialId);

  if (!credential) {
    throw new Error('Credential not found');
  }

  if (credential.username !== username) {
    throw new Error('Unauthorized to revoke this credential');
  }

  if (credential.direction !== 'issued') {
    throw new Error('Can only revoke credentials you issued');
  }

  await db.credentials.update(credentialId, { status: 'revoked' });

  // Log activity
  await db.logActivity(username, 'CREDENTIAL_REVOKED', {
    credentialId,
    type: credential.credentialType,
    timestamp: Date.now()
  });

  return true;
}

/**
 * Delete a credential
 */
export async function deleteCredential(username, credentialId) {
  const credential = await db.credentials.get(credentialId);

  if (!credential) {
    throw new Error('Credential not found');
  }

  if (credential.username !== username) {
    throw new Error('Unauthorized to delete this credential');
  }

  await db.credentials.delete(credentialId);

  // Log activity
  await db.logActivity(username, 'CREDENTIAL_DELETED', {
    credentialId,
    type: credential.credentialType,
    timestamp: Date.now()
  });

  return true;
}

/**
 * Get credential statistics
 */
export async function getCredentialStats(username) {
  const credentials = await getCredentials(username);
  const now = Date.now();

  return {
    total: credentials.length,
    issued: credentials.filter(c => c.direction === 'issued').length,
    received: credentials.filter(c => c.direction === 'received').length,
    active: credentials.filter(c => c.status === 'active').length,
    revoked: credentials.filter(c => c.status === 'revoked').length,
    expired: credentials.filter(c => c.expiresAt && c.expiresAt < now).length,
    types: [...new Set(credentials.map(c => c.credentialType))]
  };
}
