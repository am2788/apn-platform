/* Records a signup or a vetting submission so the admin console can list who applied. */
const store = require('../lib/store'); const g = require('../lib/guard');
module.exports = async (req, res) => {
  if (!g.originOk(req)) return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!store.configured()) return res.status(503).json({ error: 'not_configured' });
  const b = g.body(req); const id = g.clean(b.id, 40);
  if (!/^[A-Za-z0-9-]{3,40}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  try {
    const prev = store.json(await store.cmd(['HGET', 'applicants', id]), {});
    const vet = {}; if (b.vetting && typeof b.vetting === 'object') Object.keys(b.vetting).slice(0, 12).forEach(k => { vet[g.clean(k, 20)] = g.clean(b.vetting[k], 12); });
    const rec = Object.assign({}, prev, {
      id, role: b.role === 'contractor' ? 'contractor' : 'customer', name: g.clean(b.name, 80) || prev.name || '', email: g.clean(b.email, 120) || prev.email || '',
      company: g.clean(b.company, 80) || prev.company || '', trades: Array.isArray(b.trades) ? b.trades.slice(0, 10).map(x => g.clean(x, 20)) : prev.trades || [],
      vetting: Object.keys(vet).length ? vet : prev.vetting || {}, created: prev.created || Date.now(), updated: Date.now()
    });
    await store.cmd(['HSET', 'applicants', id, JSON.stringify(rec)]);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ error: 'store_failed' }); }
};
