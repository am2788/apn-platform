/* Heartbeat from each open page: who is online right now. Counts as online for 120 s after the last beat. */
const store = require('../lib/store'); const g = require('../lib/guard');
module.exports = async (req, res) => {
  if (!g.originOk(req)) return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!store.configured()) return res.status(503).json({ error: 'not_configured' });
  const b = g.body(req); const sid = g.clean(b.sid, 40);
  if (!/^[A-Za-z0-9-]{6,40}$/.test(sid)) return res.status(400).json({ error: 'bad_sid' });
  const now = Date.now();
  const meta = { role: ['customer', 'contractor', 'admin', 'visitor'].includes(b.role) ? b.role : 'visitor', page: g.clean(b.page, 40), name: g.clean(b.name, 60), since: +b.since > 0 ? +b.since : now, ts: now };
  try {
    await store.cmd(['ZADD', 'presence', now, sid]);
    await store.cmd(['HSET', 'presence:meta', sid, JSON.stringify(meta)]);
    await store.cmd(['ZINCRBY', 'visits:' + new Date(now).toISOString().slice(0, 10), 0, sid]);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ error: 'store_failed' }); }
};
