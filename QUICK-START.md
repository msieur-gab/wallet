# Quick Start Guide

## Running the Complete System

### 1. Start the Wallet (Port 3000)

```bash
cd /home/user/wallet
npm start
```

Open http://localhost:3000

### 2. Start the Issuer (Port 3001)

```bash
cd /home/user/wallet/issuer
npm install  # First time only
npm start
```

Open http://localhost:3001

## End-to-End Test Flow

### Step 1: Create Wallet Identity

1. Go to http://localhost:3000
2. Click "Register"
3. Create username and password
4. Fill in your profile (name, etc.)
5. Go to Profile tab → Copy your DID

### Step 2: Issue Credential

1. Go to http://localhost:3001
2. Paste your DID in "Recipient DID"
3. Select credential type (e.g., "Membership Credential")
4. Edit claims (JSON):
   ```json
   {
     "name": "Your Name",
     "memberSince": "2024",
     "level": "gold"
   }
   ```
5. Click "Issue Credential"
6. Copy the JWT

### Step 3: Import Credential to Wallet

1. Go back to wallet (http://localhost:3000)
2. Go to Credentials tab
3. Click "Receive Credential"
4. Paste the JWT
5. ✅ Credential verified and stored!

## Architecture

```
┌──────────────────┐         ┌──────────────────┐
│   Issuer App     │         │   Wallet App     │
│  localhost:3001  │         │  localhost:3000  │
│                  │         │                  │
│  - Issues VCs    │         │  - Stores VCs    │
│  - Signs JWTs    │◄────────│  - Verifies VCs  │
│  - Shows QR      │  User   │  - Scans QR      │
│                  │ copies  │  - Manages DIDs  │
│                  │  JWT    │                  │
└──────────────────┘         └──────────────────┘
```

## Integration Options

See **ISSUER-INTEGRATION.md** for detailed integration options:
- ✅ QR Code flow (current - no API needed)
- 🔧 API-based flow
- ⚡ Deep link integration
- 🌐 OIDC4VCI standard

## Features

### Wallet Features
- ✅ Username/password authentication
- ✅ Profile management with avatars
- ✅ Letter-based avatars (auto-generated)
- ✅ Photo upload with auto-crop/resize
- ✅ Contact management
- ✅ Credential issuance and receiving
- ✅ QR code generation and scanning
- ✅ Zero-knowledge selective disclosure
- ✅ Key backup and recovery

### Issuer Features
- ✅ W3C-compliant credential generation
- ✅ Ed25519 signing
- ✅ Multiple credential types
- ✅ Custom claims support
- ✅ QR code display
- ✅ JWT export

## Ports

- **3000**: Wallet application
- **3001**: Issuer service

## Need Help?

- **Wallet docs**: `README.md`
- **Issuer docs**: `issuer/README.md`
- **Integration guide**: `ISSUER-INTEGRATION.md`
- **Implementation status**: `IMPLEMENTATION-STATUS.md`
