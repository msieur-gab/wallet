import { db } from '../db/database.js';

/**
 * Contact Management Module
 *
 * Handles adding, removing, and managing contacts/friends
 * Contacts can be added by scanning QR codes or importing profile data
 */

/**
 * Add a new contact
 */
export async function addContact(username, contactData) {
  // Validate required fields
  if (!contactData.did) {
    throw new Error('Contact DID is required');
  }

  if (!contactData.publicKey) {
    throw new Error('Contact public key is required');
  }

  // Check if contact already exists
  const existing = await db.contacts
    .where('[username+contactDid]')
    .equals([username, contactData.did])
    .first();

  if (existing) {
    throw new Error('Contact already exists');
  }

  // Prevent adding self as contact
  const userKeys = await db.keys.where('username').equals(username).first();
  if (userKeys && userKeys.did === contactData.did) {
    throw new Error('Cannot add yourself as a contact');
  }

  // Add contact
  const contact = {
    username,
    contactDid: contactData.did,
    contactName: contactData.displayName || contactData.username || 'Unknown',
    contactPublicKey: contactData.publicKey,
    contactProfile: {
      bio: contactData.bio || '',
      profilePicture: contactData.profilePicture || null,
      links: contactData.links || {}
    },
    addedAt: Date.now(),
    tags: contactData.tags || [],
    notes: '',
    trusted: false
  };

  await db.contacts.add(contact);

  // Log activity
  await db.logActivity(username, 'CONTACT_ADDED', {
    contactDid: contactData.did,
    contactName: contact.contactName,
    timestamp: Date.now()
  });

  return contact;
}

/**
 * Import contact from public profile JSON
 */
export async function importContactFromProfile(username, profileJson) {
  let profileData;

  try {
    profileData = JSON.parse(profileJson);
  } catch (error) {
    throw new Error('Invalid profile JSON');
  }

  if (profileData.type !== 'IdentityWalletProfile') {
    throw new Error('Invalid profile type');
  }

  if (profileData.version !== 1) {
    throw new Error('Unsupported profile version');
  }

  return await addContact(username, profileData.profile);
}

/**
 * Get all contacts for a user
 */
export async function getContacts(username, filters = {}) {
  let query = db.contacts.where('username').equals(username);

  const contacts = await query.toArray();

  // Apply filters
  let filtered = contacts;

  if (filters.trusted !== undefined) {
    filtered = filtered.filter(c => c.trusted === filters.trusted);
  }

  if (filters.tag) {
    filtered = filtered.filter(c => c.tags && c.tags.includes(filters.tag));
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(c =>
      c.contactName.toLowerCase().includes(searchLower) ||
      c.contactDid.toLowerCase().includes(searchLower)
    );
  }

  // Sort by name
  filtered.sort((a, b) => a.contactName.localeCompare(b.contactName));

  return filtered;
}

/**
 * Get a specific contact
 */
export async function getContact(username, contactDid) {
  return await db.contacts
    .where('[username+contactDid]')
    .equals([username, contactDid])
    .first();
}

/**
 * Update contact information
 */
export async function updateContact(username, contactDid, updates) {
  const contact = await getContact(username, contactDid);
  if (!contact) {
    throw new Error('Contact not found');
  }

  const validatedUpdates = {};

  if (updates.contactName !== undefined) {
    if (updates.contactName.length > 100) {
      throw new Error('Contact name too long (max 100 characters)');
    }
    validatedUpdates.contactName = updates.contactName.trim();
  }

  if (updates.notes !== undefined) {
    if (updates.notes.length > 1000) {
      throw new Error('Notes too long (max 1000 characters)');
    }
    validatedUpdates.notes = updates.notes.trim();
  }

  if (updates.trusted !== undefined) {
    validatedUpdates.trusted = Boolean(updates.trusted);
  }

  if (updates.tags !== undefined) {
    if (!Array.isArray(updates.tags)) {
      throw new Error('Tags must be an array');
    }
    if (updates.tags.length > 20) {
      throw new Error('Maximum 20 tags allowed');
    }
    validatedUpdates.tags = updates.tags.map(t => String(t).trim()).filter(t => t.length > 0);
  }

  await db.contacts
    .where('[username+contactDid]')
    .equals([username, contactDid])
    .modify(validatedUpdates);

  // Log activity
  await db.logActivity(username, 'CONTACT_UPDATED', {
    contactDid,
    fields: Object.keys(validatedUpdates),
    timestamp: Date.now()
  });

  return await getContact(username, contactDid);
}

/**
 * Mark contact as trusted
 */
export async function trustContact(username, contactDid) {
  return await updateContact(username, contactDid, { trusted: true });
}

/**
 * Remove trust from contact
 */
export async function untrustContact(username, contactDid) {
  return await updateContact(username, contactDid, { trusted: false });
}

/**
 * Add tag to contact
 */
export async function addContactTag(username, contactDid, tag) {
  const contact = await getContact(username, contactDid);
  if (!contact) {
    throw new Error('Contact not found');
  }

  const tags = contact.tags || [];
  if (!tags.includes(tag)) {
    tags.push(tag);
    return await updateContact(username, contactDid, { tags });
  }

  return contact;
}

/**
 * Remove tag from contact
 */
export async function removeContactTag(username, contactDid, tag) {
  const contact = await getContact(username, contactDid);
  if (!contact) {
    throw new Error('Contact not found');
  }

  const tags = contact.tags || [];
  const filtered = tags.filter(t => t !== tag);

  if (filtered.length !== tags.length) {
    return await updateContact(username, contactDid, { tags: filtered });
  }

  return contact;
}

/**
 * Remove a contact
 */
export async function removeContact(username, contactDid) {
  const contact = await getContact(username, contactDid);
  if (!contact) {
    throw new Error('Contact not found');
  }

  await db.contacts
    .where('[username+contactDid]')
    .equals([username, contactDid])
    .delete();

  // Log activity
  await db.logActivity(username, 'CONTACT_REMOVED', {
    contactDid,
    contactName: contact.contactName,
    timestamp: Date.now()
  });

  return true;
}

/**
 * Get all unique tags across all contacts
 */
export async function getAllTags(username) {
  const contacts = await getContacts(username);
  const tagSet = new Set();

  contacts.forEach(contact => {
    (contact.tags || []).forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * Search contacts by DID
 */
export async function findContactByDid(username, did) {
  return await getContact(username, did);
}

/**
 * Get contact statistics
 */
export async function getContactStats(username) {
  const contacts = await getContacts(username);

  return {
    total: contacts.length,
    trusted: contacts.filter(c => c.trusted).length,
    withTags: contacts.filter(c => c.tags && c.tags.length > 0).length,
    recentlyAdded: contacts.filter(c => c.addedAt > Date.now() - 7 * 24 * 60 * 60 * 1000).length
  };
}
