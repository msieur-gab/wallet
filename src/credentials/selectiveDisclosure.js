/**
 * Selective Disclosure Module
 *
 * Creates privacy-preserving credential JWTs with minimal claims
 * for selective disclosure scenarios.
 */

import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { loadPrivateKey, createSigner } from '../crypto/keyManager.js';
import { getMinimalClaims } from './privacySchema.js';

/**
 * Create a minimal credential JWT for privacy-first sharing
 *
 * Takes an existing credential and creates a new JWT with only
 * minimal claims based on the privacy schema.
 *
 * @param {string} username - Current user
 * @param {string} password - User password for key access
 * @param {Object} credential - Full credential from database
 * @returns {Promise<string>} Minimal credential JWT
 */
export async function createMinimalCredentialJWT(username, password, credential) {
  // Load private key
  const { privateKey, did: holderDid } = await loadPrivateKey(username, password);
  const signer = createSigner(privateKey);

  // Get minimal claims based on credential type
  const minimalClaims = getMinimalClaims(credential.credentialType, credential.claims);

  // Create a new credential with only minimal claims
  const now = Math.floor(Date.now() / 1000);

  // Use same expiry as original credential if available
  let expiryTime;
  if (credential.expiresAt) {
    expiryTime = Math.floor(credential.expiresAt / 1000);
  } else {
    expiryTime = now + (365 * 24 * 60 * 60); // 1 year default
  }

  const vcPayload = {
    sub: holderDid,
    nbf: now - 10,
    exp: expiryTime,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', credential.credentialType, 'MinimalDisclosure'],
      credentialSubject: {
        id: holderDid,
        ...minimalClaims,
        // Reference to original credential
        derivedFrom: {
          issuer: credential.issuerDid,
          type: credential.credentialType
        }
      },
      // Add metadata to indicate this is a minimal disclosure
      credentialSchema: {
        id: 'minimal-disclosure-v1',
        type: 'PrivacyPreservingCredential'
      }
    }
  };

  // Create JWT - signed by holder (self-issued selective disclosure)
  // Note: This is a derived credential signed by the holder, not the original issuer
  const jwt = await createVerifiableCredentialJwt(vcPayload, {
    did: holderDid,
    alg: 'EdDSA',
    signer
  });

  return jwt;
}

/**
 * Get credential JWT - either full or minimal based on privacy mode
 *
 * @param {string} username - Current user
 * @param {string} password - User password
 * @param {Object} credential - Full credential from database
 * @param {boolean} privacyMode - True for minimal claims, false for full
 * @returns {Promise<string>} Credential JWT
 */
export async function getCredentialJWT(username, password, credential, privacyMode = false) {
  if (privacyMode) {
    return await createMinimalCredentialJWT(username, password, credential);
  } else {
    return credential.credentialJwt;
  }
}
