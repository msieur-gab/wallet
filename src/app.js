/**
 * Main Application
 *
 * Personal Identity Wallet - Complete implementation with:
 * - Authentication (login/register)
 * - Profile management
 * - Contact/friend management
 * - VC/VP credential issuance and verification
 * - Zero-knowledge proofs
 * - QR code sharing and scanning
 */

import { register, login, logout, getCurrentSession } from './auth/auth.js';
import { generateKeyPair, getUserKeys, exportWallet, importWallet } from './crypto/keyManager.js';
import {
  createProfile,
  getProfile,
  updateProfile,
  updateProfilePicture
} from './profile/profileManager.js';
import {
  addContact,
  getContacts,
  importContactFromProfile
} from './contacts/contactManager.js';
import {
  issueCredential,
  receiveCredential,
  getCredentials,
  createPresentation
} from './credentials/credentialManager.js';
import {
  createDerivedCredential,
  createRangeProof,
  createZKPresentation
} from './credentials/zkCredentials.js';
import {
  generateProfileQR,
  generateDidQR,
  generateCredentialQR,
  QRScanner,
  parseQRData,
  downloadQR
} from './utils/qrCode.js';
import {
  generateLetterAvatar,
  resizeAndCropImage,
  validateImageFile,
  getAvatarForDisplay,
  getBase64Size
} from './utils/avatar.js';

// Global state
let currentUser = null;
let currentSession = null;
let currentQR = null;
let qrScanner = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Identity Wallet initializing...');

  // Check for existing session
  const session = await getCurrentSession();

  if (session) {
    currentSession = session;
    currentUser = session.username;
    await loadMainApp();
  } else {
    showAuthScreen();
  }

  setupEventListeners();
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
}

async function loadMainApp() {
  try {
    showMainApp();

    // Load user data
    const profile = await getProfile(currentUser);
    const keys = await getUserKeys(currentUser);

    if (!profile) {
      // First time - create profile
      showMessage('Welcome! Please complete your profile.', 'info');
    }

    // Update header
    updateHeader(profile, keys);

    // Load profile panel
    await loadProfilePanel(profile);

  } catch (error) {
    console.error('Error loading app:', error);
    showMessage('Error loading application: ' + error.message, 'error');
  }
}

function updateHeader(profile, keys) {
  const username = currentUser;
  const displayName = profile?.displayName || username;
  const did = keys?.did || 'Loading...';

  document.getElementById('headerUsername').textContent = displayName;
  document.getElementById('headerDid').textContent = did.substring(0, 30) + '...';

  // Update avatar
  const avatarText = document.getElementById('headerAvatarText');
  const avatarImg = document.getElementById('headerAvatarImg');

  if (profile?.profilePicture) {
    avatarImg.src = profile.profilePicture;
    avatarImg.classList.remove('hidden');
    avatarText.classList.add('hidden');
  } else {
    // Use letter avatar as fallback
    const letterAvatar = generateLetterAvatar(displayName, 80);
    avatarImg.src = letterAvatar;
    avatarImg.classList.remove('hidden');
    avatarText.classList.add('hidden');
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Auth toggle
  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
  });

  // Registration
  document.getElementById('registerBtn').addEventListener('click', handleRegister);

  // Login
  document.getElementById('loginBtn').addEventListener('click', handleLogin);

  // Enter key support for forms
  document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('regPasswordConfirm').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRegister();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.getAttribute('data-panel');
      switchPanel(panelId);
    });
  });

  // Profile actions
  document.getElementById('saveProfileBtn').addEventListener('click', handleSaveProfile);
  document.getElementById('uploadAvatarBtn').addEventListener('click', handleUploadAvatar);
  document.getElementById('generateLetterAvatarBtn').addEventListener('click', handleGenerateLetterAvatar);
  document.getElementById('editProfilePic').addEventListener('change', handleProfilePictureChange);
  document.getElementById('downloadQRBtn').addEventListener('click', handleDownloadQR);

  // Export profile as text
  document.getElementById('exportProfileTextBtn')?.addEventListener('click', handleExportProfileText);

  // Contact actions
  document.getElementById('importContactTextBtn')?.addEventListener('click', handleImportContactText);
  document.getElementById('scanQRForContactBtn')?.addEventListener('click', handleScanQRForContact);

  // Credential actions
  document.getElementById('showIssueCredBtn')?.addEventListener('click', handleShowIssueCredential);
  document.getElementById('showReceiveCredBtn')?.addEventListener('click', handleShowReceiveCredential);

  // Settings - Key backup
  document.getElementById('copyDidBtn')?.addEventListener('click', handleCopyDid);
  document.getElementById('exportKeysBtn')?.addEventListener('click', handleExportKeys);
  document.getElementById('showRecoveryBtn')?.addEventListener('click', handleShowRecovery);
  document.getElementById('exportWalletBtn').addEventListener('click', handleExportWallet);
  document.getElementById('importWalletBtn').addEventListener('click', handleImportWallet);
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

