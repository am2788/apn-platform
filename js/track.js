/* Aether Property Networks: directions and live location for an active job.
   Contractor side: "On my way" opens Google Maps directions and shares position until the job is submitted.
   Customer side: a map of the contractor's position, only while the job is claimed or on site.
   When the server store (api/track) is not configured, positions pass through this browser's localStorage,
   which only connects two tabs of one browser (demo mode). */
(function () {
  const APN = window.APN, cfg = APN.cfg;
  const ACTIVE = ['claimed', 'onsite'];
  const MAX_MS = 12 * 3600e3, SEND_EVERY = 5000, POLL_EVERY = 8000, STALE = 60000;
  const $ = q => document.querySelector(q);
  const watches = {};            // ticket id -> { id, last }
  let remote = null;             // null unknown, true/false after probe
  const lsKey = id => 'apn.trk.' + id;

  const hex = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
  const q = tk => `ticket=${encodeURIComponent(tk.id)}&tkey=${encodeURIComponent(tk.tkey)}`;
  async function usesRemote() {
    if (remote !== null) return remote;
    try { const r = await fetch('/api/track?probe=1'); remote = r.ok && (await r.json()).configured === true; } catch (e) { remote = false; }
    return remote;
  }
  const live = tk => tk && tk.enroute && tk.tkey && ACTIVE.includes(tk.status) && Date.now() - (tk.enrouteAt || 0) < MAX_MS;
  APN.directionsUrl = address => 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(address);

  async function publish(tk, pos) {
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0), ts: Date.now() };
    const w = watches[tk.id]; if (w) w.pos = p;
    if (await usesRemote()) {
      try { await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ ticket: tk.id, tkey: tk.tkey }, p)) }); } catch (e) { /* retry on next fix */ }
    } else { try { localStorage.setItem(lsKey(tk.id), JSON.stringify(p)); } catch (e) { /* storage full or blocked */ } }
  }
  function start(tk) {
    if (!live(tk) || watches[tk.id] || !navigator.geolocation) return;
    const w = watches[tk.id] = { last: 0, pos: null, err: null };
    w.id = navigator.geolocation.watchPosition(pos => { w.err = null; if (Date.now() - w.last >= SEND_EVERY) { w.last = Date.now(); publish(tk, pos); } },
      e => { w.err = e.code === 1 ? 'Location permission is blocked. Allow location for this site so the customer can see you arrive.' : 'Waiting for a location fix.'; paint(); },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 });
  }
  async function stop(tk) {
    const w = watches[tk.id];
    if (w) { navigator.geolocation.clearWatch(w.id); delete watches[tk.id]; }
    try { localStorage.removeItem(lsKey(tk.id)); } catch (e) { /* ignore */ }
    if (tk.tkey && await usesRemote()) { try { await fetch('/api/track?' + q(tk), { method: 'DELETE' }); } catch (e) { /* expires on its own in 90 seconds */ } }
  }
  async function read(tk) {
    if (!tk.tkey) return null;
    if (await usesRemote()) {
      try { const j = await (await fetch('/api/track?' + q(tk))).json(); return j.active ? j : null; } catch (e) { return null; }
    }
    try { return JSON.parse(localStorage.getItem(lsKey(tk.id)) || 'null'); } catch (e) { return null; }
  }

  /* ----- maps ----- */
  const dot = (color) => ({ path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 });
  const maps = {};               // element id -> { map, me, dest, route, tk }
  async function geocode(address) {
    const r = await new google.maps.Geocoder().geocode({ address }); return r.results[0] && r.results[0].geometry.location;
  }
  async function build(elId, tk, who) {
    const el = document.getElementById(elId); if (!el || !cfg.GOOGLE_MAPS_KEY) return;
    await APN.loadMaps();
    const dest = await geocode(tk.address).catch(() => null);
    const map = new google.maps.Map(el, { center: dest || { lat: 38, lng: -85 }, zoom: 14, disableDefaultUI: true, zoomControl: true });
    const m = { map, tk, who, dest, me: null, route: null, routed: false };
    if (dest) new google.maps.Marker({ map, position: dest, title: 'Job site', label: { text: 'Job', color: '#fff', fontSize: '11px' } });
    maps[elId] = m;
  }
  async function paintMap(elId) {
    const m = maps[elId]; if (!m || !document.getElementById(elId)) return;
    const tk = m.tk, st = $('#' + elId + '-st');
    let pos = null;
    if (m.who === 'contractor') { const w = watches[tk.id]; pos = w && w.pos; if (w && w.err && st) st.textContent = w.err; } else pos = await read(tk);
    if (!pos) { if (st && !(m.who === 'contractor' && watches[tk.id] && watches[tk.id].err)) st.textContent = m.who === 'contractor' ? 'Finding your location…' : 'Waiting for the contractor to share a location…'; return; }
    const ll = { lat: pos.lat, lng: pos.lng }, age = Date.now() - pos.ts;
    if (!m.me) m.me = new google.maps.Marker({ map: m.map, position: ll, icon: dot(m.who === 'contractor' ? '#1d57c4' : '#0f7a55'), title: m.who === 'contractor' ? 'You' : 'Your contractor', zIndex: 5 });
    else m.me.setPosition(ll);
    if (m.dest) { const b = new google.maps.LatLngBounds(); b.extend(ll); b.extend(m.dest); m.map.fitBounds(b, 60); if (m.map.getZoom() > 17) m.map.setZoom(17); }
    if (m.dest && !m.routed) {   // draw the driving route once; harmless if the Directions API is not enabled for this key
      m.routed = true;
      new google.maps.DirectionsService().route({ origin: ll, destination: m.dest, travelMode: 'DRIVING' }, (r, s) => {
        if (s === 'OK') { m.route = new google.maps.DirectionsRenderer({ map: m.map, suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: '#1d57c4', strokeWeight: 5 } }); m.route.setDirections(r); const leg = r.routes[0].legs[0]; if (st) st.dataset.eta = leg.duration.text + ' · ' + leg.distance.text; paintStatus(elId, pos); }
      });
    }
    paintStatus(elId, pos);
    if (m.who === 'customer' && age > STALE && st) st.textContent = 'Location paused. It will update when the contractor is moving again.';
  }
  function paintStatus(elId, pos) {
    const st = $('#' + elId + '-st'), m = maps[elId]; if (!st) return;
    if (m.who === 'customer' && Date.now() - pos.ts > STALE) return;
    const eta = st.dataset.eta ? ' · ' + st.dataset.eta : '';
    st.textContent = (m.who === 'contractor' ? 'Sharing your live location with the customer' : 'Your contractor is on the way') + eta;
  }
  function paint() { Object.keys(maps).forEach(paintMap); }

  /* ----- called after every render ----- */
  let timer = null;
  async function after(S, ME, role) {
    Object.keys(maps).forEach(k => delete maps[k]);
    // contractor side: keep every live job's watch running, stop any that are no longer live
    S.tickets.forEach(tk => { if (tk.claimedBy === ME && role === 'contractor') { live(tk) ? start(tk) : (watches[tk.id] && stop(tk)); } });
    const pending = [];
    document.querySelectorAll('[data-track]').forEach(el => {
      const tk = S.tickets.find(x => x.id === el.dataset.track); if (!tk || !live(tk)) return;
      pending.push(build(el.id, tk, el.dataset.who));
    });
    await Promise.all(pending); paint();
    clearInterval(timer); if (pending.length) timer = setInterval(paint, POLL_EVERY);
  }
  // another tab of this browser (demo mode) wrote a position
  window.addEventListener('storage', e => { if (e.key && e.key.indexOf('apn.trk.') === 0) paint(); });

  APN.track = { start, stop, live, after, tkey: hex };
})();
