/* APN admin console: token gate, overview, connections, online now, applicants, alerts, troubleshooting. */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = ''; try { token = sessionStorage.getItem('apn.adm') || ''; } catch (e) {}
  let tab = (location.hash.slice(1) || 'overview'), data = {}, timer = 0, lastDown = {}, notify = false;
  const ago = (t) => { if (!t) return 'never'; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 90 ? s + 's ago' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
  const when = (t) => t ? new Date(t).toLocaleString() : '';
  const api = async (view, extra) => {
    const r = await fetch('/api/admin?view=' + view + (extra || ''), { headers: { 'x-admin-token': token } });
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const gate = (msg) => { $('#app').innerHTML = `<div class="gate"><h1>APN Admin</h1><p class="muted small">Enter your admin token.</p><form id="gf"><input type="password" id="gt" autocomplete="current-password" placeholder="Admin token" autofocus><button class="btn2 primary" style="width:100%">Open console</button></form>${msg ? `<p class="small" style="color:var(--bad)">${esc(msg)}</p>` : ''}</div>`;
    $('#gf').onsubmit = async (e) => { e.preventDefault(); token = $('#gt').value.trim(); try { await api('check'); sessionStorage.setItem('apn.adm', token); start(); } catch (x) { gate(x.auth ? 'That token was not accepted.' : 'Could not reach the server.'); } }; };
  const noStore = () => `<div class="banner">Shared storage is not connected yet, so online users, applicants and alert history are empty. In Vercel open <b>Storage</b>, add <b>Upstash Redis</b> and connect it to this project, then redeploy.</div>`;
  const dot = (s) => `<span class="dot ${s}"></span>`;

  function view() {
    const s = data.summary || {}, h = data.health || { items: [], channels: {} };
    const downs = h.items.filter(i => i.state === 'down');
    let body = '';
    if (tab === 'overview') {
      body = (downs.length ? `<div class="banner bad"><b>${downs.length} connection${downs.length > 1 ? 's' : ''} down:</b> ${downs.map(d => esc(d.name)).join(', ')}. Open Connections for the fix.</div>` : '<div class="banner" style="border-color:var(--ok)">All configured connections are responding.</div>')
        + (s.storage === false ? noStore() : '')
        + `<div class="kpis"><div class="kpi"><b>${s.online ?? 0}</b><span>Online now</span></div><div class="kpi"><b>${s.applicants ?? 0}</b><span>Accounts / applicants</span></div><div class="kpi"><b>${s.pending ?? 0}</b><span>Contractors with vetting open</span></div><div class="kpi"><b>${downs.length}</b><span>Connections down</span></div><div class="kpi"><b>${s.alerts ?? 0}</b><span>Alerts logged</span></div></div>`
        + `<p class="small muted">Scheduled check last ran: ${s.ranAt ? ago(s.ranAt) : 'not yet'}. This page refreshes every 30 seconds.</p>`;
    } else if (tab === 'conn') {
      body = (data.health ? '' : '<p class="muted">Loading…</p>') + `<div class="row" style="margin-bottom:10px"><button class="btn2" id="recheck">Re-check everything now</button></div><div class="scroll"><table class="tbl"><tr><th>Service</th><th>Status</th><th>Speed</th><th>Detail</th><th>If it is not working</th></tr>${h.items.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${dot(i.state)}${i.state === 'ok' ? 'OK' : i.state === 'down' ? '<b style="color:var(--bad)">DOWN</b>' : 'Not connected'}${i.since && i.state !== 'off' ? `<div class="small muted">since ${ago(i.since)}</div>` : ''}</td><td>${i.state === 'off' ? '' : i.ms + ' ms'}</td><td>${esc(i.detail)}</td><td class="small">${i.state === 'ok' ? '' : esc(i.fix)}</td></tr>`).join('')}</table></div>`;
    } else if (tab === 'online') {
      const o = data.online || {}; const it = o.items || [];
      body = (o.storage === false ? noStore() : '') + `<p class="small muted">Open pages that checked in during the last 2 minutes. Visitors who are not signed in show as Visitor.</p><div class="scroll"><table class="tbl"><tr><th>Who</th><th>Role</th><th>Page</th><th>Here for</th><th>Last seen</th></tr>${it.length ? it.map(i => `<tr><td>${esc(i.name || 'Visitor ' + i.sid)}</td><td>${esc(i.role)}</td><td>${esc(i.page)}</td><td>${Math.max(1, Math.round((Date.now() - i.since) / 60000))} min</td><td>${ago(i.ts)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nobody online right now.</td></tr>'}</table></div>`;
    } else if (tab === 'apps') {
      const o = data.applicants || {}; const it = o.items || [];
      body = (o.storage === false ? noStore() : '') + `<div class="row" style="margin-bottom:10px"><button class="btn2" id="csv">Download CSV</button></div><div class="scroll"><table class="tbl"><tr><th>Name</th><th>Email</th><th>Role</th><th>Vetting</th><th>Joined</th><th>Updated</th></tr>${it.length ? it.map(a => { const v = a.vetting || {}, ks = Object.keys(v), done = ks.filter(k => v[k] === 'verified').length, sub = ks.filter(k => v[k] === 'submitted').length; return `<tr><td>${esc(a.name)}</td><td>${esc(a.email)}</td><td>${esc(a.role)}</td><td>${a.role === 'contractor' ? `${done}/${ks.length} verified${sub ? `, ${sub} awaiting review` : ''}` : ''}</td><td>${when(a.created)}</td><td>${ago(a.updated)}</td></tr>`; }).join('') : '<tr><td colspan="6" class="muted">No one has signed up yet.</td></tr>'}</table></div>`;
    } else if (tab === 'alerts') {
      const o = data.alerts || {}; const it = o.items || [];
      body = (o.storage === false ? noStore() : '') + `<div class="scroll"><table class="tbl"><tr><th>When</th><th>Event</th><th>Service</th><th>Detail</th><th>Sent via</th></tr>${it.length ? it.map(a => `<tr><td>${when(a.ts)}</td><td>${a.type === 'down' ? '<b style="color:var(--bad)">Down</b>' : 'Recovered'}</td><td>${esc(a.name)}</td><td>${esc(a.detail)}</td><td class="small">${Object.keys(a.sent || {}).map(k => k + ': ' + a.sent[k]).join(', ') || 'no channel set up'}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No alerts yet.</td></tr>'}</table></div>`;
    } else {
      const c = h.channels || {}; const row = (ok, n, how) => `<tr><td><b>${n}</b></td><td>${dot(ok ? 'ok' : 'off')}${ok ? 'Set up' : 'Not set up'}</td><td class="small">${how}</td></tr>`;
      body = `<h3>How alerts reach you</h3><p class="small muted">A health check runs once a day on Vercel, and every time you press Re-check. For checks every few minutes, point a free uptime pinger (cron-job.org or UptimeRobot) at <code>/api/health-check?key=YOUR_CRON_SECRET</code>. When something goes down you are alerted once, again every 6 hours while it stays down, and once when it recovers.</p>
        <table class="tbl"><tr><th>Channel</th><th>Status</th><th>How to set up (Vercel environment variables)</th></tr>
        ${row(c.ntfy, 'Phone push (ntfy.sh)', 'Install the free ntfy app, subscribe to a private topic name, then set <code>ALERT_NTFY_TOPIC</code> to that name.')}
        ${row(c.email, 'Email (Brevo)', 'Set <code>BREVO_API_KEY</code>, <code>ALERT_EMAIL</code> (where alerts go) and optionally <code>ALERT_FROM</code> (a verified sender).')}
        ${row(c.sms, 'Text message (Twilio)', 'Set <code>TWILIO_SID</code>, <code>TWILIO_TOKEN</code>, <code>TWILIO_FROM</code> and <code>ALERT_SMS_TO</code>.')}</table>
        <div class="row" style="margin:12px 0"><button class="btn2 primary" id="test">Send test alert</button> <span id="tres" class="small muted"></span></div>
        <label class="small"><input type="checkbox" id="bn" ${notify ? 'checked' : ''}> Also show a browser notification while this page is open</label>
        <h3 style="margin-top:22px">Common problems</h3>
        <table class="tbl"><tr><th>Symptom</th><th>What to check</th></tr>
        <tr><td>Maps blank or "for development purposes only"</td><td class="small">Billing enabled on the Google Cloud project; the browser key allows aetherpropertynetworks.com; Maps JavaScript, Places, Directions enabled.</td></tr>
        <tr><td>Property sizes not filling in</td><td class="small">Regrid shows Down or Not connected on Connections, or the plan does not cover that county.</td></tr>
        <tr><td>Contractor map or "on my way" not updating</td><td class="small">Shared storage must show OK. The contractor must allow location in the phone browser and keep the page open.</td></tr>
        <tr><td>Nobody shows as online</td><td class="small">Shared storage not connected, or a redeploy has not happened since connecting it.</td></tr>
        <tr><td>Site address wrong or not loading</td><td class="small">Vercel > Domains: www.aetherpropertynetworks.com should be Valid. Cloudflare records stay DNS only.</td></tr></table>`;
    }
    $('#app').innerHTML = `<div class="ad"><div class="adbar"><h1>APN Admin</h1><span><button class="btn2" id="rf">Refresh</button> <button class="btn2" id="so">Sign out</button></span></div>
      <div class="tabs2">${[['overview', 'Overview'], ['conn', 'Connections' + (downs.length ? ' (' + downs.length + ' down)' : '')], ['online', 'Online now'], ['apps', 'Applicants'], ['alerts', 'Alerts'], ['help', 'Alert setup & troubleshooting']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; view(); load(); });
    $('#rf').onclick = () => load(); $('#so').onclick = () => { try { sessionStorage.removeItem('apn.adm'); } catch (e) {} token = ''; clearInterval(timer); gate(); };
    const rc = $('#recheck'); if (rc) rc.onclick = async () => { rc.textContent = 'Checking…'; data.health = await api('health', '&force=1'); view(); };
    const cv = $('#csv'); if (cv) cv.onclick = csv;
    const t = $('#test'); if (t) t.onclick = async () => { t.disabled = true; const r = await api('test'); const k = Object.keys(r.sent || {}); $('#tres').textContent = k.length ? k.map(x => x + ': ' + r.sent[x]).join(', ') : 'No channel is set up yet, nothing was sent.'; t.disabled = false; };
    const bn = $('#bn'); if (bn) bn.onchange = async () => { if (bn.checked && window.Notification) { notify = (await Notification.requestPermission()) === 'granted'; bn.checked = notify; } else notify = false; };
  }
  function csv() {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['name', 'email', 'role', 'company', 'trades', 'vetting', 'created', 'updated']].concat(((data.applicants || {}).items || []).map(a => [a.name, a.email, a.role, a.company, (a.trades || []).join(' '), JSON.stringify(a.vetting || {}), when(a.created), when(a.updated)]));
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'apn-applicants.csv'; a.click(); URL.revokeObjectURL(url);
  }
  async function load() {
    try {
      const want = { overview: ['summary', 'health'], conn: ['health'], online: ['online'], apps: ['applicants'], alerts: ['alerts'], help: ['health'] }[tab];
      const names = { summary: 'summary', health: 'health', online: 'online', applicants: 'applicants', alerts: 'alerts' };
      const res = await Promise.all(want.map(v => api(v)));
      want.forEach((v, i) => { data[names[v]] = res[i]; });
      (data.health ? data.health.items : []).forEach(i => { if (i.state === 'down' && !lastDown[i.id] && notify && window.Notification) new Notification('APN: ' + i.name + ' is down', { body: i.detail }); lastDown[i.id] = i.state === 'down'; });
      view();
    } catch (e) { if (e.auth) return gate('Session expired.'); const m = $('#app .ad'); if (m) m.insertAdjacentHTML('afterbegin', '<div class="banner bad">Could not reach the server: ' + esc(e.message) + '</div>'); }
  }
  function start() { view(); load(); clearInterval(timer); timer = setInterval(() => { if (!document.hidden) load(); }, 30000); }
  if (token) { api('check').then(start).catch(() => gate()); } else gate();
})();
