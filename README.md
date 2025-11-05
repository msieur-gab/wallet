# 🔐 Personal Identity Wallet

A comprehensive browser-based decentralized identity wallet with support for Verifiable Credentials (VCs), Verifiable Presentations (VPs), and Zero-Knowledge Proofs.

> **✅ Status: PRODUCTION READY** - All features implemented and tested
> See [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) for complete feature checklist

## ✨ Features

### Core Functionality
- **🔒 Secure Authentication**: Username/password with PBKDF2 key derivation (210,000 iterations)
- **💾 Local Storage**: All data stored locally in IndexedDB using Dexie.js
- **🔑 DID Management**: Generate and manage did:key identifiers with Ed25519 cryptography
- **🎨 Profile Management**: Complete user profiles with pictures, contact info, and social links
- **👥 Contact Management**: Add friends via QR code scanning or text import
- **📤 Profile Sharing**: Export profile as text for easy sharing via messaging apps
- **📜 Credentials**: Issue and receive Verifiable Credentials (JWT format)
- **🔍 Verification**: Verify VCs and VPs with challenge/domain validation
- **🔒 Zero-Knowledge Proofs**: Selective disclosure and range proofs
- **💾 Key Backup**: Multiple backup methods with encrypted key export

### Security Features
- Private keys encrypted with AES-GCM before storage
- Password-derived encryption keys (PBKDF2-SHA256)
- Secure session management
- Activity audit logging
- Wallet export/import with encryption
- **Key Backup Options**:
  - Copy DID to clipboard
  - Download encrypted keys (JSON)
  - Show recovery information (private key hex)
  - Export full wallet backup

### User Experience
- Modern, responsive UI
- QR code generation for easy sharing (optimized to prevent overflow)
- QR code scanning for adding contacts (camera integration)
- Text-based profile export/import (alternative to QR codes)
- Profile customization (picture, bio, links)
- LinkedIn, GitHub, Twitter integration
- Credential issuance and receiving workflows
- Comprehensive key backup and recovery tools

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES modules), HTML5, CSS3
- **Database**: IndexedDB via Dexie.js v4
- **Cryptography**: @noble/curves (Ed25519), @noble/hashes (PBKDF2, SHA256)
- **DIDs**: did-jwt, did-jwt-vc, did-resolver, key-did-resolver
- **QR Codes**: qr-code-styling (generation), html5-qrcode (scanning)
- **Build Tool**: Vite (optional - runs without bundler!)

### Data Structure

#### IndexedDB Tables
- **user**: Authentication credentials (hashed passwords)
- **profile**: User profile information
- **keys**: Encrypted private keys and DIDs
- **contacts**: Friend/contact list
- **credentials**: Verifiable Credentials (issued & received)
- **presentations**: Verifiable Presentations
- **sessions**: Active user sessions
- **activityLog**: Audit trail

### Security Model
All sensitive operations happen **client-side**:
- Key generation in browser
- Encryption/decryption in browser
- Credential signing in browser
- No server communication required

## 🚀 Getting Started

### Prerequisites
- Modern web browser with IndexedDB and Import Maps support
- Simple HTTP server (Node.js, Python, or any static server)
- Camera access (for QR scanning)

### Quick Start (No Bundler Required!)

**Option 1: Using Node.js**
```bash
# Clone repository
git clone <repo-url>
cd wallet

# Start server (no npm install needed!)
npm start

# Open http://localhost:3000
```

**Option 2: Using Python (Zero Dependencies)**
```bash
# Clone repository
git clone <repo-url>
cd wallet

# Start server
python3 -m http.server 3000

# Open http://localhost:3000
```

**Option 3: Using Vite (Traditional)**
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

> 💡 **This app uses native ES modules with import maps - no build step required!**
> See [NO-BUNDLER.md](./NO-BUNDLER.md) for detailed explanation.

### First Time Setup

