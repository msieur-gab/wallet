import { db } from '../db/database.js';
import { getUserKeys } from '../crypto/keyManager.js';

/**
 * Profile Management Module
 *
 * Handles user profile creation and updates including:
 * - Display name, bio
 * - Profile picture (stored as base64 data URL)
 * - Contact info (email, phone, address)
 * - Social links (LinkedIn, GitHub, Twitter, etc.)
 */

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (basic validation)
 */
function isValidPhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phone.length >= 10 && phoneRegex.test(phone);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert image file to base64 data URL
 */
export async function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('Image must be smaller than 2MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Create initial profile for user
 */
export async function createProfile(username, password) {
  // Check if profile already exists
  const existing = await db.profile.where('username').equals(username).first();
  if (existing) {
    throw new Error('Profile already exists');
  }

  // Get user's DID and keys
  const keys = await getUserKeys(username);
  if (!keys) {
    throw new Error('User keys not found. Generate keys first.');
  }

  // Create profile
  await db.profile.add({
    username,
    did: keys.did,
    displayName: username,
    email: '',
    phone: '',
    address: '',
    profilePicture: null,
    bio: '',
    links: {
      linkedin: '',
      github: '',
      twitter: '',
      website: '',
      custom: []
    },
    publicKey: keys.publicKey,
    updatedAt: Date.now()
  });

  // Log activity
  await db.logActivity(username, 'PROFILE_CREATED', { timestamp: Date.now() });

  return await getProfile(username);
}

/**
 * Get user profile
 */
export async function getProfile(username) {
  const profile = await db.profile.where('username').equals(username).first();
  if (!profile) {
    return null;
  }
  return profile;
}

/**
 * Update profile information
 */
export async function updateProfile(username, updates) {
  const profile = await getProfile(username);
  if (!profile) {
    throw new Error('Profile not found');
  }

  // Validate updates
  const validatedUpdates = {};

  if (updates.displayName !== undefined) {
    if (updates.displayName.length > 100) {
      throw new Error('Display name too long (max 100 characters)');
    }
    validatedUpdates.displayName = updates.displayName.trim();
  }

  if (updates.bio !== undefined) {
    if (updates.bio.length > 500) {
      throw new Error('Bio too long (max 500 characters)');
    }
    validatedUpdates.bio = updates.bio.trim();
  }

  if (updates.email !== undefined) {
    if (updates.email && !isValidEmail(updates.email)) {
      throw new Error('Invalid email format');
    }
    validatedUpdates.email = updates.email.trim();
  }

  if (updates.phone !== undefined) {
    if (updates.phone && !isValidPhone(updates.phone)) {
      throw new Error('Invalid phone number format');
    }
    validatedUpdates.phone = updates.phone.trim();
  }

  if (updates.address !== undefined) {
    if (updates.address.length > 300) {
      throw new Error('Address too long (max 300 characters)');
    }
    validatedUpdates.address = updates.address.trim();
  }

  if (updates.profilePicture !== undefined) {
    // Profile picture should be a base64 data URL or null
    validatedUpdates.profilePicture = updates.profilePicture;
  }

  if (updates.links !== undefined) {
    const links = { ...profile.links, ...updates.links };

    // Validate URLs
    if (links.linkedin && !isValidUrl(links.linkedin)) {
      throw new Error('Invalid LinkedIn URL');
    }
    if (links.github && !isValidUrl(links.github)) {
      throw new Error('Invalid GitHub URL');
    }
    if (links.twitter && !isValidUrl(links.twitter)) {
      throw new Error('Invalid Twitter URL');
    }
    if (links.website && !isValidUrl(links.website)) {
      throw new Error('Invalid website URL');
    }

    validatedUpdates.links = links;
  }

  // Update profile
  validatedUpdates.updatedAt = Date.now();

  await db.profile.where('username').equals(username).modify(validatedUpdates);

  // Log activity
  await db.logActivity(username, 'PROFILE_UPDATED', {
    fields: Object.keys(validatedUpdates),
    timestamp: Date.now()
  });

  return await getProfile(username);
}

/**
 * Update profile picture
 */
export async function updateProfilePicture(username, imageFile) {
  const dataUrl = await imageToBase64(imageFile);
  return await updateProfile(username, { profilePicture: dataUrl });
}

/**
 * Add custom link to profile
 */
export async function addCustomLink(username, label, url) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL');
  }

  if (label.length > 50) {
    throw new Error('Link label too long (max 50 characters)');
  }

  const profile = await getProfile(username);
  if (!profile) {
    throw new Error('Profile not found');
  }

  const customLinks = profile.links.custom || [];
  customLinks.push({ label: label.trim(), url: url.trim(), addedAt: Date.now() });

  if (customLinks.length > 10) {
    throw new Error('Maximum 10 custom links allowed');
  }

  return await updateProfile(username, {
    links: { ...profile.links, custom: customLinks }
  });
}

/**
 * Remove custom link from profile
 */
export async function removeCustomLink(username, index) {
  const profile = await getProfile(username);
  if (!profile) {
    throw new Error('Profile not found');
  }

  const customLinks = profile.links.custom || [];
  if (index < 0 || index >= customLinks.length) {
    throw new Error('Invalid link index');
  }

  customLinks.splice(index, 1);

  return await updateProfile(username, {
    links: { ...profile.links, custom: customLinks }
  });
}

/**
 * Get public profile (safe to share)
 */
export async function getPublicProfile(username) {
  const profile = await getProfile(username);
  if (!profile) {
    return null;
  }

  // Return only public information
  return {
    username: profile.username,
    did: profile.did,
    displayName: profile.displayName,
    bio: profile.bio,
    profilePicture: profile.profilePicture,
    publicKey: profile.publicKey,
    links: profile.links
    // Note: email, phone, address are considered private
  };
}

/**
 * Get public profile for QR code (lightweight, no image)
 */
export async function getPublicProfileForQR(username) {
  const profile = await getProfile(username);
  if (!profile) {
    return null;
  }

  // Return minimal data for QR code (no profile picture - too large!)
  return {
    username: profile.username,
    did: profile.did,
    displayName: profile.displayName,
    bio: profile.bio ? profile.bio.substring(0, 100) : '', // Truncate bio
    publicKey: profile.publicKey
    // Links omitted to keep QR code small
  };
}

/**
 * Export profile as shareable JSON
 */
export async function exportPublicProfile(username) {
  const publicProfile = await getPublicProfile(username);
  if (!publicProfile) {
    throw new Error('Profile not found');
  }

  return JSON.stringify({
    version: 1,
    type: 'IdentityWalletProfile',
    profile: publicProfile,
    exportedAt: Date.now()
  }, null, 2);
}
