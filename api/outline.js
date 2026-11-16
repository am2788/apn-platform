/* Server-side building outline lookup.
   Google refuses website-restricted keys on the Geocoding web service, so this runs on the server
   with GOOGLE_SERVER_KEY (set in Vercel → Project → Settings → Environment Variables). The key never reaches the browser. */
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?(aetherpropertynetworks\.com|apn-platform-chi\.vercel\.app)$/i;

module.exports = async (req, res) => {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1');
  if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'forbidden' });
  const key = process.env.GOOGLE_SERVER_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const address = String((req.query && req.query.address) || '').trim();
  if (address.length < 6 || address.length > 200) return res.status(400).json({ error: 'bad_address' });
  try {
    const u = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) +
      '&extra_computations=BUILDING_AND_ENTRANCES&key=' + encodeURIComponent(key);
    const j = await (await fetch(u)).json();
    if (j.status !== 'OK') return res.status(200).json({ outline: null, status: j.status });
    const first = j.results[0] || {};
    const b = (first.buildings || j.buildings || [])[0];
    const geo = b && b.building_outlines && b.building_outlines[0] && b.building_outlines[0].display_polygon;
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).json({ outline: geo || null, status: 'OK' });
  } catch (e) {
    return res.status(502).json({ error: 'lookup_failed' });
  }
};
