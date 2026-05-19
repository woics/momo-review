// dev-server.js — servidor local sin npm install
const http = require('http');
const fs = require('fs');
const path = require('path');

// Cargar .env si existe
try {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const PORT = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY || '';

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace('GEMINI_API_KEY_PLACEHOLDER', apiKey);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(PORT, () => {
  console.log(`\n🍑 Momo Review corriendo en → http://localhost:${PORT}\n`);
});