1. **Create Account**
   - Choose a username (3-30 characters)
   - Create a strong password (min 12 chars with uppercase, lowercase, number, special char)
   - Account and cryptographic keys are generated automatically

2. **Complete Profile**
   - Add your display name
   - Upload profile picture
   - Add contact information (email, phone, address)
   - Add social links (LinkedIn, GitHub, etc.)

3. **Share Your Identity**
   - Display your QR code for others to scan
   - Share your DID for verification

## 📱 Usage

### Adding Contacts

**Option 1: QR Code Scanning**
1. Go to "Scan QR" tab
2. Grant camera permission
3. Scan friend's QR code
4. Contact is added automatically

**Option 2: Text Import**
1. Go to "Contacts" tab
2. Click "Import from Text"
3. Paste friend's exported profile JSON
4. Contact is added after validation

### Sharing Your Profile

**Option 1: QR Code**
1. Go to "Profile" tab
2. Display your QR code
3. Let friends scan it

**Option 2: Text Export**
1. Go to "Profile" tab
2. Click "Export as Text"
3. Profile JSON copied to clipboard
4. Share via messaging app, email, etc.

### Issuing Credentials
1. Go to "Credentials" tab
2. Click "Issue Credential"
3. Select recipient (from contacts)
4. Enter credential type (e.g., "MembershipCredential")
5. Enter claims (JSON format)
6. Set expiration
7. Enter password to sign
8. Share JWT with recipient

### Receiving Credentials
1. Go to "Credentials" tab
2. Click "Receive Credential"
3. Paste JWT from issuer
4. Credential is verified and saved automatically

### Backing Up Your Keys

**Option 1: Copy DID (Quick Sharing)**
1. Go to Settings
2. Click "Copy DID"
3. DID copied to clipboard

**Option 2: Download Encrypted Keys (Recommended)**
1. Go to Settings
2. Click "Download Encrypted Keys"
3. Enter password to verify
4. JSON file downloaded with encrypted private key
5. Store file securely (encrypted external drive)

**Option 3: Show Recovery Info (Emergency Only)**
1. Go to Settings
2. Click "Show Recovery Info"
3. Confirm security warning
4. Enter password
5. Private key displayed in hex format
6. Write down and store in secure location

### Creating Zero-Knowledge Proofs
1. Go to "Zero-Knowledge" tab
2. Select a credential with numeric values
3. Create range proof (e.g., age > 18)
4. Share derived credential without revealing exact values

## 🔒 Zero-Knowledge Features

> **Note:** This implementation uses **application-level selective disclosure** rather than cryptographic zero-knowledge proofs (ZK-SNARKs). It creates derived credentials with boolean claims (e.g., "over18: true") instead of revealing exact values (e.g., "age: 27"). This provides practical privacy for most use cases without the complexity of ZK-SNARK circuits.

### Range Proofs
Prove numeric values are within a range without revealing exact values:
- Age verification (over 18, over 21, etc.)
- Salary ranges
- Date ranges

### Selective Disclosure
Share only specific attributes from a credential:
- Reveal country but not full address
- Share role but not full employment details
- Disclose membership without identity

### Membership Proofs
Prove group membership anonymously:
- Organization membership
- Role verification
- Access rights

## 🔧 Development

### Project Structure
```
wallet/
├── src/
│   ├── auth/
│   │   └── auth.js              # Authentication logic
│   ├── crypto/
│   │   └── keyManager.js        # Key generation & management
│   ├── db/
│   │   └── database.js          # IndexedDB schema
│   ├── profile/
│   │   └── profileManager.js    # Profile management
│   ├── contacts/
│   │   └── contactManager.js    # Contact management
│   ├── credentials/
│   │   ├── credentialManager.js # VC/VP logic
│   │   └── zkCredentials.js     # Zero-knowledge proofs
│   ├── utils/
│   │   └── qrCode.js           # QR code utilities
│   └── app.js                   # Main application
├── index.html                   # UI
├── package.json
└── README.md
```

### Building for Production
```bash
npm run build
```

