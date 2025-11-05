# 🚀 Running Without a Bundler

This application can run **without any bundler** using native ES modules and import maps!

## How It Works

### 1. **Import Maps**
Modern browsers support [import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) which allow you to map bare module specifiers (like `"dexie"`) to URLs.

The `index.html` file includes an import map that points all npm dependencies to [esm.sh](https://esm.sh), a fast CDN for ES modules:

```html
<script type="importmap">
{
  "imports": {
    "dexie": "https://esm.sh/dexie@4.0.1",
    "@noble/curves/ed25519": "https://esm.sh/@noble/curves@1.2.0/ed25519",
    ...
  }
}
</script>
```

### 2. **Native ES Modules**
All our source code uses ES module syntax:

```javascript
import { db } from './db/database.js';  // Relative imports for our code
import Dexie from 'dexie';              // Import map resolves to CDN
```

### 3. **Simple HTTP Server**
Browsers require ES modules to be served over HTTP (not `file://`). We provide a simple Node.js server in `server.js`.

## 🎯 Quick Start

### Option 1: Using Node.js Server (Recommended)

```bash
# Start the server
npm start

# Open browser to http://localhost:3000
```

The server automatically:
- Serves static files
- Sets correct MIME types
- Enables CORS
- Disables caching for development

### Option 2: Using Python

If you don't want to install npm packages:

```bash
# Python 3
python3 -m http.server 3000

# Open browser to http://localhost:3000
```

### Option 3: Using Any Static Server

You can use ANY static file server:

```bash
# Using npx (no installation required)
npx http-server -p 3000

# Using PHP
php -S localhost:3000

# Using Ruby
ruby -run -e httpd . -p 3000

# Using Deno
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts
```

## 📦 No Build Step Required!

### What You DON'T Need:
- ❌ `npm install` (if using Python/other servers)
- ❌ `npm run build`
- ❌ Webpack, Rollup, Parcel, or any bundler
- ❌ Transpilation or compilation
- ❌ node_modules (dependencies from CDN)

### What You DO Need:
- ✅ Modern browser with import maps support
- ✅ Simple HTTP server
- ✅ Internet connection (for CDN)

## 🌐 Browser Support

Import maps are supported in:
- ✅ Chrome 89+
- ✅ Edge 89+
- ✅ Safari 16.4+
- ✅ Firefox 108+

[Check current support](https://caniuse.com/import-maps)

## 🔒 Security Note

Dependencies are loaded from [esm.sh](https://esm.sh), a trusted CDN that:
- Serves ES modules from npm
- Uses immutable URLs (versions pinned)
- Supports subresource integrity (SRI)
- Has global edge network
- Is open source

### Offline Use

To run completely offline:

1. **Download dependencies:**
```bash
# Using wget
wget https://esm.sh/dexie@4.0.1 -O vendor/dexie.js
# ... repeat for all deps

# Or use npm to install locally
npm install
```

2. **Update import map to use local files:**
```html
<script type="importmap">
{
  "imports": {
    "dexie": "./vendor/dexie.js",
    ...
  }
}
</script>
```

## ⚡ Performance

### With Bundler (Vite):
- Build time: ~2-5 seconds
- Bundle size: ~500KB minified
- First load: 1 request (bundle)
- Dev server startup: ~500ms

### Without Bundler (Native ESM):
- Build time: 0 seconds ⚡
- Bundle size: N/A (modules loaded individually)
- First load: ~15-20 requests (cached after)
- Dev server startup: ~50ms ⚡

**Trade-offs:**
- 🟢 Faster development (no build step)
- 🟢 Instant updates (just refresh)
- 🟡 More HTTP requests (HTTP/2 helps)
- 🟡 Requires CDN or vendored deps

## 🛠️ Development Workflow

### Without Bundler:
```bash
# 1. Start server
npm start

# 2. Edit code in src/
# 3. Refresh browser - changes appear instantly!
```

No build step means:
- ⚡ Instant feedback
- 🔄 No watch mode needed
- 🐛 Easier debugging (source code visible)
- 📝 Simpler workflow

### With Bundler (still available):
```bash
# If you prefer Vite
npm run dev
```

## 📊 File Structure

```
wallet/
├── index.html          # Includes import map
├── server.js           # Simple HTTP server
├── src/
│   ├── app.js         # Main entry point
│   ├── auth/          # All .js files are ES modules
│   ├── crypto/
│   ├── db/
│   └── ...
└── package.json       # Optional (only for 'npm start')
```

## 🎓 Why This Works

Modern browsers can:
1. Load ES modules natively (`<script type="module">`)
2. Resolve imports using import maps
3. Fetch modules from any URL (including CDNs)
4. Cache modules efficiently
5. Handle dependency graphs automatically

This is the **future of web development** - no bundler required!

## 🔄 Switching Between Modes

You can use **both** approaches:

```bash
# No bundler (development)
npm start

# With bundler (development)
npm run dev

# Build for production (optimized bundle)
npm run build
```

Choose based on your needs:
- **No bundler**: Maximum simplicity, instant updates
- **With bundler**: Optimized production builds, better compatibility

## 🐛 Troubleshooting

### Import map not working?
- Check browser support (Chrome 89+, Firefox 108+, Safari 16.4+)
- Ensure you're using HTTP (not file://)
- Check browser console for errors

### CORS errors?
- Make sure you're using a proper HTTP server
- Check that CORS headers are set (server.js does this)

### Modules not loading?
- Check network tab in DevTools
- Verify CDN is accessible (esm.sh)
- Check for typos in import map

### Slow loading?
- First load downloads all modules (cached after)
- Use HTTP/2 server for parallel downloads
- Consider using Vite for production

## 📚 Learn More

- [Import Maps Spec](https://github.com/WICG/import-maps)
- [ES Modules in Browsers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [esm.sh Documentation](https://esm.sh/)

---

**TL;DR:** Just run `npm start` and open http://localhost:3000 - no build step needed! 🎉
