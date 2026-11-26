import { createServer } from 'node:http';
import { readFile, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const routes = new Map([
  ['/api/generate', () => import('./api/generate.js')],
  ['/api/v1/generate', () => import('./api/v1/generate.js')],
  ['/api/v1/regex-test', () => import('./api/v1/regex-test.js')],
  ['/api/v1/generate-and-notify', () => import('./api/v1/generate-and-notify.js')],
  ['/api/webhooks/echo', () => import('./api/webhooks/echo.js')]
]);
const staticFiles = new Map([['/', ['index.html','text/html; charset=utf-8']], ['/index.html', ['index.html','text/html; charset=utf-8']], ['/docs.html', ['docs.html','text/html; charset=utf-8']]]);

function responseAdapter(res) {
  return {
    setHeader: (name, value) => res.setHeader(name, value),
    status(code) { res.statusCode = code; return this; },
    json(body) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return this; },
    end() { res.end(); return this; }
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = routes.get(url.pathname);
  if (route) {
    let body = {};
    if (['POST','PUT','PATCH'].includes(req.method)) {
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) { res.writeHead(413, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'payload_too_large',message:'Request body exceeds 1 MB.'})); return; } chunks.push(chunk); }
        const raw = Buffer.concat(chunks).toString('utf8'); body = raw ? JSON.parse(raw) : {};
      } catch { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'invalid_json',message:'Send a valid JSON request body.'})); return; }
    }
    req.body = body;
    try { const module = await route(); await module.default(req, responseAdapter(res)); }
    catch (error) { if (!res.headersSent) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'internal_error',message:'The request could not be completed.'})); } }
    return;
  }
  const file = staticFiles.get(url.pathname);
  if (!file) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Not found'); return; }
  readFile(path.join(root,file[0]), (error, content) => {
    if (error) { res.writeHead(500); res.end('Could not load page'); return; }
    res.writeHead(200, {'Content-Type':file[1], 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin'}); res.end(content);
  });
});
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`Regex Studio is running at http://localhost:${port}`));
