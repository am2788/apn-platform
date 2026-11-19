/* Scheduled check. Alerts on a change to "down", every 6 h while it stays down, and when it recovers. */
const store = require('../lib/store'); const g = require('../lib/guard'); const H = require('../lib/health'); const A = require('../lib/alert');
const SIX = 6 * 3600 * 1000;
module.exports = async (req, res) => {
  if (!g.cronOk(req)) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Cache-Control', 'no-store');
  const now = Date.now();
  let last = {}, cache = {};
  if (store.configured()) { try { last = store.json(await store.cmd(['GET', 'health:last']), {}); cache = store.json(await store.cmd(['GET', 'health:cache']), {}); } catch (e) {} }
  const { list } = await H.checkAll({ cache });
  const events = []; const next = {};
  for (const c of list) {
    const p = last[c.id] || { state: 'ok', since: now, alerted: 0 };
    const n = { state: c.state, since: p.state === c.state ? p.since : now, alerted: p.alerted || 0, detail: c.detail };
    if (c.state === 'down' && (p.state !== 'down' || now - (p.alerted || 0) > SIX)) { events.push({ type: 'down', id: c.id, name: c.name, detail: c.detail, ts: now }); n.alerted = now; }
    if (c.state !== 'down' && p.state === 'down') { events.push({ type: 'recovered', id: c.id, name: c.name, detail: 'Back to normal', ts: now }); n.alerted = 0; }
    next[c.id] = n;
  }
  let sent = {};
  if (events.length) {
    const title = events.some(e => e.type === 'down') ? 'APN: ' + events.filter(e => e.type === 'down').map(e => e.name).join(', ') + ' DOWN' : 'APN: recovered';
    sent = await A.send(title, events.map(e => (e.type === 'down' ? 'DOWN ' : 'OK ') + e.name + ' - ' + e.detail).join('\n'));
  }
  if (store.configured()) {
    try {
      await store.cmd(['SET', 'health:last', JSON.stringify(next)]);
      await store.cmd(['SET', 'health:cache', JSON.stringify(cache)]);
      await store.cmd(['SET', 'health:ran', String(now)]);
      for (const e of events) { await store.cmd(['LPUSH', 'alerts', JSON.stringify(Object.assign({ sent }, e))]); }
      if (events.length) await store.cmd(['LTRIM', 'alerts', 0, 199]);
    } catch (e) {}
  }
  return res.status(200).json({ checked: list.length, events: events.length, sent });
};
