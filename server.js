'use strict';
/**
 * Chat nội bộ (kiểu Zalo) - máy chủ Node.js thuần, không cần cài thư viện.
 * Dữ liệu nằm trong thư mục "dataDir" (đặt trong Google Drive). Máy nào có thư mục đó cũng chạy được:
 * nhờ cơ chế "lease" chỉ MỘT máy làm máy chủ tại một thời điểm, máy còn lại tự tiếp quản khi máy chính tắt.
 */
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '8';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');

const A = require('./lib/core');
const persist = require('./lib/persist');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const ME = os.hostname() + ':' + process.pid + ':' + crypto.randomBytes(3).toString('hex');

process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));

// ---------- Lease: chỉ một máy làm máy chủ ----------
let leaseFile, leaseTimer;
const readLease = () => { try { return JSON.parse(fs.readFileSync(leaseFile, 'utf8')); } catch { return null; } };
const writeLease = () => fs.writeFileSync(leaseFile, JSON.stringify({ id: ME, host: os.hostname(), ts: now(), port: A.cfg.port }));
async function acquireLease() {
  leaseFile = path.join(A.DATA, 'lease.json');
  let told = false;
  for (;;) {
    const l = readLease();
    if (!l || l.id === ME || now() - l.ts > A.cfg.leaseSeconds * 1000 || process.env.FORCE) {
      writeLease();
      await sleep(1500); // chờ xem có máy khác cùng tranh không
      const l2 = readLease();
      if (l2 && l2.id === ME) break;
    }
    if (!told) {
      told = true;
      console.log(`\n[DỰ PHÒNG] Máy ${l ? l.host : '?'} đang là máy chủ. Máy này chờ và sẽ TỰ ĐỘNG tiếp quản nếu máy kia ngừng hoạt động (~${A.cfg.leaseSeconds}s).`);
    }
    await sleep(5000);
  }
  leaseTimer = setInterval(() => {
    const l = readLease();
    if (l && l.id !== ME && now() - l.ts < A.cfg.leaseSeconds * 1000) {
      console.error('\nMáy khác đã giành quyền máy chủ. Máy này dừng lại để tránh xung đột dữ liệu.');
      process.exit(3);
    }
    try { writeLease(); } catch {}
  }, 10000);
}

