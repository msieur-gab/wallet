import QRCodeStyling from 'qr-code-styling';
import { Html5Qrcode } from 'html5-qrcode';
import { exportPublicProfile } from '../profile/profileManager.js';

/**
 * QR Code Utilities
 *
 * Handles QR code generation and scanning for:
 * - Sharing public profile/DID
 * - Sharing credentials
 * - Adding contacts
 */

/**
 * Generate QR code for user's public profile
 */
export async function generateProfileQR(username, containerElement, options = {}) {
  // Get public profile data
  const profileJson = await exportPublicProfile(username);

  // Create QR code
  const qr = new QRCodeStyling({
    width: options.width || 300,
    height: options.height || 300,
    data: profileJson,
    margin: options.margin || 10,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'M'
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 5
    },
    dotsOptions: {
      type: options.dotsType || 'rounded',
      color: options.color || '#000000'
    },
    backgroundOptions: {
      color: options.backgroundColor || '#ffffff'
    },
    cornersSquareOptions: {
      type: options.cornerSquareType || 'extra-rounded',
      color: options.cornerColor || '#000000'
    },
    cornersDotOptions: {
      type: options.cornerDotType || 'dot',
      color: options.cornerColor || '#000000'
    }
  });

  // Clear container and append QR code
  if (containerElement) {
    containerElement.innerHTML = '';
    qr.append(containerElement);
  }

  return qr;
}

/**
 * Generate QR code for DID only (smaller, faster)
 */
export function generateDidQR(did, containerElement, options = {}) {
  const qr = new QRCodeStyling({
    width: options.width || 250,
    height: options.height || 250,
    data: did,
    margin: options.margin || 10,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'H'
    },
    dotsOptions: {
      type: options.dotsType || 'rounded',
      color: options.color || '#1a1a1a'
    },
    backgroundOptions: {
      color: options.backgroundColor || '#ffffff'
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      color: options.cornerColor || '#1a1a1a'
    }
  });

  if (containerElement) {
    containerElement.innerHTML = '';
    qr.append(containerElement);
  }

  return qr;
}

/**
 * Generate QR code for credential JWT
 */
export function generateCredentialQR(jwt, containerElement, options = {}) {
  const qr = new QRCodeStyling({
    width: options.width || 300,
    height: options.height || 300,
    data: jwt,
    margin: options.margin || 10,
    qrOptions: {
      errorCorrectionLevel: 'M'
    },
    dotsOptions: {
      type: 'dots',
      color: '#2563eb'
    },
    backgroundOptions: {
      color: '#ffffff'
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      color: '#1e40af'
    }
  });

  if (containerElement) {
    containerElement.innerHTML = '';
    qr.append(containerElement);
  }

  return qr;
}

/**
 * Download QR code as image
 */
export async function downloadQR(qr, filename = 'qrcode.png') {
  await qr.download({
    name: filename,
    extension: 'png'
  });
}

/**
 * Scan QR code from camera
 */
export class QRScanner {
  constructor(videoElementId) {
    this.videoElementId = videoElementId;
    this.scanner = null;
    this.isScanning = false;
  }

  /**
   * Start scanning
   */
  async start(onSuccess, onError) {
    if (this.isScanning) {
      throw new Error('Scanner already running');
    }

    this.scanner = new Html5Qrcode(this.videoElementId);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    try {
      await this.scanner.start(
        { facingMode: 'environment' }, // Use back camera
        config,
        (decodedText, decodedResult) => {
          this.isScanning = true;
          if (onSuccess) {
            onSuccess(decodedText, decodedResult);
          }
        },
        (errorMessage) => {
          if (onError) {
            onError(errorMessage);
          }
        }
      );
      this.isScanning = true;
    } catch (err) {
      console.error('Failed to start scanner:', err);
      throw err;
    }
  }

  /**
   * Stop scanning
   */
  async stop() {
    if (this.scanner && this.isScanning) {
      await this.scanner.stop();
      this.isScanning = false;
    }
  }

  /**
   * Check if scanning
   */
  getState() {
    return this.isScanning;
  }
}

/**
 * Parse scanned QR data
 */
export function parseQRData(data) {
  // Try to parse as JSON (profile or credential)
  try {
    const parsed = JSON.parse(data);

    if (parsed.type === 'IdentityWalletProfile') {
      return {
        type: 'profile',
        data: parsed
      };
    }

    return {
      type: 'json',
      data: parsed
    };
  } catch (e) {
    // Not JSON, check if it's a DID
    if (data.startsWith('did:')) {
      return {
        type: 'did',
        data: data
      };
    }

    // Check if it's a JWT (credential or presentation)
    if (data.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
      return {
        type: 'jwt',
        data: data
      };
    }

    // Unknown format
    return {
      type: 'unknown',
      data: data
    };
  }
}
