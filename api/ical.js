/* Reads a host's booking calendar (an iCal .ics link from Airbnb, Vrbo, a property manager, etc.)
   and returns the upcoming check-outs, so APN can send a cleaner when each stay ends.
   The link is fetched on the server, so it is locked down: https only, no private or internal addresses,
   short timeout, size cap, and every redirect is re-checked. */
const dns = require('dns').promises;
const net = require('net');
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?(aetherpropertynetworks\.com|supportaether\.com|apn-platform-chi\.vercel\.app)$/i;
const MAX_BYTES = 1024 * 1024, DAYS_AHEAD = 90;

const privateIp = ip => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
};
async function safeFetch(u, hops = 0) {
  const url = new URL(u);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('bad_url');
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('bad_url');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { Accept: 'text/calendar, text/plain', 'User-Agent': 'APN-calendar-sync/1.0' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { if (hops >= 3) throw new Error('bad_url'); return safeFetch(new URL(r.headers.get('location'), url).toString(), hops + 1); }
    if (!r.ok) throw new Error('fetch_failed');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('too_large');
    return buf.toString('utf8');
  } finally { clearTimeout(t); }
}

const toDate = v => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || ''); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
function parse(ics) {
  const lines = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let cur = null;
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') cur = {};
    else if (ln === 'END:VEVENT') { if (cur) out.push(cur); cur = null; }
    else if (cur) {
      const i = ln.indexOf(':'); if (i < 0) continue;
      const k = ln.slice(0, i).split(';')[0].toUpperCase(), v = ln.slice(i + 1);
      if (k === 'UID') cur.uid = v; else if (k === 'DTSTART') cur.start = toDate(v); else if (k === 'DTEND') cur.end = toDate(v);
      else if (k === 'SUMMARY') cur.summary = v; else if (k === 'STATUS') cur.status = v;
    }
  }
  return out;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1');
  if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  const link = String((req.query && req.query.url) || '').trim();
  if (link.length < 12 || link.length > 600) return res.status(400).json({ error: 'bad_url' });
  try {
    const events = parse(await safeFetch(link));
    const today = new Date().toISOString().slice(0, 10), limit = new Date(Date.now() + DAYS_AHEAD * 864e5).toISOString().slice(0, 10);
    /* Owner-blocked dates are not stays. Platforms label bookings "Reserved"/"Booked" and blocks "Not available"/"Blocked". */
    const stays = events.filter(e => e.start && e.end && e.status !== 'CANCELLED' && !/not available|unavailable|blocked|block\b/i.test(e.summary || ''))
      .sort((a, b) => a.start.localeCompare(b.start));
    const out = stays.filter(e => e.end >= today && e.end <= limit).map(e => {
      const next = stays.find(n => n !== e && n.start >= e.end);
      return { uid: e.uid || e.start + e.end, checkIn: e.start, checkOut: e.end, nextCheckIn: next ? next.start : null, sameDay: !!(next && next.start === e.end) };
    });
    return res.status(200).json({ ok: true, total: events.length, checkouts: out });
  } catch (e) {
    const code = ['bad_url', 'too_large', 'fetch_failed'].includes(e.message) ? e.message : 'lookup_failed';
    return res.status(code === 'bad_url' ? 400 : 502).json({ error: code });
  }
};
