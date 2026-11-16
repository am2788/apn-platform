/* Living theme: local time, local weather and the calendar drive the look of the site. */
(function () {
  const APN = window.APN;
  const nth = (y, m, wd, n) => { const d = new Date(y, m, 1); const off = (wd - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + 7 * (n - 1)); };
  const last = (y, m, wd) => { const d = new Date(y, m + 1, 0); return new Date(y, m, d.getDate() - ((d.getDay() - wd + 7) % 7)); };
  /* [name, date, lead days, accent, greeting] */
  const holidays = y => [
    ["New Year", new Date(y, 0, 1), 3, '#c9a227', 'Happy New Year'],
    ["Valentine's Day", new Date(y, 1, 14), 5, '#c2255c', "Happy Valentine's Day"],
    ["St. Patrick's Day", new Date(y, 2, 17), 4, '#2b8a3e', "Happy St. Patrick's Day"],
    ['Memorial Day', last(y, 4, 1), 4, '#1f5fd1', 'Honoring Memorial Day'],
    ['Juneteenth', new Date(y, 5, 19), 3, '#b02a37', 'Celebrating Juneteenth'],
    ['Independence Day', new Date(y, 6, 4), 6, '#b02a37', 'Happy Fourth of July'],
    ['Labor Day', nth(y, 8, 1, 1), 4, '#1f5fd1', 'Happy Labor Day'],
    ['Halloween', new Date(y, 9, 31), 12, '#d9480f', 'Happy Halloween'],
    ['Veterans Day', new Date(y, 10, 11), 3, '#1f5fd1', 'Thank you, veterans'],
    ['Thanksgiving', nth(y, 10, 4, 4), 14, '#b3541e', 'Happy Thanksgiving'],
    ['Holiday Season', new Date(y, 11, 25), 24, '#b02a37', 'Happy Holidays'],
    ["New Year's Eve", new Date(y, 11, 31), 5, '#c9a227', 'Happy New Year']
  ];
  const holidayFor = d => {
    const day = 864e5, t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let best = null;
    for (const [name, date, lead, accent, greet] of holidays(d.getFullYear())) {
      const diff = Math.round((date.getTime() - t) / day);
      if (diff >= 0 && diff <= lead && (!best || diff < best.diff)) best = { name, accent, greet, diff };
    }
    return best;
  };
  const season = d => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][d.getMonth()];
  const phaseFor = (h, isDay) => {
    if (isDay === 0) return 'night';
    if (h < 5.5 || h >= 20.5) return 'night';
    if (h < 7.5) return 'dawn';
    if (h >= 17.5) return 'dusk';
    return 'day';
  };
  const condFor = c => c == null ? 'clear' : c === 0 ? 'clear' : c <= 3 ? 'cloud' : c <= 48 ? 'fog' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'rain';
  const LABEL = { clear: 'Clear', cloud: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' };
  /* rough fallback coordinates when the browser will not share a location */
  const TZ = { 'America/New_York': [40.71, -74.0, 'New York area'], 'America/Chicago': [41.88, -87.63, 'Chicago area'], 'America/Denver': [39.74, -104.99, 'Denver area'], 'America/Los_Angeles': [34.05, -118.24, 'Los Angeles area'], 'America/Phoenix': [33.45, -112.07, 'Phoenix area'], 'America/Detroit': [42.33, -83.05, 'Detroit area'], 'America/Indiana/Indianapolis': [39.77, -86.16, 'Indianapolis area'], 'America/Toronto': [43.65, -79.38, 'Toronto area'], 'Europe/London': [51.51, -0.13, 'London area'], 'Europe/Paris': [48.86, 2.35, 'Paris area'], 'Europe/Berlin': [52.52, 13.4, 'Berlin area'], 'Europe/Madrid': [40.42, -3.7, 'Madrid area'] };

  const A = (APN.atmo = {
    s: { phase: 'day', cond: 'clear', temp: null, place: null, live: false, holiday: null, season: 'autumn', override: null },
    listeners: [],
    apply() {
      const s = this.s, o = s.override || {};
      const b = document.body;
      b.dataset.phase = o.phase || s.phase; b.dataset.cond = o.cond || s.cond; b.dataset.season = s.season;
      b.style.setProperty('--holiday', s.holiday ? s.holiday.accent : 'var(--copper)');
      this.listeners.forEach(f => f());
      particles.sync();
    },
    view() { const s = this.s, o = s.override || {}; return { phase: o.phase || s.phase, cond: o.cond || s.cond, label: LABEL[o.cond || s.cond], temp: s.temp, place: s.place, live: s.live && !s.override, holiday: s.holiday, season: s.season }; },
    setOverride(o) { this.s.override = o; this.apply(); },
    tick() { const d = new Date(); this.s.phase = phaseFor(d.getHours() + d.getMinutes() / 60, this.s.isDay); this.s.holiday = holidayFor(d); this.s.season = season(d); this.apply(); },
    async weather(lat, lon, place) {
      try {
        const u = `${APN.cfg.WEATHER_URL}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`;
        const r = await fetch(u); if (!r.ok) throw 0;
        const c = (await r.json()).current;
        Object.assign(this.s, { cond: condFor(c.weather_code), temp: Math.round(c.temperature_2m), isDay: c.is_day, place, live: true });
        this.tick();
      } catch (e) { /* offline or blocked: time-of-day theme only */ }
    },
    locate() {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
      const fb = () => { const t = TZ[tz]; if (t) this.weather(t[0], t[1], t[2]); };
      try {
        if (!navigator.geolocation) return fb();
        navigator.geolocation.getCurrentPosition(p => this.weather(p.coords.latitude, p.coords.longitude, 'Your location'), fb, { timeout: 6000, maximumAge: 18e5 });
      } catch (e) { fb(); }
    },
    init() { this.tick(); this.locate(); setInterval(() => this.tick(), 60e3); setInterval(() => this.locate(), 20 * 60e3); }
  });

  /* rain / snow / stars drawn on every .sky canvas on the page */
  const particles = {
    raf: 0, items: new Map(),
    sync() {
      document.querySelectorAll('canvas.sky-fx').forEach(c => { if (!this.items.has(c)) this.items.set(c, { p: [], kind: '' }); });
      for (const c of [...this.items.keys()]) if (!c.isConnected) this.items.delete(c);
      if (!this.raf && this.items.size) this.raf = requestAnimationFrame(() => this.frame());
    },
    frame() {
      this.raf = 0;
      const v = A.view(), still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const [c, st] of this.items) {
        if (!c.isConnected) { this.items.delete(c); continue; }
        const w = c.clientWidth, h = c.clientHeight; if (!w || !h) continue;
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; st.p = []; }
        const kind = v.cond === 'snow' ? 'snow' : (v.cond === 'rain' || v.cond === 'storm') ? 'rain' : v.phase === 'night' && v.cond === 'clear' ? 'stars' : '';
        if (kind !== st.kind) { st.kind = kind; st.p = []; }
        const g = c.getContext('2d'); g.clearRect(0, 0, w, h);
        if (!kind) continue;
        const n = kind === 'stars' ? Math.round(w / 14) : kind === 'snow' ? Math.round(w / 9) : Math.round(w / 6);
        while (st.p.length < n) st.p.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random(), v: 0.5 + Math.random() });
        for (const q of st.p) {
          if (kind === 'stars') { g.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(Date.now() / 1400 * q.v + q.x)); g.fillStyle = '#fff'; g.fillRect(q.x, q.y * 0.8, 1 + q.r, 1 + q.r); }
          else if (kind === 'snow') { g.globalAlpha = 0.5 + q.r * 0.5; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 1 + q.r * 2, 0, 6.3); g.fill(); if (!still) { q.y += 0.4 + q.v * 0.7; q.x += Math.sin(q.y / 30 + q.r * 6) * 0.4; } }
          else { g.globalAlpha = 0.45; g.strokeStyle = '#dbe9ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - 2, q.y + 9 + q.r * 6); g.stroke(); if (!still) { q.y += 6 + q.v * 5; q.x -= 1; } }
          if (q.y > h) { q.y = -8; q.x = Math.random() * w; } if (q.x < -4) q.x = w;
        }
        g.globalAlpha = 1;
      }
      if (this.items.size) this.raf = requestAnimationFrame(() => this.frame());
    }
  };
  A.particles = particles;
})();
