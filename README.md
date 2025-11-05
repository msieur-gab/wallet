# 🔐 Personal Identity Wallet

A comprehensive browser-based decentralized identity wallet with support for Verifiable Credentials (VCs), Verifiable Presentations (VPs), and Zero-Knowledge Proofs.

## ✨ Features

### Core Functionality
- **🔒 Secure Authentication**: Username/password with PBKDF2 key derivation (210,000 iterations)
- **💾 Local Storage**: All data stored locally in IndexedDB using Dexie.js
- **🔑 DID Management**: Generate and manage did:key identifiers with Ed25519 cryptography
- **🎨 Profile Management**: Complete user profiles with pictures, contact info, and social links
- **👥 Contact Management**: Add friends via QR code scanning
- **📜 Credentials**: Issue and receive Verifiable Credentials (JWT format)
- **🔍 Verification**: Verify VCs and VPs with challenge/domain validation
- **🔒 Zero-Knowledge Proofs**: Selective disclosure and range proofs

### Security Features
- Private keys encrypted with AES-GCM before storage
- Password-derived encryption keys (PBKDF2-SHA256)
- Secure session management
- Activity audit logging
- Wallet export/import with encryption

### User Experience
- Modern, responsive UI
- QR code generation for easy sharing
- QR code scanning for adding contacts
- Profile customization (picture, bio, links)
- LinkedIn, GitHub, Twitter integration

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES modules), HTML5, CSS3
- **Database**: IndexedDB via Dexie.js v4
- **Cryptography**: @noble/curves (Ed25519), @noble/hashes (PBKDF2, SHA256)
- **DIDs**: did-jwt, did-jwt-vc, did-resolver, key-did-resolver
- **ZK Proofs**: @zk-kit/protocols, @zk-kit/lean-imt
- **QR Codes**: qr-code-styling, html5-qrcode
- **Build Tool**: Vite

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
1. Go to "Scan QR" tab
2. Grant camera permission
3. Scan friend's QR code
4. Contact is added automatically

### Issuing Credentials
1. Go to "Credentials" tab
2. Click "Issue New Credential"
3. Select recipient (from contacts)
4. Enter claims (JSON format)
5. Credential is signed and can be shared

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
- Keys can be lost if browser data cleared
- No hardware security module integration
- Manual wallet backup required

### Best Practices
1. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
2. **Export wallet backups** regularly
3. **Store backups securely** (encrypted external drive)
4. **Don't share private keys** with anyone
5. **Verify DIDs** before trusting contacts

## 🛡️ Privacy

- **All data stored locally** in your browser
- **No telemetry or tracking**
- **No external API calls** (except for credential verification)
- **You control your data** completely

## 🔄 Wallet Backup & Recovery

### Export Wallet
1. Go to Settings
2. Click "Export Wallet Backup"
3. Enter your password
4. Save JSON file securely

### Import Wallet
1. Go to Settings (or login screen)
2. Click "Import Wallet"
3. Select backup JSON file
4. Enter password
5. All data restored

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
