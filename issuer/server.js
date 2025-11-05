import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = createServer(async (req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = await readFile(join(__dirname, filePath));
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🏢 Credential Issuer Service Started!`);
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`\n📝 Usage:`);
  console.log(`   1. Open http://localhost:${PORT} in your browser`);
  console.log(`   2. Fill in recipient DID and credential details`);
  console.log(`   3. Click "Issue Credential"`);
  console.log(`   4. User can scan QR code or copy JWT`);
  console.log(`   5. User pastes JWT in wallet's "Receive Credential"\n`);
});
