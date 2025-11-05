# Implementation TODO

## Status: QR Overflow Fixed ✅
## Remaining Work: Contact Sharing & Credential UI

---

## ✅ What's Fixed

1. **QR Code Overflow** - Profile pictures no longer cause "code length overflow" error
2. **UI Buttons Added** - Buttons for text-based sharing and importing
3. **Modal Styles** - CSS ready for credential modals

---

## 🚧 What Needs Implementation

### 1. Export Public Profile as Text (Profile Panel)

**Button:** `#exportProfileTextBtn` (already in HTML)

**Implementation needed in `src/app.js`:**

```javascript
// Add to setupEventListeners() function:
document.getElementById('exportProfileTextBtn')?.addEventListener('click', async () => {
  try {
    const { exportPublicProfile } = await import('./profile/profileManager.js');
    const profileJson = await exportPublicProfile(currentUser);

    // Copy to clipboard
    await navigator.clipboard.writeText(profileJson);
    showMessage('✅ Profile copied! Share this text with friends.', 'success');
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
});
```

**What it does:** Exports full profile (with links, bio, etc.) as JSON text that can be shared via messaging apps.

---

### 2. Import Contact from Text (Contacts Panel)

**Button:** `#importContactTextBtn` (already in HTML)

**Implementation needed in `src/app.js`:**

```javascript
// Add to setupEventListeners() function:
document.getElementById('importContactTextBtn')?.addEventListener('click', async () => {
  const profileText = prompt('Paste your friend\'s profile JSON here:');
  if (!profileText) return;

  try {
    const { importContactFromProfile } = await import('./contacts/contactManager.js');
    await importContactFromProfile(currentUser, profileText);
    showMessage('✅ Contact added successfully!', 'success');
    await loadContactsPanel(); // Refresh list
  } catch (error) {
    showMessage('Error importing contact: ' + error.message, 'error');
  }
});
```

**What it does:** Allows users to paste a friend's exported profile JSON to add them as a contact.

---

### 3. Scan QR Code for Contact (Contacts Panel)

**Button:** `#scanQRForContactBtn` (already in HTML)

**Implementation needed:**

```javascript
// Add to setupEventListeners():
document.getElementById('scanQRForContactBtn')?.addEventListener('click', () => {
  // Switch to scan panel
  switchPanel('scan');
  showMessage('📱 Point camera at friend\'s QR code', 'info');
});
```

---

### 4. QR Scanner Implementation (Scan Panel)

**Currently:** Panel exists but scanner not initialized

**Implementation needed in `src/app.js`:**

```javascript
// Add to loadScanPanel() function:
async function loadScanPanel() {
  const resultDiv = document.getElementById('scanResult');
  const readerDiv = document.getElementById('qr-reader');

  if (!qrScanner) {
    const { QRScanner, parseQRData } = await import('./utils/qrCode.js');
    qrScanner = new QRScanner('qr-reader');
  }

  try {
    await qrScanner.start(
      async (decodedText) => {
        // Stop scanning
        await qrScanner.stop();

        // Parse QR data
        const { parseQRData } = await import('./utils/qrCode.js');
        const { importContactFromProfile } = await import('./contacts/contactManager.js');

        const parsed = parseQRData(decodedText);

        if (parsed.type === 'profile') {
          // Import as contact
          await importContactFromProfile(currentUser, decodedText);
          showMessage('✅ Contact added from QR code!', 'success');
          switchPanel('contacts');
        } else if (parsed.type === 'jwt') {
          // It's a credential
          const { receiveCredential } = await import('./credentials/credentialManager.js');
          await receiveCredential(currentUser, parsed.data);
          showMessage('✅ Credential received!', 'success');
          switchPanel('credentials');
        } else if (parsed.type === 'did') {
          showMessage('DID scanned: ' + parsed.data, 'info');
        }
      },
      (error) => {
        console.warn('QR scan error:', error);
      }
    );

    resultDiv.innerHTML = '<div class="alert alert-info">📷 Camera active - point at QR code</div>';
  } catch (error) {
    resultDiv.innerHTML = '<div class="alert alert-error">❌ Camera access denied or not available</div>';
  }
}
```

**What it does:** Activates camera, scans QR codes, auto-detects if it's a profile or credential, and imports accordingly.

---

### 5. Issue Credential Modal

**Button:** `#showIssueCredBtn` (already in HTML)

**Need to add modal HTML** before `</div><!-- appContainer -->`:

```html
<!-- Issue Credential Modal -->
<div id="issueCredModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Issue Credential</h2>
      <button class="modal-close" onclick="document.getElementById('issueCredModal').classList.remove('active')">×</button>
    </div>

    <div class="form-group">
      <label for="issueCredRecipient">Recipient</label>
      <select id="issueCredRecipient" class="form-control">
        <option value="">Select a contact...</option>
      </select>
    </div>

    <div class="form-group">
      <label for="issueCredType">Credential Type</label>
      <input type="text" id="issueCredType" placeholder="e.g., MembershipCredential">
    </div>

    <div class="form-group">
      <label for="issueCredClaims">Claims (JSON)</label>
      <textarea id="issueCredClaims" placeholder='{"role": "member", "level": "gold"}'></textarea>
    </div>

    <div class="form-group">
      <label for="issueCredExpiry">Expires in (days)</label>
      <input type="number" id="issueCredExpiry" value="365">
    </div>

    <button id="issueCredSubmitBtn" class="btn btn-primary btn-full">Issue Credential</button>
  </div>
</div>
```

