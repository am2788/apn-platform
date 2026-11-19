/* Admin data. Every call needs the x-admin-token header. */
const store = require('../lib/store'); const g = require('../lib/guard'); const H = require('../lib/health'); const A = require('../lib/alert');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!g.adminOk(req)) { await sleep(800); return res.status(401).json({ error: 'unauthorized' }); }
  const view = (req.query && req.query.view) || 'summary';
  const has = store.configured();
  try {
    if (view === 'check') return res.status(200).json({ ok: true });
    if (view === 'health') {
      let cache = {}, last = {}, ran = 0;
      if (has) { cache = store.json(await store.cmd(['GET', 'health:cache']), {}); last = store.json(await store.cmd(['GET', 'health:last']), {}); ran = +(await store.cmd(['GET', 'health:ran'])) || 0; }
      const out = await H.checkAll({ cache, force: req.query.force === '1' });
      if (has) await store.cmd(['SET', 'health:cache', JSON.stringify(out.cache)]);
      return res.status(200).json({ storage: has, ranAt: ran, items: out.list.map(c => Object.assign({ since: (last[c.id] || {}).since || null }, c)), channels: A.channels() });
    }
    if (view === 'online') {
      if (!has) return res.status(200).json({ storage: false, items: [] });
      const now = Date.now(); const ids = await store.cmd(['ZRANGEBYSCORE', 'presence', now - 120000, '+inf']);
      await store.cmd(['ZREMRANGEBYSCORE', 'presence', 0, now - 86400000]);
      const items = [];
      for (const id of ids.slice(0, 200)) { const m = store.json(await store.cmd(['HGET', 'presence:meta', id]), null); if (m) items.push(Object.assign({ sid: id.slice(0, 6) }, m)); }
      return res.status(200).json({ storage: true, items });
    }
    if (view === 'applicants') {
      if (!has) return res.status(200).json({ storage: false, items: [] });
      const flat = await store.cmd(['HGETALL', 'applicants']); const items = [];
      for (let i = 1; i < flat.length; i += 2) { const r = store.json(flat[i], null); if (r) items.push(r); }
      items.sort((a, b) => (b.updated || 0) - (a.updated || 0));
      return res.status(200).json({ storage: true, items });
    }
    if (view === 'alerts') {
      if (!has) return res.status(200).json({ storage: false, items: [] });
      const rows = await store.cmd(['LRANGE', 'alerts', 0, 99]);
      return res.status(200).json({ storage: true, items: rows.map(r => store.json(r, null)).filter(Boolean) });
    }
    if (view === 'test') {
      const sent = await A.send('APN test alert', 'This is a test from the APN admin console.');
      return res.status(200).json({ sent, channels: A.channels() });
    }
    if (view === 'summary') {
      let online = 0, applicants = 0, pending = 0, alerts = 0, ran = 0;
      if (has) {
        online = await store.cmd(['ZCOUNT', 'presence', Date.now() - 120000, '+inf']);
        const flat = await store.cmd(['HGETALL', 'applicants']);
        for (let i = 1; i < flat.length; i += 2) { const r = store.json(flat[i], null); if (!r) continue; applicants++; if (r.role === 'contractor' && Object.values(r.vetting || {}).some(v => v !== 'verified')) pending++; }
        alerts = await store.cmd(['LLEN', 'alerts']); ran = +(await store.cmd(['GET', 'health:ran'])) || 0;
      }
      return res.status(200).json({ storage: has, online, applicants, pending, alerts, ranAt: ran });
    }
    return res.status(400).json({ error: 'bad_view' });
  } catch (e) { return res.status(502).json({ error: 'failed', detail: String(e.message || e).slice(0, 100) }); }
};
