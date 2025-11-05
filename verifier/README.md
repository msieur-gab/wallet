# Credential Verifier Service

A standalone verification service for Verifiable Credentials. Organizations can use this to verify credentials presented by users while respecting their privacy choices.

## Features

- ✅ **Multiple Verifier Profiles** - Restaurant, Medical, Government, Employer, Educational
- ✅ **JWT Verification** - Cryptographic signature validation using did-jwt-vc
- ✅ **Privacy-Aware** - Displays whatever claims the user chose to share
- ✅ **QR Code Scanning** - Camera-based scanning (future enhancement)
- ✅ **Manual Input** - Paste JWT directly for verification
- ✅ **Beautiful UI** - Clean, minimal design inspired by shadcn
- ✅ **Real-time Validation** - Instant verification results

## Quick Start

### 1. Install Dependencies

```bash
cd verifier
npm install
```

### 2. Start the Server

```bash
npm start
```

The verifier will be available at `http://localhost:3002`

### 3. Select Your Profile

Choose which type of verifier you are:
- 🍽️ **Restaurant/Public Place** - For entry/access verification
- 🏥 **Medical Facility** - For healthcare records
- 🏛️ **Government Agency** - For official ID verification
- 💼 **Employer/HR** - For employment credentials
- 🎓 **Educational Institution** - For academic credentials

### 4. Verify Credentials

**Option A: Manual Input** (Recommended for demo)
1. Get credential JWT from user's wallet QR code
2. Paste into the text area
3. Click "Verify Credential"

**Option B: Camera Scan** (Future enhancement)
1. Click "Start Camera Scan"
2. Point camera at user's QR code
3. Auto-verifies when detected

## How It Works

### Verification Flow

```
User Wallet                    Verifier Service
    │                               │
    │  1. User expands credential   │
    │     (chooses privacy mode)    │
    │                               │
    │  2. QR code generated         │
    │     (minimal or full JWT)     │
    │                               │
    │◄────── 3. Scan QR ─────────────│
    │                               │
    │  4. JWT contains:             │
    │     - Signed claims           │
    │     - Issuer DID             │
    │     - Expiration             │
    │                               │
    │──────── 5. Verify ───────────►│
    │                               │
    │                          ✅ Valid!
    │                          Shows claims
```

### What Gets Verified

1. **Signature** - Cryptographically validates the credential wasn't tampered with
2. **Issuer** - Shows who issued the credential (DID)
3. **Expiration** - Checks if credential is still valid
4. **Claims** - Displays whatever the user chose to share

### Privacy Model

**Important:** The verifier displays whatever claims the **user** included in their QR code.

- User toggled to **Privacy First** → Verifier sees minimal claims
- User toggled to **Full Disclosure** → Verifier sees all claims

**Verifiers don't filter claims** - they trust the user's privacy choice.

## Verifier Profiles

### Restaurant / Public Place 🍽️
- **Use for:** Entry verification, age checks
- **Accepts:** Vaccination, Age, Membership credentials
- **Expected:** Minimal claims from users

### Medical Facility 🏥
- **Use for:** Healthcare records, medical history
- **Accepts:** Vaccination, Membership credentials
- **Expected:** Full details when medically necessary

### Government Agency 🏛️
- **Use for:** Official ID, permits, licenses
- **Accepts:** Age, Residency, Education, Employment
- **Expected:** Full details for official processes

### Employer / HR 💼
- **Use for:** Hiring, background checks
- **Accepts:** Education, Certification, Employment, Skills
- **Expected:** Full credentials for employment verification

### Educational Institution 🎓
- **Use for:** Admissions, transfers
- **Accepts:** Education, Certification credentials
- **Expected:** Full academic records

## Technical Details

### Dependencies

- `did-jwt-vc` - W3C Verifiable Credentials verification
- `did-resolver` - DID resolution
- `key-did-resolver` - did:key method support

### Supported Credential Types

- VaccinationCredential
- AgeCredential
- ResidencyCredential
- EducationCredential
- CertificationCredential
- EmploymentCredential
- SkillCredential
- MembershipCredential

### Verification Result

When a credential is verified, you'll see:

```
✓ Credential Verified

Type: VaccinationCredential
🔒 Privacy-Preserving (if minimal)
Issuer: did:key:z6MkiGZgrLQMmYAGjaGmLpFjdyDtWbb47btYJuR1cAwheJis
Issued: 11/5/2025, 3:30:00 PM
Expires: 11/5/2026, 3:30:00 PM

Verified Claims:
✓ vaccinated: true
✓ vaccineName: COVID-19
```

## Security Considerations

### What This Verifies

✅ Signature is valid (credential wasn't tampered)
✅ Issuer DID is authentic
✅ Credential hasn't expired
✅ Claims are cryptographically bound

### What This Doesn't Verify

❌ Trust in the issuer (you must trust the issuer DID)
❌ Revocation status (not implemented in this demo)
❌ Issuer authorization (anyone can be an issuer)

### Production Considerations

For production use, you should add:
1. **Issuer Registry** - Whitelist of trusted issuer DIDs
2. **Revocation Checking** - Query revocation lists
3. **Audit Logging** - Record all verification attempts
4. **Rate Limiting** - Prevent abuse
5. **HTTPS** - Secure connections

## Demo Workflow

### Testing with the Identity Wallet

1. **Start Both Services:**
   ```bash
   # Terminal 1: Wallet
   npm run dev  # Port 5173

   # Terminal 2: Issuer
   cd issuer && npm start  # Port 3001

   # Terminal 3: Verifier
   cd verifier && npm start  # Port 3002
   ```

2. **Get a Credential:**
   - Login to wallet (http://localhost:5173)
   - Go to issuer (http://localhost:3001)
   - Issue yourself a vaccination credential
   - Import it into your wallet

3. **Verify the Credential:**
   - Open verifier (http://localhost:3002)
   - Select "Restaurant" profile
   - In wallet, expand the credential
   - Toggle to "Privacy First"
   - Copy the JWT from QR code area (right-click → inspect → find JWT)
   - Paste into verifier
   - Click "Verify Credential"
   - See minimal claims verified!

4. **Try Full Disclosure:**
   - In wallet, toggle to "Full Disclosure"
   - Copy new JWT
   - Paste into verifier
   - See all claims verified!

## Architecture

```
verifier/
├── package.json          # Dependencies
├── server.js            # HTTP server (port 3002)
├── verifiers.json       # Verifier profiles config
├── verifier.js          # Verification logic
├── index.html           # UI (shadcn-inspired)
└── README.md           # This file
```

## Future Enhancements

- [ ] Real QR code scanning with jsQR library
- [ ] Verifiable Presentation support
- [ ] Challenge-response protocol
- [ ] Issuer registry/whitelist
- [ ] Revocation checking
- [ ] Batch verification
- [ ] Export verification receipts
- [ ] Multi-language support

## License

Educational demo - use as you wish!
