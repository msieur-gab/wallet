import { ed25519 } from '@noble/curves/ed25519';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { base58btc } from 'multiformats/bases/base58';
import { db } from '../db/database.js';

/**
 * Key Management Module
 *
 * Handles cryptographic key generation, storage, and DID creation
 * Keys are encrypted before storage using password-derived keys
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Generate random bytes
 */
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert bytes to hex
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex to bytes
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to base64url
 */
function bytesToBase64url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create did:key from Ed25519 public key
 */
export function createDidKey(publicKey) {
  // Multicodec prefix for Ed25519 public key: 0xed01
  const prefix = new Uint8Array([0xed, 0x01]);
  const prefixed = new Uint8Array(prefix.length + publicKey.length);
  prefixed.set(prefix, 0);
  prefixed.set(publicKey, prefix.length);
  return 'did:key:' + base58btc.encode(prefixed);
}

/**
 * Derive encryption key from password
 */
async function deriveKeyFromPassword(password, salt) {
  const passwordBytes = enc.encode(password);
  return pbkdf2(sha256, passwordBytes, salt, {
    c: 150000,
    dkLen: 32
  });
}

/**
 * Encrypt private key using AES-GCM
 */
async function encryptPrivateKey(privateKey, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);

  // Derive encryption key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // Import key for Web Crypto API
  const aesKey = await crypto.subtle.importKey(
    'raw',
    derivedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt private key
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privateKey
  );

  return {
    encrypted: bytesToHex(new Uint8Array(ciphertext)),
    iv: bytesToHex(iv),
    salt: bytesToHex(salt)
  };
}

/**
 * Decrypt private key using AES-GCM
 */
async function decryptPrivateKey(encryptedHex, password, ivHex, saltHex) {
  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(encryptedHex);

  // Derive encryption key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // Import key for Web Crypto API
  const aesKey = await crypto.subtle.importKey(
    'raw',
    derivedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt private key
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

/**
 * Generate new Ed25519 key pair and DID
 */
export async function generateKeyPair(username, password) {
  // Generate Ed25519 key pair
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  // Create DID from public key
  const did = createDidKey(publicKey);

  // Encrypt private key before storage
  const { encrypted, iv, salt } = await encryptPrivateKey(privateKey, password);

  // Store encrypted key in database
  await db.keys.add({
    username,
    encryptedPrivateKey: encrypted,
    publicKey: bytesToHex(publicKey),
    did,
    keyType: 'Ed25519',
    iv,
    salt,
    createdAt: Date.now()
  });

  // Log activity
  await db.logActivity(username, 'KEY_GENERATED', { did, keyType: 'Ed25519' });

  return {
    did,
    publicKey: bytesToHex(publicKey)
  };
}

/**
 * Get user's DID and public key
 */
export async function getUserKeys(username) {
  const keys = await db.keys.where('username').equals(username).first();
  if (!keys) {
    return null;
  }

  return {
    did: keys.did,
    publicKey: keys.publicKey,
    keyType: keys.keyType
  };
}

/**
 * Load and decrypt private key
 */
export async function loadPrivateKey(username, password) {
  const keys = await db.keys.where('username').equals(username).first();
  if (!keys) {
    throw new Error('No keys found for user');
  }

  try {
    const privateKey = await decryptPrivateKey(
      keys.encryptedPrivateKey,
      password,
      keys.iv,
      keys.salt
    );

    return {
      privateKey,
      publicKey: hexToBytes(keys.publicKey),
      did: keys.did
    };
  } catch (error) {
    throw new Error('Failed to decrypt private key. Incorrect password?');
  }
}

/**
 * Create Ed25519 signer for did-jwt
 */
export function createSigner(privateKey) {
  return async (data) => {
    let dataToSign = data;
    if (typeof data === 'string') {
      dataToSign = enc.encode(data);
    }
    const signature = await ed25519.sign(dataToSign, privateKey);
    return bytesToBase64url(signature);
  };
}

/**
 * Export encrypted wallet backup
 */
export async function exportWallet(username, password) {
  const keys = await db.keys.where('username').equals(username).first();
  if (!keys) {
    throw new Error('No keys found for user');
  }

  // Verify password by attempting to decrypt
  await loadPrivateKey(username, password);

  // Export all data
  const profile = await db.profile.where('username').equals(username).first();
  const contacts = await db.contacts.where('username').equals(username).toArray();
  const credentials = await db.credentials.where('username').equals(username).toArray();

  const backup = {
    version: 1,
    username,
    keys: {
      encryptedPrivateKey: keys.encryptedPrivateKey,
      publicKey: keys.publicKey,
      did: keys.did,
      iv: keys.iv,
      salt: keys.salt
    },
    profile: profile || {},
    contacts: contacts || [],
    credentials: credentials || [],
    exportedAt: Date.now()
  };

  // Log activity
  await db.logActivity(username, 'WALLET_EXPORTED', { timestamp: Date.now() });

  return JSON.stringify(backup, null, 2);
}

/**
 * Import encrypted wallet backup
 */
export async function importWallet(backupJson, password) {
  const backup = JSON.parse(backupJson);

  if (backup.version !== 1) {
    throw new Error('Unsupported backup version');
  }

  const username = backup.username;

  // Check if user already exists
  const existingKeys = await db.keys.where('username').equals(username).first();
  if (existingKeys) {
    throw new Error('Wallet for this user already exists');
  }

  // Verify password by attempting to decrypt
  await decryptPrivateKey(
    backup.keys.encryptedPrivateKey,
    password,
    backup.keys.iv,
    backup.keys.salt
  );

  // Import keys
  await db.keys.add({
    username,
    encryptedPrivateKey: backup.keys.encryptedPrivateKey,
    publicKey: backup.keys.publicKey,
    did: backup.keys.did,
    keyType: 'Ed25519',
    iv: backup.keys.iv,
    salt: backup.keys.salt,
    createdAt: Date.now()
  });

  // Import profile if exists
  if (backup.profile && Object.keys(backup.profile).length > 0) {
    await db.profile.add({
      ...backup.profile,
      username,
      updatedAt: Date.now()
    });
  }

  // Import contacts
  for (const contact of backup.contacts || []) {
    await db.contacts.add({
      ...contact,
      username
    });
  }

  // Import credentials
  for (const credential of backup.credentials || []) {
    await db.credentials.add({
      ...credential,
      username
    });
  }

  // Log activity
  await db.logActivity(username, 'WALLET_IMPORTED', { timestamp: Date.now() });

  return { username, did: backup.keys.did };
}
