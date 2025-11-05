/**
 * Credential Verifier - Verification Logic
 *
 * Verifies Verifiable Credentials (VCs) and Verifiable Presentations (VPs)
 * using did-jwt-vc library. Validates signatures and displays claims.
 */

import { verifyCredential } from 'did-jwt-vc';
import { Resolver } from 'did-resolver';
import { getResolver } from 'key-did-resolver';

// Verifier profiles
let verifierProfiles = [];
let currentVerifier = null;

// DID resolver for verification
const resolver = new Resolver(getResolver());

/**
 * Initialize verifier system
 */
async function initializeVerifier() {
  try {
    // Load verifier profiles
    const response = await fetch('./verifiers.json');
    const data = await response.json();
    verifierProfiles = data.verifiers;

    // Populate verifier selector
    populateVerifierSelector();

    // Select first verifier by default
    if (verifierProfiles.length > 0) {
      selectVerifier(verifierProfiles[0].id);
    }

    console.log('✅ Verifier initialized with', verifierProfiles.length, 'profiles');

  } catch (error) {
    console.error('Failed to initialize verifier:', error);
    alert('Failed to load verifier profiles. Check console for details.');
  }
}

/**
 * Populate verifier selector dropdown
 */
function populateVerifierSelector() {
  const selector = document.getElementById('verifierSelector');

  selector.innerHTML = verifierProfiles.map(verifier => `
    <option value="${verifier.id}">
      ${verifier.icon} ${verifier.name}
    </option>
  `).join('');

  selector.addEventListener('change', (e) => {
    selectVerifier(e.target.value);
  });
}

/**
 * Select a verifier profile
 */
function selectVerifier(verifierId) {
  currentVerifier = verifierProfiles.find(v => v.id === verifierId);

  if (!currentVerifier) return;

  // Update UI
  document.getElementById('verifierName').textContent = currentVerifier.name;
  document.getElementById('verifierDescription').textContent = currentVerifier.description;
  document.getElementById('verifierPurpose').textContent = currentVerifier.purpose;
  document.getElementById('verifierNote').textContent = currentVerifier.note;

  console.log(`✅ Selected verifier: ${currentVerifier.name}`);
}

/**
 * Verify a credential JWT
 */
async function verifyCredentialJWT(jwt) {
  try {
    // Show loading state
    showResult('verifying', 'Verifying credential...', null);

    // Verify the credential
    const verified = await verifyCredential(jwt, resolver);

    // Extract information
    const vc = verified.verifiableCredential;
    const payload = verified.payload;
    const issuer = verified.issuer;

    // Extract credential type
    const types = vc.type.filter(t => t !== 'VerifiableCredential');
    const credentialType = types[0] || 'UnknownType';

    // Check if this is a minimal disclosure credential
    const isMinimalDisclosure = types.includes('MinimalDisclosure');

    // Extract claims
    const claims = vc.credentialSubject;
    const claimsObj = {...claims};
    delete claimsObj.id; // Remove ID from display

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp && payload.exp < now;
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
    const issuedAt = payload.nbf ? new Date(payload.nbf * 1000) : new Date(payload.iat * 1000);

    // Build result object
    const result = {
      valid: !isExpired,
      credentialType,
      issuer,
      isMinimalDisclosure,
      claims: claimsObj,
      issuedAt,
      expiresAt,
      isExpired,
      verifiedAt: new Date()
    };

    // Show result
    if (result.valid) {
      showResult('success', 'Credential Verified ✓', result);
    } else {
      showResult('expired', 'Credential Expired', result);
    }

    return result;

  } catch (error) {
    console.error('Verification failed:', error);
    showResult('error', 'Verification Failed', {
      error: error.message
    });
    return null;
  }
}

/**
 * Show verification result
 */
