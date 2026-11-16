/* Live contractor location for one active job.
   The contractor's page POSTs a position every few seconds while the job is active; the customer's page GETs it.
   Each position expires after 90 seconds on its own, and DELETE removes it the moment the job is submitted,
   so the link between the two ends when the job does.
   Storage is any Upstash-compatible Redis REST endpoint (Vercel Marketplace "Upstash Redis" sets these variables):
   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN. */
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?(aetherpropertynetworks\.com|supportaether\.com|apn-platform-chi\.vercel\.app)$/i;
const TTL = 90;

const store = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
};
const cmd = async (s, args) => {
  const r = await fetch(s.url, { method: 'POST', headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error('store');
  return (await r.json()).result;
};

module.exports = async (req, res) => {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1');
  if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  const s = store();
  const q = req.query || {};
  if (q.probe) return res.status(200).json({ configured: !!s });
  if (!s) return res.status(503).json({ error: 'not_configured' });

  const b = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : {};
  const ticket = String(b.ticket || q.ticket || ''), tkey = String(b.tkey || q.tkey || '');
  if (!/^[A-Za-z0-9-]{4,24}$/.test(ticket) || !/^[a-f0-9]{16,64}$/.test(tkey)) return res.status(400).json({ error: 'bad_ticket' });
  const key = `trk:${ticket}:${tkey}`;

  try {
    if (req.method === 'POST') {
      const lat = +b.lat, lng = +b.lng, acc = Math.min(+b.acc || 0, 5000);
      if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return res.status(400).json({ error: 'bad_position' });
      await cmd(s, ['SET', key, JSON.stringify({ lat, lng, acc, ts: Date.now() }), 'EX', TTL]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') { await cmd(s, ['DEL', key]); return res.status(200).json({ ok: true }); }
    if (req.method === 'GET') {
      const v = await cmd(s, ['GET', key]);
      return res.status(200).json(v ? Object.assign({ active: true }, JSON.parse(v)) : { active: false });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(502).json({ error: 'store_failed' });
  }
};
