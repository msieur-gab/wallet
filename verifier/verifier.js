/**
 * HC1 Credential Verifier
 *
 * Decodes and verifies HC1-encoded credentials from wallet QR codes
 */

import { decode as base45Decode } from 'https://esm.sh/base45@3.0.0';
import { decode as cborDecode } from 'https://esm.sh/cbor2@1.5.1';
import pako from 'https://esm.sh/pako@2.1.0';

/**
 * Decode HC1 credential string
 *
 * @param {string} hc1String - HC1-prefixed encoded string
 * @returns {Object} Decoded credential data
 */
export function decodeHC1(hc1String) {
  try {
    // Step 1: Remove HC1 prefix
    let data = hc1String.trim();
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
 * Verify and display HC1 credential
 *
 * @param {string} hc1Data - HC1 credential string from QR code
 */
export async function verifyHC1Credential(hc1Data) {
  const statusEl = document.getElementById('verification-status');
  const resultEl = document.getElementById('verification-result');

  try {
    // Show verifying status
    statusEl.innerHTML = `
      <div class="status-verifying">
        <div class="spinner"></div>
        <p>Verifying credential...</p>
      </div>
    `;
    resultEl.innerHTML = '';

    // Decode HC1
    const credential = decodeHC1(hc1Data);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const isExpired = credential.exp && credential.exp < now;

    if (isExpired) {
      showExpiredResult(credential);
    } else {
      showSuccessResult(credential);
    }

  } catch (error) {
    showErrorResult(error.message);
  }
}

/**
 * Show successful verification result
 */
function showSuccessResult(credential) {
  const statusEl = document.getElementById('verification-status');
  const resultEl = document.getElementById('verification-result');

  statusEl.innerHTML = `
    <div class="status-success">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <h2>Credential Verified ✓</h2>
      <p>This credential is valid and authentic</p>
    </div>
  `;

  resultEl.innerHTML = buildCredentialDisplay(credential, false);
}

/**
 * Show expired credential result
 */
function showExpiredResult(credential) {
  const statusEl = document.getElementById('verification-status');
  const resultEl = document.getElementById('verification-result');

  statusEl.innerHTML = `
    <div class="status-expired">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2>Credential Expired</h2>
      <p>This credential is no longer valid</p>
    </div>
  `;

  resultEl.innerHTML = buildCredentialDisplay(credential, true);
}

/**
 * Show error result
 */
function showErrorResult(errorMessage) {
  const statusEl = document.getElementById('verification-status');
  const resultEl = document.getElementById('verification-result');

  statusEl.innerHTML = `
    <div class="status-error">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <h2>Verification Failed</h2>
      <p>${errorMessage}</p>
    </div>
  `;

  resultEl.innerHTML = '';
}

/**
 * Build credential display HTML
 */
function buildCredentialDisplay(credential, isExpired) {
  const credType = detectCredentialType(credential);

  return `
    <div class="credential-details">
      <div class="detail-section">
        <h3>Credential Information</h3>
        <div class="detail-row">
          <span class="detail-label">Type:</span>
          <span class="detail-value">${credType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Version:</span>
          <span class="detail-value">${credential.ver || 'Unknown'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Issuer:</span>
          <span class="detail-value">${credential.iss || 'Unknown'}</span>
        </div>
      </div>

      <div class="detail-section">
        <h3>Subject Information</h3>
        ${buildSubjectInfo(credential)}
      </div>

      <div class="detail-section">
        <h3>Claims</h3>
        ${buildClaimsInfo(credential)}
      </div>

      <div class="detail-section">
        <h3>Validity</h3>
        <div class="detail-row">
          <span class="detail-label">Issued:</span>
          <span class="detail-value">${credential.iat ? new Date(credential.iat * 1000).toLocaleString() : 'Unknown'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Expires:</span>
          <span class="detail-value ${isExpired ? 'expired' : ''}">${credential.exp ? new Date(credential.exp * 1000).toLocaleString() : 'Never'}</span>
        </div>
      </div>

      ${credential.claims ? buildRawDataSection(credential) : ''}
    </div>
  `;
}

/**
 * Detect credential type from data
 */
function detectCredentialType(credential) {
  if (credential.v) return 'Vaccination Credential';
  if (credential.age) return 'Age Credential';
  if (credential.edu) return 'Education Credential';
  if (credential.emp) return 'Employment Credential';
  if (credential.mem) return 'Membership Credential';
  return 'Generic Credential';
}

/**
 * Build subject information HTML
 */
function buildSubjectInfo(credential) {
  if (!credential.nam) {
    return '<p class="detail-value">No subject information available</p>';
  }

  return `
    <div class="detail-row">
      <span class="detail-label">Full Name:</span>
      <span class="detail-value">${credential.nam.fn || 'Unknown'}</span>
    </div>
    ${credential.nam.gn ? `
    <div class="detail-row">
      <span class="detail-label">Given Name:</span>
      <span class="detail-value">${credential.nam.gn}</span>
    </div>
    ` : ''}
    ${credential.dob ? `
    <div class="detail-row">
      <span class="detail-label">Date of Birth:</span>
      <span class="detail-value">${credential.dob}</span>
    </div>
    ` : ''}
  `;
}

/**
 * Build claims information HTML
 */
function buildClaimsInfo(credential) {
  // Vaccination
  if (credential.v && credential.v.length > 0) {
    const vax = credential.v[0];
    return `
      <div class="detail-row">
        <span class="detail-label">Vaccine Product:</span>
        <span class="detail-value">${vax.mp || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dose Number:</span>
        <span class="detail-value">${vax.dn || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date Administered:</span>
        <span class="detail-value">${vax.dt || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Country:</span>
        <span class="detail-value">${vax.co || 'Unknown'}</span>
      </div>
    `;
  }

  // Age
  if (credential.age && credential.age.length > 0) {
    const age = credential.age[0];
    return `
      <div class="detail-row">
        <span class="detail-label">Over 18:</span>
        <span class="detail-value">${age.over18 ? 'Yes' : 'No'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Over 21:</span>
        <span class="detail-value">${age.over21 ? 'Yes' : 'No'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Verified Date:</span>
        <span class="detail-value">${age.verifiedDate || 'Unknown'}</span>
      </div>
    `;
  }

  // Education
  if (credential.edu && credential.edu.length > 0) {
    const edu = credential.edu[0];
    return `
      <div class="detail-row">
        <span class="detail-label">Degree:</span>
        <span class="detail-value">${edu.degree || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Major:</span>
        <span class="detail-value">${edu.major || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Institution:</span>
        <span class="detail-value">${edu.institution || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Graduation Date:</span>
        <span class="detail-value">${edu.graduationDate || 'Unknown'}</span>
      </div>
    `;
  }

  // Employment
  if (credential.emp && credential.emp.length > 0) {
    const emp = credential.emp[0];
    return `
      <div class="detail-row">
        <span class="detail-label">Employer:</span>
        <span class="detail-value">${emp.employer || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Position:</span>
        <span class="detail-value">${emp.position || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Start Date:</span>
        <span class="detail-value">${emp.startDate || 'Unknown'}</span>
      </div>
      ${emp.department ? `
      <div class="detail-row">
        <span class="detail-label">Department:</span>
        <span class="detail-value">${emp.department}</span>
      </div>
      ` : ''}
    `;
  }

  // Membership
  if (credential.mem && credential.mem.length > 0) {
    const mem = credential.mem[0];
    return `
      <div class="detail-row">
        <span class="detail-label">Organization:</span>
        <span class="detail-value">${mem.organization || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Membership ID:</span>
        <span class="detail-value">${mem.membershipId || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Tier:</span>
        <span class="detail-value">${mem.tier || 'Unknown'}</span>
      </div>
      ${mem.validUntil ? `
      <div class="detail-row">
        <span class="detail-label">Valid Until:</span>
        <span class="detail-value">${mem.validUntil}</span>
      </div>
      ` : ''}
    `;
  }

  // Generic claims
  if (credential.claims) {
    return Object.entries(credential.claims).map(([key, value]) => `
      <div class="detail-row">
        <span class="detail-label">${key}:</span>
        <span class="detail-value">${JSON.stringify(value)}</span>
      </div>
    `).join('');
  }

  return '<p class="detail-value">No claims available</p>';
}

/**
 * Build raw data section (for debugging)
 */
function buildRawDataSection(credential) {
  return `
    <div class="detail-section">
      <h3>Raw Data (Debug)</h3>
      <pre class="raw-data">${JSON.stringify(credential, null, 2)}</pre>
    </div>
  `;
}
