import Dexie from 'dexie';

/**
 * Identity Wallet Database Schema
 *
 * Stores all user data locally in IndexedDB:
 * - User authentication credentials
 * - Profile information
 * - DID and cryptographic keys (encrypted)
 * - Contacts/friends
 * - Verifiable Credentials (VCs)
 * - Verifiable Presentations (VPs)
 */

export class IdentityWalletDB extends Dexie {
  constructor() {
    super('IdentityWalletDB');

    this.version(1).stores({
      // User account - username is primary key
      user: 'username, passwordHash, salt, createdAt',

      // User profile information
      profile: '++id, username, did, displayName, email, phone, address, profilePicture, bio, links, publicKey, updatedAt',

      // Encrypted keys - stored separately for security
      keys: '++id, username, encryptedPrivateKey, publicKey, did, keyType, iv, salt, createdAt',

      // Contacts/Friends
      contacts: '++id, username, contactDid, contactName, contactPublicKey, addedAt, tags, notes, trusted',

      // Verifiable Credentials (received or issued)
      credentials: '++id, username, credentialJwt, credentialType, issuerDid, subjectDid, claims, issuedAt, expiresAt, status, tags',

      // Verifiable Presentations (created)
      presentations: '++id, username, presentationJwt, credentialIds, verifierDid, challenge, domain, createdAt, purpose',

      // Session management
      sessions: 'username, sessionKey, loginAt, expiresAt',

      // Activity log for audit trail
      activityLog: '++id, username, action, details, timestamp'
    });

    // Define table shortcuts
    this.user = this.table('user');
    this.profile = this.table('profile');
    this.keys = this.table('keys');
    this.contacts = this.table('contacts');
    this.credentials = this.table('credentials');
    this.presentations = this.table('presentations');
    this.sessions = this.table('sessions');
    this.activityLog = this.table('activityLog');
  }

  /**
   * Log activity for audit trail
   */
  async logActivity(username, action, details = {}) {
    await this.activityLog.add({
      username,
      action,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all user data (for logout/account deletion)
   */
  async clearUserData(username) {
    await this.transaction('rw',
      this.user,
      this.profile,
      this.keys,
      this.contacts,
      this.credentials,
      this.presentations,
      this.sessions,
      this.activityLog,
      async () => {
        await this.user.where('username').equals(username).delete();
        await this.profile.where('username').equals(username).delete();
        await this.keys.where('username').equals(username).delete();
        await this.contacts.where('username').equals(username).delete();
        await this.credentials.where('username').equals(username).delete();
        await this.presentations.where('username').equals(username).delete();
        await this.sessions.where('username').equals(username).delete();
        await this.activityLog.where('username').equals(username).delete();
      }
    );
  }
}

// Create singleton instance
export const db = new IdentityWalletDB();
