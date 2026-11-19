/* Anonymous "who is online" heartbeat and applicant reporting for the admin console. Needs /api/presence and /api/apply (shared storage). */
(function () {
  const APN = window.APN = window.APN || {};
  let sid = '', since = Date.now(), timer = 0, off = false, last = {};
  try { sid = sessionStorage.getItem('apn.sid') || ''; if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9-]/g, '').slice(0, 36); sessionStorage.setItem('apn.sid', sid); } } catch (e) { sid = 'x' + Date.now(); }
  const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
  const beat = () => {
    if (off || document.hidden) return;
    post('/api/presence', { sid, role: last.role || 'visitor', page: last.page || '', name: last.name || '', since })
      .then(r => { if (r.status === 503 || r.status === 404 || r.status === 403) off = true; }).catch(() => {});
  };
  APN.presence = {
    /* called after every render with the signed-in user (or null) and the page name */
    update(user, page) {
      const preview = user && /@preview\.local$/.test(user.email || '');
      last = { role: preview ? 'visitor' : (user && user.role) || 'visitor', page: page || '', name: preview ? '' : (user && user.name) || '' };
      if (!timer) { timer = setInterval(beat, 45000); beat(); }
    },
    apply(rec) {
      if (off || (rec.email && /@preview\.local$/.test(rec.email))) return;
      post('/api/apply', Object.assign({ id: sid }, rec)).catch(() => {});
    }
  };
})();