async function handleRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regPasswordConfirm').value;

  const messageEl = document.getElementById('authMessage');

  try {
    // Validate passwords match
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Register user
    await register(username, password);

    // Generate keys
    await generateKeyPair(username, password);

    // Create initial profile
    await createProfile(username, password);

    showAuthMessage('Account created successfully! Logging in...', 'success');

    // Auto-login
    setTimeout(async () => {
      const session = await login(username, password);
      currentSession = session;
      currentUser = username;
      await loadMainApp();
    }, 1000);

  } catch (error) {
    console.error('Registration error:', error);
    showAuthMessage(error.message, 'error');
  }
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const session = await login(username, password);
    currentSession = session;
    currentUser = username;

    await loadMainApp();

  } catch (error) {
    console.error('Login error:', error);
    showAuthMessage(error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await logout(currentUser);
    currentUser = null;
    currentSession = null;
    showAuthScreen();
    showAuthMessage('Logged out successfully', 'info');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ============================================================================
// PANEL SWITCHING
// ============================================================================

function switchPanel(panelId) {
  // Update tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');

  // Update panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`${panelId}Panel`).classList.add('active');

  // Load panel content
  loadPanelContent(panelId);
}

async function loadPanelContent(panelId) {
  switch (panelId) {
    case 'profile':
      await loadProfilePanel();
      break;
    case 'contacts':
      await loadContactsPanel();
      break;
    case 'credentials':
      await loadCredentialsPanel();
      break;
    case 'zk':
      await loadZKPanel();
      break;
    case 'scan':
      await loadScanPanel();
      break;
    case 'settings':
      await loadSettingsPanel();
      break;
  }
}

// ============================================================================
// PROFILE PANEL
// ============================================================================

async function loadProfilePanel(profile) {
  if (!profile) {
    profile = await getProfile(currentUser);
  }

  const keys = await getUserKeys(currentUser);

  // Update display
  document.getElementById('profileDisplayName').textContent = profile.displayName || currentUser;
  document.getElementById('profileDid').textContent = keys.did;

  // Update profile picture with letter avatar fallback
  const profilePicEl = document.getElementById('profilePicture');
  const displayName = profile.displayName || currentUser;

  if (profile.profilePicture) {
    profilePicEl.innerHTML = `<img src="${profile.profilePicture}" alt="Profile">`;
  } else {
    // Generate and display letter avatar
    const letterAvatar = generateLetterAvatar(displayName, 240);
    profilePicEl.innerHTML = `<img src="${letterAvatar}" alt="Profile">`;
  }

  // Update edit form avatar preview
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarForPreview = getAvatarForDisplay(displayName, profile.profilePicture, 160);
  avatarPreview.innerHTML = `<img src="${avatarForPreview}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;

  // Generate QR code
  const qrContainer = document.getElementById('profileQR');
  currentQR = await generateProfileQR(currentUser, qrContainer, {
    width: 250,
    height: 250
  });

  // Load form values
  document.getElementById('editDisplayName').value = profile.displayName || '';
  document.getElementById('editEmail').value = profile.email || '';
  document.getElementById('editPhone').value = profile.phone || '';
  document.getElementById('editAddress').value = profile.address || '';
  document.getElementById('editBio').value = profile.bio || '';
  document.getElementById('editLinkedIn').value = profile.links?.linkedin || '';
  document.getElementById('editGitHub').value = profile.links?.github || '';
  document.getElementById('editTwitter').value = profile.links?.twitter || '';
  document.getElementById('editWebsite').value = profile.links?.website || '';
}

async function handleSaveProfile() {
  try {
    const updates = {
      displayName: document.getElementById('editDisplayName').value,
      email: document.getElementById('editEmail').value,
      phone: document.getElementById('editPhone').value,
      address: document.getElementById('editAddress').value,
      bio: document.getElementById('editBio').value,
      links: {
        linkedin: document.getElementById('editLinkedIn').value,
        github: document.getElementById('editGitHub').value,
        twitter: document.getElementById('editTwitter').value,
        website: document.getElementById('editWebsite').value
      }
    };

    await updateProfile(currentUser, updates);
    showMessage('Profile updated successfully!', 'success');

    // Reload profile
    await loadProfilePanel();

    // Update header
    const profile = await getProfile(currentUser);
    const keys = await getUserKeys(currentUser);
    updateHeader(profile, keys);

  } catch (error) {
    console.error('Error saving profile:', error);
    showMessage('Error saving profile: ' + error.message, 'error');
  }
}

async function handleUploadAvatar() {
  const fileInput = document.getElementById('editProfilePic');
  fileInput.click(); // Trigger file input
}

async function handleGenerateLetterAvatar() {
  try {
    const profile = await getProfile(currentUser);
    const name = profile?.displayName || currentUser;

    // Generate letter avatar
    const avatarBase64 = generateLetterAvatar(name, 256);

    // Update preview
    const preview = document.getElementById('avatarPreview');
    preview.innerHTML = `<img src="${avatarBase64}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;

    // Save to profile
    await updateProfilePicture(currentUser, avatarBase64);
    showMessage('✅ Letter avatar generated!', 'success');
    await loadProfilePanel();
  } catch (error) {
    showMessage('Error generating avatar: ' + error.message, 'error');
  }
}

async function handleProfilePictureChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    // Validate file
    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      showMessage(validation.error, 'error');
      return;
    }

    showMessage('⏳ Processing image...', 'info');

    // Resize and crop image
    const resizedBase64 = await resizeAndCropImage(file, 256, 0.85);

    const sizeKB = getBase64Size(resizedBase64);
    console.log(`Avatar resized to ${sizeKB}KB`);

    // Update preview
    const preview = document.getElementById('avatarPreview');
    preview.innerHTML = `<img src="${resizedBase64}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;

    // Save to profile
    await updateProfilePicture(currentUser, resizedBase64);
    showMessage(`✅ Profile picture updated! (${sizeKB}KB)`, 'success');
    await loadProfilePanel();
  } catch (error) {
    showMessage('Error updating picture: ' + error.message, 'error');
  }
}

async function handleDownloadQR() {
  if (currentQR) {
    await downloadQR(currentQR, `${currentUser}-identity.png`);
  }
}

// ============================================================================
// CONTACTS PANEL
// ============================================================================

async function loadContactsPanel() {
  const container = document.getElementById('contactsList');

  try {
    const contacts = await getContacts(currentUser);

    if (contacts.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #6b7280;">No contacts yet. Scan a QR code to add friends!</p>';
      return;
    }

    container.innerHTML = contacts.map(contact => {
      // Generate avatar for contact
      const avatarSrc = getAvatarForDisplay(
        contact.contactName,
        contact.contactProfile?.profilePicture,
        64
      );

      return `
        <div class="credential-item" style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <img src="${avatarSrc}" alt="${contact.contactName}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="credential-type">${contact.contactName}</div>
            <div class="credential-meta">${contact.contactDid.substring(0, 40)}...</div>
            <div style="margin-top: 8px;">
              ${contact.trusted ? '<span class="badge badge-success">Trusted</span>' : ''}
              <span class="badge badge-info">Added ${new Date(contact.addedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    container.innerHTML = `<p style="color: #ef4444;">Error loading contacts: ${error.message}</p>`;
  }
}