function showResult(status, message, data) {
  const resultContainer = document.getElementById('verificationResult');
  const resultMessage = document.getElementById('resultMessage');
  const resultDetails = document.getElementById('resultDetails');

  // Show container
  resultContainer.style.display = 'block';
  resultContainer.className = 'result-container';

  // Update message
  resultMessage.textContent = message;

  // Update status styling
  if (status === 'success') {
    resultContainer.classList.add('result-success');
    resultMessage.style.color = '#166534';
  } else if (status === 'error' || status === 'expired') {
    resultContainer.classList.add('result-error');
    resultMessage.style.color = '#991b1b';
  } else {
    resultContainer.classList.add('result-verifying');
    resultMessage.style.color = '#6b7280';
  }

  // Update details
  if (!data) {
    resultDetails.innerHTML = '';
    return;
  }

  if (data.error) {
    resultDetails.innerHTML = `
      <div class="error-details">
        <p style="color: #dc2626; margin: 0;">${data.error}</p>
      </div>
    `;
    return;
  }

  // Build details HTML
  let detailsHTML = `
    <div class="credential-info">
      <div class="info-row">
        <span class="info-label">Type:</span>
        <span class="info-value">${data.credentialType}</span>
      </div>
      ${data.isMinimalDisclosure ? `
        <div class="info-row">
          <span class="badge badge-privacy">🔒 Privacy-Preserving</span>
        </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Issuer:</span>
        <span class="info-value" style="font-size: 11px; word-break: break-all;">${data.issuer}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Issued:</span>
        <span class="info-value">${data.issuedAt.toLocaleString()}</span>
      </div>
      ${data.expiresAt ? `
        <div class="info-row">
          <span class="info-label">Expires:</span>
          <span class="info-value ${data.isExpired ? 'text-error' : ''}">${data.expiresAt.toLocaleString()}</span>
        </div>
      ` : ''}
    </div>

    <div class="claims-section">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
        Verified Claims
      </h3>
      <div class="claims-list">
        ${Object.entries(data.claims).map(([key, value]) => {
          // Skip derivedFrom metadata in display
          if (key === 'derivedFrom') return '';

          const displayValue = typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : value;

          return `
            <div class="claim-item">
              <div class="claim-key">${key}</div>
              <div class="claim-value">${displayValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="verification-timestamp">
      Verified at ${data.verifiedAt.toLocaleTimeString()}
    </div>
  `;

  resultDetails.innerHTML = detailsHTML;
}

/**
 * Start QR code scanning
 */
async function startScanning() {
  const videoElement = document.getElementById('qrVideo');
  const scanButton = document.getElementById('scanButton');
  const stopButton = document.getElementById('stopButton');
  const scannerContainer = document.getElementById('scannerContainer');
  const resultContainer = document.getElementById('verificationResult');

  try {
    // Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    videoElement.srcObject = stream;
    videoElement.play();

    // Show scanner
    scannerContainer.style.display = 'block';
    scanButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    resultContainer.style.display = 'none';

    // Start scanning loop
    scanQRCode();

  } catch (error) {
    console.error('Camera error:', error);
    alert('Failed to access camera: ' + error.message);
  }
}

/**
 * Stop QR code scanning
 */
function stopScanning() {
  const videoElement = document.getElementById('qrVideo');
  const scanButton = document.getElementById('scanButton');
  const stopButton = document.getElementById('stopButton');
  const scannerContainer = document.getElementById('scannerContainer');

  // Stop video stream
  const stream = videoElement.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  videoElement.srcObject = null;

  // Hide scanner
  scannerContainer.style.display = 'none';
  scanButton.style.display = 'inline-block';
  stopButton.style.display = 'none';
}

/**
 * Scan QR code from video
 */
function scanQRCode() {
  const videoElement = document.getElementById('qrVideo');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Set canvas size to video size
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  // Draw current video frame
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Get image data
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  // Try to decode QR code using jsQR library
  try {
    // Note: This is a placeholder - actual QR scanning would require jsQR library
    // For now, provide manual input option
    console.log('Scanning...');
  } catch (error) {
    console.error('QR scan error:', error);
  }

  // Continue scanning if video is still playing
  if (videoElement.srcObject) {
    requestAnimationFrame(scanQRCode);
  }
}

/**
 * Handle manual JWT input
 */
async function handleManualInput() {
  const input = document.getElementById('manualJwtInput').value.trim();

  if (!input) {
    alert('Please paste a credential JWT');
    return;
  }

  await verifyCredentialJWT(input);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeVerifier();

  // Setup event listeners
  document.getElementById('scanButton').addEventListener('click', startScanning);
  document.getElementById('stopButton').addEventListener('click', stopScanning);
  document.getElementById('verifyManualButton').addEventListener('click', handleManualInput);
});

// Export for use in HTML
window.verifierApp = {
  verifyCredentialJWT,
  startScanning,
  stopScanning,
  handleManualInput
};