// ---------- Tệp tĩnh (nạp sẵn + nén gzip trong RAM) ----------
const PUB = path.join(__dirname, 'public');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', webmanifest: 'application/manifest+json', png: 'image/png', ico: 'image/x-icon', mp3: 'audio/mpeg' };
const statics = new Map();
function loadStatic() {
  for (const f of fs.readdirSync(PUB)) {
    const buf = fs.readFileSync(path.join(PUB, f));
    const ext = f.split('.').pop();
    statics.set('/' + f, { buf, gz: /^(html|js|css|svg|webmanifest)$/.test(ext) ? zlib.gzipSync(buf, { level: 9 }) : null, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"' });
  }
}

// ---------- HTTP ----------
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), display-capture=(self), fullscreen=(self)',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
};
function jsonOut(res, req, code, obj, retry) {
  if (res.headersSent) return;
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (retry) h['Retry-After'] = String(retry);
  if (s.length > 1024 && req && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    zlib.gzip(s, { level: 1 }, (e, gz) => {
      if (res.destroyed) return;
      if (e) { res.writeHead(code, h); return res.end(s); }
      res.writeHead(code, Object.assign(h, { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' })); res.end(gz);
    });
    return;
  }
  res.writeHead(code, h); res.end(s);
}
const notFound = res => { if (!res.headersSent) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Không tìm thấy'); } };

function readBody(req, limit) {
  return new Promise((ok, fail) => {
    let n = 0; const ch = [];
    const timer = setTimeout(() => { fail(new A.HttpError(408, 'Gửi dữ liệu quá chậm')); setTimeout(() => req.destroy(), 300); }, 15000);
    let dead = false;
    req.on('data', c => { if (dead) return; n += c.length; if (n > limit) { dead = true; clearTimeout(timer); fail(new A.HttpError(413, 'Dữ liệu quá lớn')); setTimeout(() => req.destroy(), 300); return; } ch.push(c); });
    req.on('end', () => {
      clearTimeout(timer);
      if (!n) return ok({});
      try { const o = JSON.parse(Buffer.concat(ch).toString('utf8')); ok(o && typeof o === 'object' && !Array.isArray(o) ? o : {}); } catch { fail(new A.HttpError(400, 'JSON không hợp lệ')); }
    });
    req.on('error', e => { clearTimeout(timer); fail(e); });
  });
}

function serveStatic(req, res, pathname) {
  const f = statics.get(pathname === '/' ? '/index.html' : pathname);
  if (!f) return notFound(res);
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, SEC); return res.end(); }
  const h = Object.assign({ 'Content-Type': f.type, ETag: f.etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' }, SEC);
  if (f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { h['Content-Encoding'] = 'gzip'; res.writeHead(200, h); return res.end(req.method === 'HEAD' ? undefined : f.gz); }
  res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : f.buf);
}

function sse(req, res, u, ip) {
  A.limit('sseip:' + ip, 60, 1, 'Quá nhiều kết nối');
  let set = A.clients.get(u.id);
  if (!set) { set = new Set(); A.clients.set(u.id, set); }
  while (set.size >= A.cfg.sseMaxPerUser) { const old = set.values().next().value; set.delete(old); old.end(); } // giữ tối đa N thiết bị mỗi người
  res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }, SEC));
  res.write('retry: 4000\n\n' + A.ev('ready', { t: now() }));
  set.add(res);
  req.socket.setTimeout(0); req.socket.setNoDelay(true);
  req.on('close', () => {
    set.delete(res);
    if (!set.size) { A.clients.delete(u.id); u._rd.ls = now(); A.saveRd(u); }
  });
}

const BODY_LIMIT = { default: 64 * 1024, big: 600 * 1024 };
async function handle(req, res) {
  const ip = A.ip(req);
  A.stats.req++;
  const banned = A.ipBanned(ip);
  if (banned) { res.writeHead(429, { 'Retry-After': String(banned), 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bị tạm chặn do hoạt động bất thường'); }
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return notFound(res); }
  const isApi = pathname.startsWith('/api/') || pathname.startsWith('/files/') || pathname.startsWith('/dl/');
  if (!isApi) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);
    return serveStatic(req, res, pathname);
  }
  for (const [k, v] of Object.entries(SEC)) res.setHeader(k, v);
  const org = req.headers.origin, cross = !!org && A.originOk(org);
  if (cross) {
    res.setHeader('Access-Control-Allow-Origin', org); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', String(req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Nexa-Bearer').slice(0, 300));
      res.setHeader('Access-Control-Max-Age', '600'); res.writeHead(204); return res.end();
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  if (A.maintenance && pathname !== '/api/admin/data/status' && pathname !== '/api/me') { res.setHeader('Retry-After', '10'); return jsonOut(res, req, 503, { error: A.maintenance }, 10); }
  if (pathname !== '/api/events') A.limit('ip:' + ip, 300, A.cfg.ipRatePerSec, 'Quá nhiều yêu cầu từ địa chỉ của bạn');

  if (req.method === 'POST') {
    const o = req.headers.origin;
    if (o) { let ok = false; try { ok = new URL(o).host === req.headers.host || A.originOk(o); } catch {} if (!ok) { A.penalize(ip, 5); A.abuse('BAD_ORIGIN', ip, 'Origin: ' + String(o).slice(0, 100), A.reqMeta(req)); A.bad('Nguồn gửi không hợp lệ', 403); } }
  }
  let u = A.authUser(req);
  const isMedia = (pathname.startsWith('/files/') || pathname.startsWith('/dl/')) && req.method === 'GET';
  if (!u && isMedia) u = A.mediaUser(url.searchParams.get('mt'));
  if (u && !A.platformOk(u, req)) { A.abuse('PLATFORM_DENIED', u.username, pathname, A.reqMeta(req)); A.bad('Quản trị viên không cho phép tài khoản này dùng trên ' + A.DEVICE_NAMES[A.deviceOf(req)], 403); }

  if (u && req.method === 'POST') u._meta = A.reqMeta(req);
  if (pathname === '/api/events' && req.method === 'GET') { if (!u) A.bad('Chưa đăng nhập', 401); return sse(req, res, u, ip); }
  if (pathname === '/api/upload' && req.method === 'POST') { if (!u) { req.resume(); A.bad('Chưa đăng nhập', 401); } return A.handleUpload(req, res, u, url, ip); }
  if (pathname.startsWith('/files/') && req.method === 'GET') { if (!u) A.bad('Chưa đăng nhập', 401); return A.serveFile(req, res, u, pathname.split('/')[2] || ''); }

  if (pathname.startsWith('/dl/') && req.method === 'GET') {
    if (!u) A.bad('Chưa đăng nhập', 401);
    const name = decodeURIComponent(pathname.slice(4));
    const f = A.downloadFiles().find(x => x.name === name); if (!f) A.bad('Không tìm thấy tệp', 404);
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/octet-stream', 'Content-Length': f.size, 'Content-Disposition': 'attachment; filename="' + f.name.replace(/"/g, '') + '"' }, SEC));
    return fs.createReadStream(f.path).on('error', () => res.destroy()).pipe(res);
  }
  const r = A.routes[req.method + ' ' + pathname];
  if (!r) return jsonOut(res, req, 404, { error: 'Không tìm thấy' });
  if (!r.pub && !u) { A.penalize(ip, 1); A.bad('Chưa đăng nhập', 401); }
  if (r.admin && u.role !== 'admin') { A.abuse('ADMIN_DENIED', u.username, pathname, A.reqMeta(req)); A.bad('Chỉ quản trị viên mới có quyền này', 403); }
  const body = req.method === 'POST' ? await readBody(req, r.big ? BODY_LIMIT.big : BODY_LIMIT.default) : {};
  const result = await r.fn({ req, res, u, url, body, ip });
  if (result && result.__raw) return jsonOut(res, req, 200, result.__raw);
  const out = result || { ok: true };
  if (res._tok && req.headers['x-nexa-bearer'] && typeof out === 'object') out.token = res._tok; // ứng dụng/trang tĩnh không dùng cookie
  jsonOut(res, req, 200, out);
}

