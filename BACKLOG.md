# Product Backlog & Roadmap

## 🎯 Current State Assessment

### ✅ Completed Features
- Identity wallet with DID support
- Credential issuance and verification
- Profile management with avatars
- Contact management
- Selective disclosure (privacy-first credentials)
- HC1 QR code format (compact, scannable)
- Verifier service
- Issuer service
- Zero-knowledge proofs (basic)

### 🚨 Technical Debt & Issues
- **Design inconsistency**: Different UI patterns across wallet/issuer/verifier
- **Code duplication**: QR logic repeated in multiple places
- **Maintainability**: Monolithic app.js (~1000+ lines)
- **No component system**: Everything inline in HTML strings
- **Event handling**: Manual DOM manipulation, no reactive patterns
- **Styling**: Inline styles, hard to theme consistently

---

## 📋 PHASE 1: Architecture & Refactoring (PRIORITY)

### 1.1 Component Architecture
**Goal**: Create reusable, self-contained components

**Approach**: Web Components + Lit
- ✅ Native browser support (no framework lock-in)
- ✅ Scoped styles and logic
- ✅ Reactive properties
- ✅ Event handling with decorators
- ✅ Small bundle size (~5KB)

**Components to Extract**:
```
wallet-qr-scanner/
  ├── scanner.component.js
  ├── scanner.styles.js
  └── scanner.test.js

wallet-qr-generator/
  ├── generator.component.js
  ├── generator.styles.js
  └── generator.test.js

wallet-credential-card/
  ├── card.component.js
  ├── card.styles.js
  └── card.test.js

wallet-profile-header/
  ├── header.component.js
  ├── header.styles.js
  └── header.test.js

wallet-contact-list/
  ├── list.component.js
  ├── list.styles.js
  └── list.test.js
```

### 1.2 Design System
**Goal**: Consistent UI/UX across all services

**Tasks**:
- [ ] Define design tokens (colors, spacing, typography)
- [ ] Create shared component library
- [ ] Build Storybook for component showcase
- [ ] Implement dark mode support
- [ ] Responsive design patterns (mobile-first)

**Design System Structure**:
```
design-system/
  ├── tokens/
  │   ├── colors.js
  │   ├── spacing.js
  │   └── typography.js
  ├── components/
  │   ├── button.component.js
  │   ├── input.component.js
  │   ├── card.component.js
  │   └── modal.component.js
  └── themes/
      ├── light.js
      └── dark.js
```

### 1.3 State Management
**Goal**: Centralized, reactive state

**Approach**: Lightweight state management
- Consider: Zustand, Jotai, or Lit Context
- Replace IndexedDB direct calls with state layer
- Event bus for cross-component communication

### 1.4 Code Organization
**Goal**: Modular, scalable structure

**New Structure**:
```
wallet/
  ├── src/
  │   ├── components/        # Reusable Web Components
  │   ├── features/          # Feature modules
  │   │   ├── auth/
  │   │   ├── credentials/
  │   │   ├── contacts/
  │   │   └── profile/
  │   ├── shared/            # Shared utilities
  │   │   ├── crypto/
  │   │   ├── qr/
  │   │   └── storage/
  │   ├── design-system/     # UI components
  │   └── app.js             # Entry point (< 200 lines)
  ├── issuer/
  │   └── uses shared components
  ├── verifier/
  │   └── uses shared components
  └── docs/
```

---

## 📋 PHASE 2: Feature Backlog (FUTURE)

### 2.1 Authentication & Sessions
**Epic**: "Login with Identity Wallet" for third-party apps

**User Stories**:
- As a user, I want to login to apps using my DID
- As a user, I want to see all active sessions in my wallet
- As a user, I want to revoke app access anytime
- As a developer, I want an SDK to integrate wallet authentication

**Technical Requirements**:
- [ ] did-auth protocol implementation
- [ ] Session credential system
- [ ] Active sessions UI panel
- [ ] Revocation registry
- [ ] App-specific key derivation (HKDF)
- [ ] OAuth 2.0-like authorization flow
- [ ] JavaScript SDK for app integration

**Integration Example**:
```html
<!-- Third-party app integration -->
<script src="https://wallet.app/sdk.js"></script>
<button onclick="loginWithWallet()">
  🔐 Login with Identity Wallet
</button>
```

### 2.2 End-to-End Encryption
**Epic**: App data encryption with user's keys

**Features**:
- [ ] Derive encryption keys from master key
- [ ] Client-side encryption API
- [ ] Key rotation support
- [ ] Secure key backup/recovery