// ============================================================================
// CREDENTIALS PANEL
// ============================================================================

async function loadCredentialsPanel() {
  const container = document.getElementById('credentialsList');

  try {
    const credentials = await getCredentials(currentUser);

    if (credentials.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #6b7280;">No credentials yet.</p>';
      return;
    }

    container.innerHTML = credentials.map(cred => `
      <div class="credential-item">
        <div class="credential-type">${cred.credentialType}</div>
        <div class="credential-meta">
          ${cred.direction === 'issued' ? 'Issued to' : 'Received from'}: ${cred.direction === 'issued' ? cred.subjectDid.substring(0, 30) : cred.issuerDid.substring(0, 30)}...
        </div>
        <div style="margin-top: 8px;">
          <span class="badge ${cred.status === 'active' ? 'badge-success' : 'badge-danger'}">${cred.status}</span>
          <span class="badge badge-info">${new Date(cred.issuedAt).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = `<p style="color: #ef4444;">Error loading credentials: ${error.message}</p>`;
  }
}

// ============================================================================
// ZERO-KNOWLEDGE PANEL
// ============================================================================

async function loadZKPanel() {
  const container = document.getElementById('zkContent');

  container.innerHTML = `
    <div class="alert alert-info">
      <strong>Zero-Knowledge Proofs</strong> allow you to prove properties about your credentials without revealing the exact values.
    </div>
    <h3 style="margin-top: 24px;">Examples</h3>
    <ul style="margin: 12px 0; padding-left: 24px;">
      <li>Prove you're over 18 without revealing your exact age</li>
      <li>Prove you live in a country without revealing your exact address</li>
      <li>Prove group membership without revealing your identity</li>
    </ul>
    <p style="margin-top: 16px; color: #6b7280;">
      Select a credential with numeric values to create zero-knowledge proofs. This feature requires credentials with age, salary, or other numeric attributes.
    </p>
  `;
}

// ============================================================================
// SCAN PANEL
// ============================================================================

async function loadScanPanel() {
  const resultDiv = document.getElementById('scanResult');
  const readerDiv = document.getElementById('qr-reader');

  // Initialize scanner if not already created
  if (!qrScanner) {
    const { QRScanner } = await import('./utils/qrCode.js');
    qrScanner = new QRScanner('qr-reader');
  }

  // Stop previous scan if running
  if (qrScanner.isScanning) {
    await qrScanner.stop();
  }

  try {
    // Start scanning
    await qrScanner.start(
      async (decodedText) => {
        console.log('QR scanned:', decodedText);

        // Stop scanning
        await qrScanner.stop();

        // Parse QR data
        const { parseQRData } = await import('./utils/qrCode.js');
        const parsed = parseQRData(decodedText);

        if (parsed.type === 'profile') {
          // Import as contact
          try {
            const { importContactFromProfile } = await import('./contacts/contactManager.js');
            await importContactFromProfile(currentUser, decodedText);
            showMessage('✅ Contact added from QR code!', 'success');
            switchPanel('contacts');
          } catch (error) {
            resultDiv.innerHTML = `<div class="alert alert-error">Error: ${error.message}</div>`;
          }
        } else if (parsed.type === 'jwt') {
          // It's a credential
          try {
            const { receiveCredential } = await import('./credentials/credentialManager.js');
            await receiveCredential(currentUser, parsed.data);
            showMessage('✅ Credential received!', 'success');
            switchPanel('credentials');
          } catch (error) {
            resultDiv.innerHTML = `<div class="alert alert-error">Error: ${error.message}</div>`;
          }
        } else if (parsed.type === 'did') {
          resultDiv.innerHTML = `<div class="alert alert-info">DID scanned: ${parsed.data}</div>`;
        } else {
          resultDiv.innerHTML = `<div class="alert alert-info">Unknown QR type. Data: ${decodedText.substring(0, 100)}...</div>`;
        }
      },
      (error) => {
        // Scan errors are normal (camera adjusting, no QR in view, etc.)
        // Don't show these to avoid spam
      }
    );

    resultDiv.innerHTML = '<div class="alert alert-info">📷 Camera active - point at QR code</div>';
  } catch (error) {
    console.error('Scanner error:', error);
    resultDiv.innerHTML = `
      <div class="alert alert-error">
        ❌ Camera access denied or not available<br>
        <small>${error.message}</small>
      </div>
      <p style="margin-top: 12px; font-size: 14px; color: #6b7280;">
        Grant camera permission in your browser settings to scan QR codes.
      </p>
    `;
  }
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

async function loadSettingsPanel() {
  // Display DID in settings
  try {
    const keys = await getUserKeys(currentUser);
    if (keys && keys.did) {
      document.getElementById('settingsDidDisplay').textContent = keys.did;
    }
  } catch (error) {
    console.error('Error loading DID:', error);
  }
}

async function handleExportWallet() {
  const password = prompt('Enter your password to export wallet:');
  if (!password) return;

  try {
    const backup = await exportWallet(currentUser, password);

    // Download as JSON file
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUser}-wallet-backup.json`;
    a.click();
    URL.revokeObjectURL(url);

    showMessage('Wallet exported successfully!', 'success');
  } catch (error) {
    showMessage('Export failed: ' + error.message, 'error');
  }
}

async function handleImportWallet() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const password = prompt('Enter the password for this wallet:');
    if (!password) return;

    try {
      const content = await file.text();
      await importWallet(content, password);

      showMessage('Wallet imported successfully! Please login.', 'success');
      showAuthScreen();
    } catch (error) {
      showMessage('Import failed: ' + error.message, 'error');
    }
  });

  fileInput.click();
}