function onError(req, res, e) {
  if (e.status === 429) A.penalize(A.ip(req), 1);
  if (e.status === 401 && req.method === 'POST') A.penalize(A.ip(req), 2);
  if (!e.status) console.error('[lỗi]', req.method, req.url, e);
  jsonOut(res, req, e.status || 500, { error: e.status ? e.message : 'Lỗi máy chủ' }, e.retry);
}

// ---------- Khởi động ----------
(async () => {
  try { A.init(__dirname); } catch (e) { console.error('\n' + e.message + '\nHãy kiểm tra "dataDir" trong config.json (ví dụ: "G:/My Drive/ChatData").\n'); process.exit(1); }
  require('./routes/auth'); require('./routes/chat'); require('./routes/groups'); require('./routes/social'); require('./routes/files'); require('./routes/calls'); require('./routes/admin'); require('./routes/data'); require('./routes/push'); require('./routes/ai'); require('./routes/report');
  await acquireLease();
  try { A.load(); } catch (e) { console.error('\n' + e.message + '\n'); process.exit(1); }
  loadStatic(); A.startBackground();

  const onReq = (req, res) => handle(req, res).catch(e => onError(req, res, e));
  let server, scheme = 'http';
  if (A.cfg.https) {
    const cdir = path.join(__dirname, 'certs');
    let key, cert;
    if (typeof A.cfg.https === 'object' && A.cfg.https.key) { key = fs.readFileSync(A.cfg.https.key); cert = fs.readFileSync(A.cfg.https.cert); }
    else {
      const kf = path.join(cdir, 'key.pem'), cf = path.join(cdir, 'cert.pem');
      if (!fs.existsSync(cf)) { fs.mkdirSync(cdir, { recursive: true }); const g = require('./lib/certgen').generate(); fs.writeFileSync(kf, g.key); fs.writeFileSync(cf, g.cert); console.log('Đã tạo chứng chỉ HTTPS tự ký trong thư mục certs/'); }
      key = fs.readFileSync(kf); cert = fs.readFileSync(cf);
    }
    server = https.createServer({ key, cert, connectionsCheckingInterval: 2000 }, onReq); scheme = 'https';
  } else server = http.createServer({ connectionsCheckingInterval: 2000 }, onReq);
  server.headersTimeout = 20000; server.requestTimeout = 0; server.keepAliveTimeout = 65000; server.maxConnections = A.cfg.maxConnections;
  server.on('connection', s => s.setTimeout(120000, () => { if (!s.destroyed && !s._sse) s.destroy(); }));
  server.on('clientError', (e, s) => { if (s.writable) s.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); else s.destroy(); });
  server.listen(A.cfg.port, '0.0.0.0', () => {
    console.log(`\n=== ${A.cfg.appName} đang chạy (${scheme.toUpperCase()}) ===`);
    console.log(`Thư mục dữ liệu: ${A.DATA}`);
    console.log(`Trên máy này:    ${scheme}://localhost:${A.cfg.port}`);
    for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`Trong mạng LAN:  ${scheme}://${i.address}:${A.cfg.port}   (gửi link này cho mọi người)`);
    if (scheme === 'http') console.log('LƯU Ý: Gọi video, chia sẻ màn hình, gửi vị trí và ghi âm cần HTTPS (đặt "https": true trong config.json).');
    console.log(`Đã có ${A.users.size} tài khoản. ${A.users.size ? '' : 'Người đăng ký đầu tiên sẽ là quản trị viên.'}\n`);
  });
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Cổng ${A.cfg.port} đang được dùng. Hãy đổi "port" trong config.json.` : e.message); process.exit(1); });

  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    console.log('\nĐang lưu dữ liệu và thoát...');
    clearInterval(leaseTimer);
    for (const set of A.clients.values()) for (const r of set) r.end();
    server.close();
    try { await persist.flushAll(); } catch {}
    try { const l = readLease(); if (l && l.id === ME) fs.unlinkSync(leaseFile); } catch {}
    process.exit(A.exitCode || 0);
  };
  A.restart = () => { A.exitCode = process.env.ZOLA_SUPERVISED === '1' ? 75 : 0; setTimeout(shutdown, 800); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
})();
