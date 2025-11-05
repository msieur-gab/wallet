/**
 * Credential Verifier - HTTP Server
 *
 * Simple HTTP server for the credential verification service.
 * Serves the verifier UI on port 3002.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3002;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'text/plain';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 - File Not Found');
      } else {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🔍 Credential Verifier running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n📋 Available verifier types:`);
  console.log(`   - Restaurant/Public Place (minimal claims)`);
  console.log(`   - Medical Facility (full claims)`);
  console.log(`   - Government Agency (full claims)`);
  console.log(`\n✨ Ready to verify credentials!\n`);
});
