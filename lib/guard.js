const crypto = require('crypto');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const adminOk = (req) => { const t = process.env.ADMIN_TOKEN; return !!t && eq(req.headers['x-admin-token'] || '', t); };
const cronOk = (req) => {
  const k = process.env.CRON_SECRET; if (!k) return false;
  const h = (req.headers.authorization || '').replace(/^Bearer /, ''); const q = (req.query && req.query.key) || '';
  return eq(h, k) || eq(q, k);
};
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?(aetherpropertynetworks\.com|supportaether\.com|apn-platform-chi\.vercel\.app)$/i;
const originOk = (req) => ALLOWED.test(req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1'));
const body = (req) => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return {}; } };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
module.exports = { adminOk, cronOk, originOk, body, clean };
