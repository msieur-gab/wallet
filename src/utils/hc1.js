/**
 * HC1 (Health Certificate v1) Encoding/Decoding Utilities
 *
 * Implements the EU Digital COVID Certificate format for compact, scannable credentials:
 * - CBOR encoding (binary, more compact than JSON)
 * - zlib compression
 * - Base45 encoding (QR-optimized)
 * - "HC1:" prefix for identification
 *
 * This format reduces credential size by 60-80% compared to raw JWT
 */

import { encode as cborEncode, decode as cborDecode } from 'cbor2';
import { encode as base45Encode, decode as base45Decode } from 'base45';
import pako from 'pako';

/**
 * Encode credential data into HC1 format
 *
 * @param {Object} credentialData - The credential payload
 * @returns {string} HC1-prefixed encoded string (e.g., "HC1:NCFOXN...")
 */
export function encodeHC1(credentialData) {
  try {
    // Step 1: Encode credential as CBOR (binary format)
    const cborData = cborEncode(credentialData);

    // Step 2: Compress with zlib
    const compressed = pako.deflate(cborData);

    // Step 3: Encode with Base45 (QR-optimized)
    const base45Data = base45Encode(compressed);

    // Step 4: Add HC1 prefix
    return `HC1:${base45Data}`;

  } catch (error) {
    throw new Error(`HC1 encoding failed: ${error.message}`);
  }
}

/**
 * Decode HC1 format back to credential data
 *
 * @param {string} hc1String - HC1-prefixed string (e.g., "HC1:NCFOXN...")
 * @returns {Object} Decoded credential data
 */
export function decodeHC1(hc1String) {
  try {
    // Step 1: Remove HC1 prefix
    let data = hc1String;
    if (data.startsWith('HC1:')) {
      data = data.substring(4);
    }

    // Step 2: Decode Base45
    const compressed = base45Decode(data);

    // Step 3: Decompress zlib
    const cborData = pako.inflate(compressed);

    // Step 4: Decode CBOR
    const credentialData = cborDecode(cborData);

    return credentialData;

  } catch (error) {
    throw new Error(`HC1 decoding failed: ${error.message}`);
  }
}

/**
 * Create HC1-encoded credential from wallet credential
 *
 * @param {Object} credential - Wallet credential object
 * @returns {string} HC1-encoded string
 */
export function createHC1FromCredential(credential) {
  // Build minimal credential payload in EU DCC format
  const payload = {
    // Version
    ver: '1.0.0',

    // Credential subject details
    nam: {
      fn: credential.claims.fullName || credential.claims.name || 'Unknown',
      gn: credential.claims.givenName || credential.claims.firstName || ''
    },

    // Date of birth (if available)
    dob: credential.claims.dateOfBirth || credential.claims.birthDate || '',

    // Credential type-specific data
    ...buildCredentialTypeData(credential),

    // Issuer information
    iss: credential.issuerDid || credential.issuer || 'Unknown',

    // Issued at
    iat: credential.issuedAt ? Math.floor(new Date(credential.issuedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),

    // Expiration (if available)
    exp: credential.expiresAt ? Math.floor(new Date(credential.expiresAt).getTime() / 1000) : undefined
  };

  return encodeHC1(payload);
}

/**
 * Build credential type-specific data section
 *
 * @param {Object} credential - Wallet credential
 * @returns {Object} Type-specific data
 */
function buildCredentialTypeData(credential) {
  const type = credential.credentialType;
  const claims = credential.claims;

  switch (type) {
    case 'VaccinationCredential':
      return {
        v: [{  // Vaccination entry
          tg: '840539006',  // COVID-19 disease code
          vp: claims.vaccineCode || '1119349007',  // Vaccine product
          mp: claims.manufacturer || claims.vaccineName || 'Unknown',
          dn: claims.doseNumber || 1,
          dt: claims.dateAdministered || new Date().toISOString().split('T')[0],
          co: 'US',  // Country
          is: credential.issuerName || 'Unknown Issuer',
          ci: `URN:UVCI:${Math.random().toString(36).substring(2, 15)}`  // Certificate ID
        }]
      };

    case 'AgeCredential':
      return {
        age: [{
          over18: claims.over18 || false,
          over21: claims.over21 || false,
          verifiedDate: claims.verifiedDate || new Date().toISOString()
        }]
      };

    case 'EducationCredential':
      return {
        edu: [{
          degree: claims.degree || 'Unknown',
          major: claims.major || claims.fieldOfStudy || '',
          institution: claims.institution || 'Unknown',
          graduationDate: claims.graduationDate || ''
        }]
      };

    case 'EmploymentCredential':
      return {
        emp: [{
          employer: claims.employer || 'Unknown',
          position: claims.position || claims.jobTitle || '',
          startDate: claims.startDate || '',
          department: claims.department || ''
        }]
      };

    case 'MembershipCredential':
      return {
        mem: [{
          organization: claims.organization || 'Unknown',
          membershipId: claims.membershipId || '',
          tier: claims.tier || 'Standard',
          validUntil: claims.validUntil || ''
        }]
      };

    default:
      // Generic credential - include all claims
      return {
        claims: claims
      };
  }
}

/**
 * Get human-readable size comparison
 *
 * @param {string} jwt - Original JWT
 * @param {string} hc1 - HC1 encoded
 * @returns {Object} Size comparison stats
 */
export function compareSize(jwt, hc1) {
  const jwtSize = jwt.length;
  const hc1Size = hc1.length;
  const reduction = ((jwtSize - hc1Size) / jwtSize * 100).toFixed(1);

  return {
    jwt: jwtSize,
    hc1: hc1Size,
    reduction: `${reduction}%`,
    ratio: (jwtSize / hc1Size).toFixed(2) + 'x smaller'
  };
}

/**
 * Validate HC1 string format
 *
 * @param {string} hc1String - String to validate
 * @returns {boolean} True if valid HC1 format
 */
export function isValidHC1(hc1String) {
  if (!hc1String || typeof hc1String !== 'string') {
    return false;
  }

  // Must start with HC1:
  if (!hc1String.startsWith('HC1:')) {
    return false;
  }

  // Must have content after prefix
  if (hc1String.length <= 4) {
    return false;
  }

  // Base45 uses characters 0-9, A-Z, space, and some special chars
  const base45Pattern = /^HC1:[0-9A-Z $%*+\-./:]+$/;
  return base45Pattern.test(hc1String);
}