async function handleCopyDid() {
  try {
    const keys = await getUserKeys(currentUser);
    if (!keys || !keys.did) {
      return showMessage('DID not found', 'error');
    }

    await navigator.clipboard.writeText(keys.did);
    showMessage('✅ DID copied to clipboard!', 'success');
  } catch (error) {
    showMessage('Error copying DID: ' + error.message, 'error');
  }
}

async function handleExportKeys() {
  const password = prompt('Enter your password to export your encrypted keys:');
  if (!password) return;

  try {
    const keys = await getUserKeys(currentUser);
    if (!keys) {
      return showMessage('Keys not found', 'error');
    }

    // Get encrypted key data from database
    const { db } = await import('./db/database.js');
    const keyData = await db.keys.where('username').equals(currentUser).first();

    if (!keyData) {
      return showMessage('Key data not found', 'error');
    }

    // Verify password by trying to load private key
    const { loadPrivateKey } = await import('./crypto/keyManager.js');
    await loadPrivateKey(currentUser, password);

    // Export key data as JSON
    const keyExport = {
      version: 1,
      type: 'IdentityWalletKeys',
      username: currentUser,
      did: keys.did,
      publicKey: keys.publicKey,
      encryptedPrivateKey: keyData.encryptedPrivateKey,
      iv: keyData.iv,
      salt: keyData.salt,
      keyType: keyData.keyType,
      exportedAt: Date.now(),
      note: 'Keep this file secure! It contains your encrypted private keys.'
    };

    // Download as file
    const blob = new Blob([JSON.stringify(keyExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUser}-keys-backup.json`;
    a.click();
    URL.revokeObjectURL(url);

    showMessage('✅ Keys exported! Keep this file safe!', 'success');
  } catch (error) {
    showMessage('Export failed: ' + error.message, 'error');
  }
}

async function handleShowRecovery() {
  const password = prompt('Enter your password to view recovery information:');
  if (!password) return;

  try {
    const { loadPrivateKey } = await import('./crypto/keyManager.js');
    const { privateKey, publicKey, did } = await loadPrivateKey(currentUser, password);

    // Convert keys to hex for display
    const privateKeyHex = Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const publicKeyHex = Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');

    const recoveryInfo = `
╔══════════════════════════════════════════════════════════════╗
║                  🔐 RECOVERY INFORMATION                     ║
║          ⚠️  KEEP THIS INFORMATION SECURE  ⚠️                ║
╚══════════════════════════════════════════════════════════════╝

Username: ${currentUser}

DID (Decentralized Identifier):
${did}

Public Key (Hex):
${publicKeyHex}

Private Key (Hex):
${privateKeyHex}

⚠️ WARNING:
• Anyone with your private key can impersonate you!
• Never share your private key with anyone
• Store this information in a secure location
• Consider writing it down on paper and storing in a safe

💾 Recommended: Use "Download Encrypted Keys" instead
   This keeps your private key encrypted with your password.
    `.trim();

    // Create a modal-like display
    const textarea = document.createElement('textarea');
    textarea.value = recoveryInfo;
    textarea.style.cssText = 'width: 90%; height: 400px; margin: 20px auto; display: block; font-family: monospace; font-size: 11px; padding: 12px;';
    textarea.readOnly = true;

    const confirmed = confirm('⚠️ WARNING: This will display your PRIVATE KEY!\n\nYour private key allows complete control of your identity.\nOnly view in a secure, private location.\n\nDo you want to continue?');

    if (!confirmed) return;

    // Show in alert (not ideal but works)
    alert(recoveryInfo);

    // Also copy to clipboard with confirmation
    const copy = confirm('Copy recovery information to clipboard?\n\n⚠️ Be careful where you paste this!');
    if (copy) {
      await navigator.clipboard.writeText(recoveryInfo);
      showMessage('⚠️ Recovery info copied to clipboard', 'success');
    }

  } catch (error) {
    showMessage('Failed to load recovery info: ' + error.message, 'error');
  }
}

// ============================================================================
// NEW HANDLERS - PROFILE & CONTACT SHARING
// ============================================================================

async function handleExportProfileText() {
  try {
    const { exportPublicProfile } = await import('./profile/profileManager.js');
    const profileJson = await exportPublicProfile(currentUser);

    // Copy to clipboard
    await navigator.clipboard.writeText(profileJson);
    showMessage('✅ Profile copied to clipboard! Share this text with friends.', 'success');
  } catch (error) {
    showMessage('Error exporting profile: ' + error.message, 'error');
  }
}

async function handleImportContactText() {
  const profileText = prompt('Paste your friend\'s profile JSON here:');
  if (!profileText) return;

  try {
    const { importContactFromProfile } = await import('./contacts/contactManager.js');
    await importContactFromProfile(currentUser, profileText);
    showMessage('✅ Contact added successfully!', 'success');
    await loadContactsPanel(); // Refresh list
  } catch (error) {
    showMessage('Error importing contact: ' + error.message, 'error');
  }
}

async function handleScanQRForContact() {
  // Switch to scan panel
  switchPanel('scan');
  showMessage('📱 Point your camera at friend\'s QR code', 'info');
}

async function handleShowIssueCredential() {
  // For now, show a simple prompt-based interface
  // TODO: Add proper modal in future
  try {
    const { getContacts } = await import('./contacts/contactManager.js');
    const contacts = await getContacts(currentUser);

    if (contacts.length === 0) {
      return showMessage('No contacts found. Add contacts first!', 'error');
    }

    // Show contact selection
    const contactsList = contacts.map((c, i) => `${i + 1}. ${c.contactName} (${c.contactDid.substring(0, 30)}...)`).join('\n');
    const selection = prompt(`Select contact (enter number 1-${contacts.length}):\n\n${contactsList}`);

    if (!selection) return;

    const index = parseInt(selection) - 1;
    if (index < 0 || index >= contacts.length) {
      return showMessage('Invalid selection', 'error');
    }

    const contact = contacts[index];

    // Get credential details
    const credType = prompt('Credential Type (e.g., MembershipCredential):');
    if (!credType) return;

    const claimsText = prompt('Claims as JSON (e.g., {"role": "member", "level": "gold"}):');
    if (!claimsText) return;

    const expiryDays = prompt('Expires in how many days?', '365');
    if (!expiryDays) return;

    // Parse claims
    let claims;
    try {
      claims = JSON.parse(claimsText);
    } catch (e) {
      return showMessage('Invalid JSON format for claims', 'error');
    }

    // Get password
    const password = prompt('Enter your password to sign the credential:');
    if (!password) return;

    // Issue credential
    const { issueCredential } = await import('./credentials/credentialManager.js');
    const result = await issueCredential(currentUser, password, {
      subjectDid: contact.contactDid,
      type: credType,
      claims,
      expiresInDays: parseInt(expiryDays)
    });

    showMessage('✅ Credential issued successfully!', 'success');
    await loadCredentialsPanel();

    // Show JWT for sharing
    prompt('Credential JWT (copy and share with recipient):', result.jwt);

  } catch (error) {
    showMessage('Error issuing credential: ' + error.message, 'error');
  }
}

async function handleShowReceiveCredential() {
  const jwt = prompt('Paste the Verifiable Credential JWT you received:');
  if (!jwt) return;

  try {
    const { receiveCredential } = await import('./credentials/credentialManager.js');
    const result = await receiveCredential(currentUser, jwt);

    showMessage('✅ Credential verified and saved!', 'success');
    await loadCredentialsPanel();

    alert(`Credential received!\n\nType: ${result.type}\nIssuer: ${result.issuerDid.substring(0, 40)}...`);
  } catch (error) {
    showMessage('Credential verification failed: ' + error.message, 'error');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showMessage(message, type = 'info') {
  const container = document.getElementById('appMessage');
  const alertClass = type === 'error' ? 'alert-error' : (type === 'success' ? 'alert-success' : 'alert-info');

  container.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;

  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showAuthMessage(message, type = 'info') {
  const container = document.getElementById('authMessage');
  const alertClass = type === 'error' ? 'alert-error' : (type === 'success' ? 'alert-success' : 'alert-info');

  container.innerHTML = `
    <div class="alert ${alertClass}" style="margin-top: 16px;">
      ${message}
    </div>
  `;

  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}
