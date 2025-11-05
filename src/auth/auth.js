import { db } from '../db/database.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Authentication Module
 *
 * Handles user registration, login, and session management
 * Uses PBKDF2 for password hashing with secure parameters
 */

const PBKDF2_ITERATIONS = 210000; // OWASP recommended minimum
const SALT_LENGTH = 32;
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Generate cryptographically secure random bytes
 */
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Hash password using PBKDF2
 */
async function hashPassword(password, salt) {
  const passwordBytes = enc.encode(password);
  const hash = pbkdf2(sha256, passwordBytes, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32
  });
  return bytesToHex(hash);
}

/**
 * Verify password against stored hash
 */
async function verifyPassword(password, passwordHash, salt) {
  const saltBytes = hexToBytes(salt);
  const computedHash = await hashPassword(password, saltBytes);
  return computedHash === passwordHash;
}

/**
 * Validate password strength
 */
export function validatePassword(password) {
  const errors = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate username
 */
export function validateUsername(username) {
  const errors = [];

  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (username.length > 30) {
    errors.push('Username must be at most 30 characters long');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Register a new user
 */
export async function register(username, password) {
  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.isValid) {
    throw new Error(usernameValidation.errors.join(', '));
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors.join(', '));
  }

  // Check if user already exists
  const existingUser = await db.user.get(username);
  if (existingUser) {
    throw new Error('Username already exists');
  }

  // Generate salt and hash password
  const salt = randomBytes(SALT_LENGTH);
  const saltHex = bytesToHex(salt);
  const passwordHash = await hashPassword(password, salt);

  // Create user account
  await db.user.add({
    username,
    passwordHash,
    salt: saltHex,
    createdAt: Date.now()
  });

  // Log activity
  await db.logActivity(username, 'USER_REGISTERED', { timestamp: Date.now() });

  return { username };
}

/**
 * Login user
 */
export async function login(username, password) {
  // Get user from database
  const user = await db.user.get(username);
  if (!user) {
    throw new Error('Invalid username or password');
  }

  // Verify password
  const saltBytes = hexToBytes(user.salt);
  const isValid = await verifyPassword(password, user.passwordHash, user.salt);

  if (!isValid) {
    throw new Error('Invalid username or password');
  }

  // Create session
  const sessionKey = bytesToHex(randomBytes(32));
  const expiresAt = Date.now() + SESSION_DURATION;

  await db.sessions.put({
    username,
    sessionKey,
    loginAt: Date.now(),
    expiresAt
  });

  // Log activity
  await db.logActivity(username, 'USER_LOGIN', { timestamp: Date.now() });

  return {
    username,
    sessionKey,
    expiresAt
  };
}

/**
 * Logout user
 */
export async function logout(username) {
  await db.sessions.where('username').equals(username).delete();
  await db.logActivity(username, 'USER_LOGOUT', { timestamp: Date.now() });
}

/**
 * Check if session is valid
 */
export async function validateSession(username, sessionKey) {
  const session = await db.sessions.get(username);

  if (!session) {
    return false;
  }

  if (session.sessionKey !== sessionKey) {
    return false;
  }

  if (session.expiresAt < Date.now()) {
    // Session expired, delete it
    await db.sessions.delete(username);
    return false;
  }

  return true;
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const sessions = await db.sessions.toArray();

  if (sessions.length === 0) {
    return null;
  }

  // Get the most recent valid session
  const validSession = sessions.find(s => s.expiresAt > Date.now());

  if (!validSession) {
    // Clean up expired sessions
    await db.sessions.where('expiresAt').below(Date.now()).delete();
    return null;
  }

  return validSession;
}

/**
 * Change password
 */
export async function changePassword(username, oldPassword, newPassword) {
  // Verify old password
  const user = await db.user.get(username);
  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await verifyPassword(oldPassword, user.passwordHash, user.salt);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors.join(', '));
  }

  // Generate new salt and hash
  const salt = randomBytes(SALT_LENGTH);
  const saltHex = bytesToHex(salt);
  const passwordHash = await hashPassword(newPassword, salt);

  // Update user
  await db.user.update(username, {
    passwordHash,
    salt: saltHex
  });

  // Log activity
  await db.logActivity(username, 'PASSWORD_CHANGED', { timestamp: Date.now() });

  return true;
}
