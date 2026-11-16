/* Server-side property measurement.
   Combines Google (building outline) with Regrid (county parcel lines, matched building footprints, assessor records).
   Keys live only in Vercel env vars: GOOGLE_SERVER_KEY, REGRID_TOKEN. Nothing here reaches the browser. */
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?(aetherpropertynetworks\.com|apn-platform-chi\.vercel\.app)$/i;
const SQFT_PER_M2 = 10.76391041671;

/* Area of a GeoJSON ring in square feet (local equirectangular projection, accurate for property-sized shapes). */
function ringArea(ring) {
  if (!ring || ring.length < 4) return 0;
  const R = 6378137, lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length * Math.PI / 180;
  const pts = ring.map(([lng, lat]) => [R * (lng * Math.PI / 180) * Math.cos(lat0), R * (lat * Math.PI / 180)]);
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(a / 2) * SQFT_PER_M2;
}
const polyRings = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(c => c[0]) : [];
const geomArea = g => polyRings(g).reduce((s, r) => s + ringArea(r), 0);
const largest = g => polyRings(g).sort((a, b) => ringArea(b) - ringArea(a))[0] || null;
function inRing(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inGeom = (pt, g) => polyRings(g).some(r => inRing(pt, r));
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : v; return Number.isFinite(n) && n > 0 ? n : null; };
const first = (o, keys) => { for (const k of keys) { const n = num(o[k]); if (n) return n; } return null; };
const round = n => n == null ? null : Math.round(n);

module.exports = async (req, res) => {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1');
  if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'forbidden' });
  const gKey = process.env.GOOGLE_SERVER_KEY, rToken = process.env.REGRID_TOKEN;
  if (!gKey) return res.status(503).json({ error: 'not_configured', missing: 'GOOGLE_SERVER_KEY' });
  const address = String((req.query && req.query.address) || '').trim();
  if (address.length < 6 || address.length > 200) return res.status(400).json({ error: 'bad_address' });
  const debug = req.query && req.query.debug === '1';
  const out = { status: 'OK', google: null, regrid: null, building: null, land: null, checks: [] };

  /* 1. Google: coordinates and building outline */
  let loc = null;
  try {
    const u = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) +
      '&extra_computations=BUILDING_AND_ENTRANCES&key=' + encodeURIComponent(gKey);
    const j = await (await fetch(u)).json();
    if (j.status !== 'OK') return res.status(200).json({ ...out, status: 'ADDRESS_' + j.status });
    const r0 = j.results[0] || {}, l = r0.geometry && r0.geometry.location;
    if (l) loc = [l.lng, l.lat];
    const b = (r0.buildings || j.buildings || [])[0];
    const poly = b && b.building_outlines && b.building_outlines[0] && b.building_outlines[0].display_polygon;
    if (poly) out.google = { polygon: largest(poly), sqft: round(geomArea(poly)) };
  } catch (e) { out.checks.push('google_failed'); }

  /* 2. Regrid: parcel at the geocoded point */
  if (rToken && loc) {
    try {
      const u = 'https://app.regrid.com/api/v2/parcels/point?lat=' + loc[1] + '&lon=' + loc[0] + '&radius=25&limit=5&token=' + encodeURIComponent(rToken);
      const r = await fetch(u);
      if (!r.ok) out.checks.push('regrid_http_' + r.status);
      else {
        const j = await r.json(), feats = (j.parcels && j.parcels.features) || [];
        const f = feats.find(x => inGeom(loc, x.geometry)) || feats[0];
        if (f) {
          const p = f.properties || {}, fl = p.fields || {};
          const lot = first(fl, ['ll_gissqft']) || (first(fl, ['ll_gisacre']) ? first(fl, ['ll_gisacre']) * 43560 : null) || geomArea(f.geometry);
          const blds = ((j.buildings && j.buildings.features) || []).map(b => ({ polygon: largest(b.geometry), sqft: round(geomArea(b.geometry)) }))
            .filter(b => b.polygon && inGeom(b.polygon[0], f.geometry)).sort((a, b) => b.sqft - a.sqft);
          out.regrid = {
            path: p.path || fl.path || null,
            parcel_polygon: largest(f.geometry),
            lot_sqft: round(lot),
            footprint_sqft: round(first(fl, ['ll_bldg_footprint_sqft']) || (blds[0] && blds[0].sqft)),
            building_count: num(fl.ll_bldg_count),
            buildings: blds.slice(0, 5),
            assessor_sqft: round(first(fl, ['area_building', 'ed_bldg_area', 'sqft_struct', 'structure_sqft', 'bldg_sqft', 'livingarea', 'gross_area'])),
            stories: first(fl, ['numstories', 'stories', 'num_stories']),
            year_built: first(fl, ['yearbuilt', 'year_built']),
            beds: first(fl, ['numbedrooms', 'bedrooms']), baths: first(fl, ['numbaths', 'bathrooms']),
            use: fl.usedesc || fl.usecode || null
          };
          if (debug) {
            /* Field names plus building/area values only. Owner and tax fields are left out. */
            out.debug = { fieldKeys: Object.keys(fl).filter(k => !/owner|mail|tax|val|sale|parent|saddr|mailadd/i.test(k)),
              areaFields: Object.fromEntries(Object.entries(fl).filter(([k]) => /area|sqft|bldg|struct|stor|year|bed|bath|use|zoning|acre/i.test(k) && !/owner|mail|tax|val|sale/i.test(k))),
              buildingsReturned: ((j.buildings && j.buildings.features) || []).length, topKeys: Object.keys(j) };
          }
        } else out.checks.push('regrid_no_parcel');
      }
    } catch (e) { out.checks.push('regrid_failed'); }
  } else if (!rToken) out.checks.push('regrid_not_configured');

  /* 3. Reconcile: footprint candidates must agree before the number is locked */
  const G = out.google && out.google.sqft, R = out.regrid && out.regrid.footprint_sqft, A = out.regrid && out.regrid.assessor_sqft;
  const close = (a, b, t) => a && b && Math.abs(a - b) / Math.max(a, b) <= t;
  let footprint = null, confidence = 'none', poly = null;
  if (G && R) { confidence = close(G, R, 0.15) ? 'high' : 'low'; footprint = G; poly = out.google.polygon; if (confidence === 'low') out.checks.push('footprint_sources_disagree'); }
  else if (G || R) { confidence = 'medium'; footprint = G || R; poly = G ? out.google.polygon : (out.regrid.buildings[0] && out.regrid.buildings[0].polygon); }
  let interior = footprint, basis = footprint ? 'footprint' : null;
  if (A && footprint) {
    const ratio = A / footprint;
    if (ratio >= 0.6 && ratio <= 3.6) { interior = A; basis = 'assessor'; } else { confidence = 'low'; out.checks.push('assessor_vs_footprint_mismatch'); }
  } else if (A && !footprint) { interior = A; basis = 'assessor'; confidence = 'medium'; }
  out.building = footprint || interior ? { footprint_sqft: footprint, interior_sqft: interior, basis, polygon: poly, confidence } : null;
  const lot = out.regrid && out.regrid.lot_sqft;
  out.land = lot ? { lot_sqft: lot, grounds_sqft: Math.max(0, lot - (footprint || 0)), polygon: out.regrid.parcel_polygon, source: 'county parcel', confidence: 'high' } : null;

  res.setHeader('Cache-Control', 's-maxage=604800');
  return res.status(200).json(out);
};