### 2.3 Example Integration: Note-Taking App
**Goal**: Reference implementation showing wallet integration

**Features**:
- [ ] Login with wallet
- [ ] E2E encrypted notes
- [ ] Session management
- [ ] Revocation handling
- [ ] Open-source demo app

---

## 🎨 PHASE 3: Design Improvements (PARALLEL)

### 3.1 Visual Design
- [ ] Professional logo/branding
- [ ] Consistent color scheme
- [ ] Icon system (Lucide or Heroicons)
- [ ] Animations and transitions
- [ ] Loading states and skeletons

### 3.2 UX Improvements
- [ ] Onboarding flow
- [ ] Empty states
- [ ] Error handling (user-friendly messages)
- [ ] Success confirmations
- [ ] Keyboard shortcuts
- [ ] Accessibility (ARIA, screen readers)

### 3.3 Mobile Experience
- [ ] Mobile-optimized layouts
- [ ] Touch gestures
- [ ] Pull-to-refresh
- [ ] Native-like navigation
- [ ] PWA support (offline mode)

---

## 🔧 Technology Stack (Proposed)

### Current Stack
```
Frontend: Vanilla JS + HTML
Storage: IndexedDB (Dexie)
Crypto: @noble/curves, did-jwt
QR: qr-code-styling, html5-qrcode
Server: Node.js HTTP server
```

### Proposed Stack (After Refactor)
```
Components: Web Components + Lit
State: Zustand / Jotai
Storage: IndexedDB (Dexie) ✓
Crypto: @noble/curves, did-jwt ✓
QR: Custom wrapper components
Design: Tailwind CSS / Open Props
Build: Vite ✓
Testing: Vitest + Web Test Runner
```

---

## 📊 Implementation Priority

### HIGH PRIORITY (Do First)
1. ✅ **Component Architecture Plan** (this document)
2. 🔨 **Extract QR Components** (most reused)
3. 🔨 **Design System Foundation** (tokens + basic components)
4. 🔨 **Refactor app.js** (split into feature modules)

### MEDIUM PRIORITY (Do Next)
5. 🔜 **Unified styling** (remove inline styles)
6. 🔜 **State management layer**
7. 🔜 **Component library completion**

### LOW PRIORITY (Future)
8. 📅 **Authentication/Sessions** (new feature)
9. 📅 **E2E Encryption API**
10. 📅 **Demo note-taking app**

---

## 🚀 Next Steps

### Immediate Actions
1. **Discuss & Approve** this plan
2. **Choose component approach**:
   - Option A: Web Components + Lit (recommended)
   - Option B: Keep vanilla JS but modularize
   - Option C: Full framework (React/Vue/Svelte)
3. **Create design tokens** (colors, spacing, etc.)
4. **Start with QR components** (most reused, easy win)

### Questions to Answer
- [ ] Do we want Lit for Web Components? (Yes/No/Alternative?)
- [ ] Do we want Tailwind CSS or custom CSS?
- [ ] Do we want to keep Vite or switch bundler?
- [ ] Do we want component tests? (Recommended: yes)
- [ ] Do we want Storybook for components?

---

## 📝 Notes

**Why Web Components + Lit?**
- ✅ No vendor lock-in (standards-based)
- ✅ Works with any framework (or no framework)
- ✅ Scoped styles (Shadow DOM)
- ✅ Small bundle size
- ✅ Future-proof (native browser API)
- ✅ Can be used in issuer, verifier, and future apps

**Why Refactor Before New Features?**
- ⚠️ Current codebase is hard to maintain
- ⚠️ Adding features will make it worse
- ⚠️ Design inconsistency confuses users
- ✅ Better foundation = faster feature development later
- ✅ Reusable components = less code duplication

**Timeline Estimate** (rough):
- Phase 1 (Refactor): 2-3 weeks
- Phase 2 (Auth feature): 1-2 weeks
- Phase 3 (Design): Ongoing

---

## 🎯 Success Metrics

After refactoring, we should have:
- ✅ app.js reduced from ~1000 lines to < 200 lines
- ✅ 15+ reusable Web Components
- ✅ 0 inline styles (all in component styles)
- ✅ Consistent design across wallet/issuer/verifier
- ✅ Easy to add new features (< 1 day for simple features)
- ✅ Other developers can contribute easily

---

**Status**: 📋 Planning Phase
**Last Updated**: 2025-11-05
**Next Review**: After refactoring completion