**Implementation in `src/app.js`:**

```javascript
// Add to setupEventListeners():
document.getElementById('showIssueCredBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('issueCredModal');

  // Load contacts into dropdown
  const { getContacts } = await import('./contacts/contactManager.js');
  const contacts = await getContacts(currentUser);

  const select = document.getElementById('issueCredRecipient');
  select.innerHTML = '<option value="">Select a contact...</option>' +
    contacts.map(c => `<option value="${c.contactDid}">${c.contactName}</option>`).join('');

  modal.classList.add('active');
});

document.getElementById('issueCredSubmitBtn')?.addEventListener('click', async () => {
  const recipientDid = document.getElementById('issueCredRecipient').value;
  const credType = document.getElementById('issueCredType').value;
  const claimsText = document.getElementById('issueCredClaims').value;
  const expiryDays = parseInt(document.getElementById('issueCredExpiry').value);

  if (!recipientDid || !credType || !claimsText) {
    return showMessage('Please fill all fields', 'error');
  }

  try {
    const claims = JSON.parse(claimsText);
    const password = prompt('Enter your password to sign the credential:');
    if (!password) return;

    const { issueCredential } = await import('./credentials/credentialManager.js');
    const result = await issueCredential(currentUser, password, {
      subjectDid: recipientDid,
      type: credType,
      claims,
      expiresInDays: expiryDays
    });

    document.getElementById('issueCredModal').classList.remove('active');
    showMessage('✅ Credential issued successfully!', 'success');
    await loadCredentialsPanel();

    // Show JWT for sharing
    prompt('Credential JWT (share this with recipient):', result.jwt);
  } catch (error) {
    showMessage('Error issuing credential: ' + error.message, 'error');
  }
});
```

---

### 6. Receive Credential Modal

**Button:** `#showReceiveCredBtn` (already in HTML)

**Need to add modal HTML:**

```html
<!-- Receive Credential Modal -->
<div id="receiveCredModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Receive Credential</h2>
      <button class="modal-close" onclick="document.getElementById('receiveCredModal').classList.remove('active')">×</button>
    </div>

    <div class="form-group">
      <label for="receiveCredJWT">Paste Credential JWT</label>
      <textarea id="receiveCredJWT" placeholder="Paste the JWT you received..." rows="8"></textarea>
    </div>

    <button id="receiveCredSubmitBtn" class="btn btn-primary btn-full">Verify & Save</button>
  </div>
</div>
```

**Implementation:**

```javascript
// Add to setupEventListeners():
document.getElementById('showReceiveCredBtn')?.addEventListener('click', () => {
  document.getElementById('receiveCredModal').classList.add('active');
});

document.getElementById('receiveCredSubmitBtn')?.addEventListener('click', async () => {
  const jwt = document.getElementById('receiveCredJWT').value.trim();
  if (!jwt) return showMessage('Please paste a credential JWT', 'error');

  try {
    const { receiveCredential } = await import('./credentials/credentialManager.js');
    const result = await receiveCredential(currentUser, jwt);

    document.getElementById('receiveCredModal').classList.remove('active');
    showMessage('✅ Credential verified and saved!', 'success');
    await loadCredentialsPanel();
  } catch (error) {
    showMessage('Credential verification failed: ' + error.message, 'error');
  }
});
```

---

## 🎯 Integration Steps

1. **Add modal HTML** - Insert both modals in `index.html` before `</div><!-- appContainer -->`
2. **Update `src/app.js`** - Add all the handler functions above to `setupEventListeners()`
3. **Update `loadScanPanel()`** - Replace placeholder with actual scanner implementation
4. **Test each feature**:
   - Export profile as text
   - Import contact from text
   - Scan QR codes
   - Issue credentials
   - Receive credentials

---

## 📝 Quick Integration Command

All the code above can be added to `src/app.js` in the `setupEventListeners()` function around line 180.

The modals should be added to `index.html` around line 670 (before `</div><!-- appContainer -->`).

---

## 🧪 Testing Checklist

- [ ] Export profile as text - copies to clipboard
- [ ] Import contact from text - parses JSON and adds contact
- [ ] Scan QR code - camera activates
- [ ] Scan profile QR - adds contact automatically
- [ ] Issue credential modal opens
- [ ] Issue credential - contact dropdown populates
- [ ] Credential issuance works - prompts for password
- [ ] Receive credential modal opens
- [ ] Paste credential JWT - verifies and saves
- [ ] Credentials appear in list after operations

---

## 🚀 Priority Order

**High Priority (Core Functionality):**
1. Export/Import profile text (easiest, most useful)
2. Credential issuance modal
3. Credential receiving modal

**Medium Priority:**
4. QR scanner implementation

**Low Priority (Nice to Have):**
5. Improve error handling
6. Add loading indicators
7. Better modal styling

---

This gives you a complete roadmap of what's needed!
