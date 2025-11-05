/**
 * Simple HTTP Server for Identity Wallet
 *
 * Serves the application without requiring a bundler.
 * Uses native ES modules with import maps.
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  let filePath = req.url === '/' ? '/index.html' : req.url;

  // Remove query parameters
  filePath = filePath.split('?')[0];

  const fullPath = join(__dirname, filePath);
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = await readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 Identity Wallet Server Started!');
  console.log('');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log('');
  console.log('💡 Running without bundler using native ES modules');
  console.log('📦 Dependencies loaded from esm.sh CDN');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});
