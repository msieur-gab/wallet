# Credential Issuer Service

A third-party credential issuer service that generates W3C-compliant Verifiable Credentials for the Personal Identity Wallet.

## Quick Start

```bash
# From the issuer directory
npm install
npm start
```

Then open http://localhost:3001 in your browser.

## Usage

### For Issuers:

1. **Start the issuer service:**
   ```bash
   cd issuer
   npm start
   ```

2. **Access the web interface:**
   - Open http://localhost:3001

3. **Issue a credential:**
   - Get the recipient's DID from their wallet profile
   - Fill in the credential type and claims
   - Click "Issue Credential"
   - Display the QR code or share the JWT

### For Wallet Users:

1. **Receive a credential:**
   - **Option A (QR Code):**
     - Open wallet → Scan QR tab
     - Scan the issuer's QR code
     - Credential imports automatically

   - **Option B (JWT):**
     - Copy the JWT from issuer
     - Open wallet → Credentials tab
     - Click "Receive Credential"
     - Paste JWT
     - Credential is verified and stored

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Issuer    │         │     User     │         │   Wallet    │
│  (Port      │         │              │         │  (Port      │
│   3001)     │         │              │         │   3000)     │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Visit issuer site  │                        │
       │<──────────────────────│                        │
       │                       │                        │
       │ 2. Fill form & submit │                        │
       │<──────────────────────│                        │
       │                       │                        │
       │ 3. Generate & sign VC │                        │
       │       (JWT)           │                        │
       │                       │                        │
       │ 4. Display QR/JWT     │                        │
       │──────────────────────>│                        │
       │                       │                        │
       │                       │ 5. Scan QR or copy JWT │
       │                       │───────────────────────>│
       │                       │                        │
       │                       │ 6. Verify & store      │
       │                       │      credential        │
       │                       │                        │
```

## Credential Format

The issuer generates W3C Verifiable Credentials in JWT format:

```json
{
  "iss": "did:key:z6Mk...",
  "sub": "did:key:z6Mk...",
  "iat": 1699564800,
  "exp": 1731187200,
  "vc": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "MembershipCredential"],
    "credentialSubject": {
      "id": "did:key:z6Mk...",
      "name": "John Doe",
      "memberSince": "2024"
    },
    "issuer": {
      "id": "did:key:z6Mk...",
      "name": "Demo Credential Issuer"
    },
    "issuanceDate": "2024-11-05T00:00:00.000Z",
    "expirationDate": "2025-11-05T00:00:00.000Z"
  }
}
```

## Security

### Current Implementation (Demo)
- ⚠️ Generates new issuer keys on each restart
- ⚠️ No persistent key storage
- ⚠️ No authentication required
- ⚠️ No rate limiting

### Production Recommendations
- 🔒 Load issuer private key from environment variables or key vault
- 🔒 Implement user authentication before issuing
- 🔒 Add rate limiting to prevent abuse
- 🔒 Store issued credentials for audit trail
- 🔒 Implement credential revocation list
- 🔒 Use HTTPS in production
- 🔒 Validate recipient DIDs against database
- 🔒 Log all issuance events

## Credential Types

Pre-configured types:
- `MembershipCredential` - Organization memberships
- `AgeCredential` - Age verification
- `EducationCredential` - Degrees, certificates
- `EmploymentCredential` - Job history, positions
- `CertificationCredential` - Professional certifications

## Custom Claims

You can include any JSON-serializable claims:

```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "memberSince": "2024-01-15",
  "level": "gold",
  "verified": true,
  "score": 95
}
```

## Testing

### Test Flow:

1. **Start wallet:**
   ```bash
   cd /path/to/wallet
   npm start
   # Runs on http://localhost:3000
   ```

2. **Start issuer:**
   ```bash
   cd /path/to/wallet/issuer
   npm start
   # Runs on http://localhost:3001
   ```

3. **Get wallet DID:**
   - Open http://localhost:3000
   - Login/register
   - Go to Profile tab
   - Copy your DID

4. **Issue credential:**
   - Open http://localhost:3001
   - Paste DID in "Recipient DID"
   - Fill in claims
   - Click "Issue Credential"
   - Copy the JWT

5. **Import to wallet:**
   - Go back to wallet (http://localhost:3000)
   - Click Credentials tab
   - Click "Receive Credential"
   - Paste JWT
   - ✅ Credential verified and stored!

## Files

- `package.json` - Dependencies and scripts
- `server.js` - HTTP server (port 3001)
- `index.html` - Web interface
- `issuer.js` - Credential issuance logic
- `README.md` - This file

## Extending

### Add Custom Credential Type:

1. Edit `index.html`:
   ```html
   <option value="YourCustomType">Your Custom Type</option>
   ```

2. No other changes needed!

### Add API Endpoint:

See `ISSUER-INTEGRATION.md` in the parent directory for API-based architecture.

## Troubleshooting

**"Invalid DID format"**
- Make sure the DID starts with `did:key:z6Mk`
- Copy the full DID from wallet profile

**"Invalid JSON in claims"**
- Validate JSON syntax
- Use double quotes for keys and string values
- No trailing commas

**"Credential verification failed"**
- Check that wallet and issuer are both running
- Verify the JWT wasn't truncated when copying
- Check browser console for detailed errors

**Port already in use**
- Change PORT in `server.js`
- Or kill existing process: `lsof -ti:3001 | xargs kill`

## Next Steps

1. ✅ Test credential issuance
2. ⬜ Add user authentication
3. ⬜ Implement credential templates
4. ⬜ Add revocation list
5. ⬜ Create API endpoints (see ISSUER-INTEGRATION.md)
6. ⬜ Deploy to production

## Support

For questions or issues, refer to:
- Main wallet README: `../README.md`
- Integration guide: `../ISSUER-INTEGRATION.md`
- W3C VC spec: https://www.w3.org/TR/vc-data-model/