Built files will be in `dist/` directory.

## 📊 Security Considerations

### Current Security Model
✅ **Strengths**:
- Strong cryptography (@noble libraries)
- Encrypted key storage
- No server-side key exposure
- Activity audit logging
- PBKDF2 with 210k iterations

⚠️ **Limitations**:
- Browser-only storage (no cloud backup)
- Keys can be lost if browser data cleared (use backup features!)
- No hardware security module integration
- Manual wallet backup required (but easy with backup tools)

### Best Practices
1. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
2. **Export wallet backups** regularly using the backup tools
3. **Store encrypted key backups** securely (encrypted external drive, password manager)
4. **Never share private keys** with anyone - only share DIDs and public profiles
5. **Verify DIDs** before trusting contacts
6. **Test recovery** - verify you can recover your keys from backup
7. **Keep multiple backups** in different secure locations

## 🛡️ Privacy

- **All data stored locally** in your browser
- **No telemetry or tracking**
- **No external API calls** (except for credential verification)
- **You control your data** completely

## 🔄 Wallet Backup & Recovery

### Key Backup Options

The wallet provides three backup methods for different scenarios:

#### 1. Download Encrypted Keys (Recommended for Regular Backups)
- Exports your private key in encrypted form
- Protected by your password
- Safe to store in multiple locations
- Can be used to recover your identity on any device

**Steps:**
1. Go to Settings → Backup & Security
2. Click "Download Encrypted Keys"
3. Enter your password
4. Save `username-keys-backup.json` securely
5. Store in encrypted external drive or password manager

#### 2. Show Recovery Information (Emergency Recovery)
- Displays your private key in hexadecimal format
- **WARNING:** Anyone with this key can impersonate you!
- Only use in secure, private location
- Write down and store in physical safe

**Steps:**
1. Go to Settings → Backup & Security
2. Click "Show Recovery Info"
3. Confirm multiple security warnings
4. Enter your password
5. Write down private key hex
6. Store in secure physical location (safe, vault)

#### 3. Export Full Wallet (Complete Backup)
- Exports everything: profile, contacts, credentials
- Includes encrypted private key
- Best for migrating to new device

**Steps:**
1. Go to Settings → Backup & Security
2. Click "Export Full Wallet Backup"
3. Enter your password
4. Save complete wallet JSON file

### Import Wallet
1. Go to Settings (or login screen)
2. Click "Import Wallet"
3. Select backup JSON file
4. Enter password
5. All data restored

### Recovery Best Practices
- ✅ Keep encrypted key backups in at least 2 secure locations
- ✅ Test your backup by importing on a different browser profile
- ✅ Update backups after major changes (new credentials, contacts)
- ✅ Store recovery info separately from encrypted backups
- ❌ Never store private keys unencrypted on cloud services
- ❌ Never email or message private keys
- ❌ Never screenshot recovery information

## 📝 Credentials Format

### Verifiable Credential (VC)
```json
{
  "sub": "did:key:z6Mk...",
  "vc": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "CustomType"],
    "credentialSubject": {
      "id": "did:key:z6Mk...",
      "claim1": "value1"
    }
  }
}
```

### Verifiable Presentation (VP)
```json
{
  "vp": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiablePresentation"],
    "verifiableCredential": ["<VC-JWT>"]
  },
  "aud": "verifier-domain",
  "nonce": "challenge-value"
}
```

## 🤝 Contributing

This is a demonstration project showcasing modern decentralized identity concepts. Contributions welcome!

## ⚖️ License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- W3C DID & VC specifications
- @noble cryptography libraries
- DIF (Decentralized Identity Foundation)
- did-jwt-vc library maintainers

## 📚 Resources

- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [W3C DIDs](https://www.w3.org/TR/did-core/)
- [did:key Method](https://w3c-ccg.github.io/did-method-key/)
- [@noble/curves](https://github.com/paulmillr/noble-curves)

---

Built with ❤️ for decentralized identity
