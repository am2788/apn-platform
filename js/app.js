/* Aether Property Networks: views and interactions. */
(function () {
  const APN = window.APN, cfg = APN.cfg;
  let S = APN.store.load();
  const $ = (q, r) => (r || document).querySelector(q);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => APN.money(v, S.cur);
  const t = k => (APN.I18N[S.lang] || APN.I18N.en)[k] || APN.I18N.en[k] || k;
  const sqft = n => Math.round(n).toLocaleString() + ' sq ft';
  const save = () => APN.store.save();
  const ago = ts => { const m = Math.max(1, Math.round((Date.now() - ts) / 60e3)); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  const toast = msg => { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200); };
  const img = f => 'assets/img/' + f;

  const ui = {
    cTab: 'overview', kTab: 'overview', promo: 0, promoOff: false, job: null, loginTab: 'in', loginRole: 'customer',
    order: { propId: null, sector: 'str', tier: 0, services: [], freq: 'One-time', immediate: false, afterHours: false },
    prop: null, cal: null, bulk: null, bulkType: 'STR', photoURL: {}, fresh: null
  };
  const PUBLIC_PAGES = ['faq', 'contact', 'privacy', 'terms'];
  const ROUTES = ['home', 'login', 'console', 'contractor', 'vetting', 'ops', 'w2'].concat(PUBLIC_PAGES);
  const route = () => { const h = location.hash.replace('#', ''); return ROUTES.includes(h) ? h : 'home'; };
  const go = r => { if (route() === r) render(); else location.hash = r; };
  const role = () => S.user && S.user.role;
  /* saved sessions may hold items from sectors that no longer exist */
  S.tickets = S.tickets.filter(x => APN.sector(x.sector)); S.cart = S.cart.filter(x => APN.sector(x.sector));
  /* older saved sessions predate some vetting items */
  APN.VETTING.forEach(v => { if (!S.contractor.vetting[v[0]]) S.contractor.vetting[v[0]] = 'missing'; });
  const cleared = () => APN.GATE.every(k => S.contractor.vetting[k] === 'verified');
  const tradeMissing = sector => (APN.TRADE_GATE[sector] || []).filter(k => S.contractor.vetting[k] !== 'verified');
  const canClaim = x => cleared() && tradeMissing(x.sector).length === 0;
  const claimBlock = x => !cleared() ? 'Complete vetting to claim' : 'Needs: ' + tradeMissing(x.sector).map(APN.vetName).join(', ');
  const ME = 'me';
  const ACTIVE_JOB = ['claimed', 'onsite'];

  const ESCROW = { held: ['Funds held', 'info'], transit: ['In transit', 'warn'], disputed: ['Disputed', 'bad'], released: ['Released', 'ok'], refunded: ['Refunded', ''] };
  const STATUS = { open: 'Awaiting contractor', claimed: 'Claimed', onsite: 'On site', review: 'Photo review', released: 'Completed', disputed: 'Disputed', refunded: 'Refunded' };
  const pill = (txt, k) => `<span class="pill ${k || ''}">${esc(txt)}</span>`;
  const escrowPill = tk => pill(ESCROW[tk.escrow][0], ESCROW[tk.escrow][1]);
  const tierName = tk => APN.sector(tk.sector).tiers[tk.tier][0];

  /* ---------- chrome ---------- */
  function renderPromo() {
    const el = $('#promo');
    if (ui.promoOff || !S.promos.length) { el.innerHTML = ''; return; }
    const p = S.promos[ui.promo % S.promos.length];
    el.innerHTML = `<div class="wrap"><span class="tag">${esc(p.tag)}</span><span class="txt">${esc(p.text)}</span>
      ${S.promos.length > 1 ? `<button data-act="promoNext" aria-label="Next announcement">&rsaquo;</button>` : ''}
      <button data-act="promoOff" aria-label="Dismiss announcements">&times;</button></div>`;
  }
  function renderTop() {
    const r = route(), u = S.user;
    const link = (h, label) => `<a href="#${h}" class="${r === h ? 'on' : ''}">${esc(label)}</a>`;
    let nav = link('home', t('home')) + link('faq', 'FAQ') + link('contact', 'Contact');
    if (role() === 'customer' || role() === 'ops') nav += link('console', t('customer'));
    if (role() === 'contractor') nav += link('contractor', t('contractor')) + link('vetting', t('vetting'));
    if (role() === 'ops') nav += link('vetting', t('vetting')) + link('ops', 'Operations');
    $('#top').innerHTML = `<div class="wrap">
      <a class="brand" href="#home"><img src="${img('logo-180.png')}" alt=""><div><b>Aether Property Networks</b><span>ISSA CIMS &middot; Escrow-protected</span></div></a>
      <nav class="main" aria-label="Main">${nav}</nav>
      <div class="tools">
        <select data-bind="lang" aria-label="Language">${Object.keys(APN.I18N).map(l => `<option ${S.lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select data-bind="cur" aria-label="Currency">${Object.keys(APN.CUR).map(c => `<option ${S.cur === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        ${u ? `<span class="small muted">${esc(u.name)}</span><button class="btn sm" data-act="signout">${t('signout')}</button>` : `<a class="btn sm primary" href="#login">${t('signin')}</a>`}
      </div></div>`;
  }
  function chips() {
    const v = APN.atmo.view(), d = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const wx = v.live ? `${v.temp}&deg;F &middot; ${v.label} &middot; ${esc(v.place)}` : APN.atmo.s.override ? `Preview: ${v.label.toLowerCase()}, ${v.phase}` : 'Local weather not available here';
    return `<span class="chip">${time} &middot; ${date}</span><span class="chip">${wx}</span>${v.holiday ? `<span class="chip h">${esc(v.holiday.greet)}</span>` : ''}`;
  }
  const sky = (title, sub) => `<div class="sky"><canvas class="sky-fx"></canvas><div class="orb"></div><div class="wrap inner"><h2>${esc(title)}</h2><div class="small">${esc(sub)}</div><div class="meta atmo-chips">${chips()}</div></div></div>`;
  function renderFoot() {
    const o = APN.atmo.s.override;
    const b = (k, label) => `<button class="${(!o && k === 'auto') || (o && (o.phase === k || o.cond === k)) ? 'on' : ''}" data-act="atmo" data-k="${k}">${label}</button>`;
    $('#foot').innerHTML = `<div class="wrap"><div class="row between">
      <div><b style="color:#fff">Aether Property Networks</b><br>A division of Environmental Wellness Lab Groups Inc<div class="small flinks" style="margin-top:8px"><a href="#faq">FAQ</a> &middot; <a href="#contact">Contact</a> &middot; <a href="#privacy">Privacy</a> &middot; <a href="#terms">Terms</a></div></div>
      <div><div class="small" style="margin-bottom:6px">Preview the living theme</div><div class="seg">${b('auto', 'Auto')}${b('day', 'Day')}${b('dusk', 'Dusk')}${b('night', 'Night')}${b('rain', 'Rain')}${b('snow', 'Snow')}</div></div>
      </div>${cfg.DEMO_MODE ? `<p class="small" style="margin:14px 0 0">Demo mode: data is stored in this browser only and no payment is taken. <a href="#home" data-act="reset">Reset demo data</a></p>` : ''}</div>`;
  }

  /* ---------- public home ---------- */
  function sectorCard(s) {
    return `<div class="card sector ${s.soon ? 'soon' : ''}"><div class="ph" style="background-image:url(${img(s.img)})" role="img" aria-label="${esc(s.name)}"></div>
      <div class="bd"><h3>${esc(s.name)}</h3><p class="small muted" style="margin:0">${esc(s.blurb)}</p>
      <div class="tiers">${s.tiers.map((x, i) => `<div><span>${esc(x[0])}</span><b class="num">${s.soon ? '&ndash;' : money(APN.RATES[i]) + '/sq ft'}</b></div>`).join('')}</div></div></div>`;
  }
  function vHome() {
    return `<section class="hero"><div class="bg" style="background-image:url(${img('com.jpg')})"></div><div class="tint"></div><div class="tint2"></div><canvas class="sky-fx"></canvas>
      <div class="wrap"><div><div class="eyebrow" style="color:#e5b48a">Property care, verified</div>
        <h1>Measured from the sky. Paid when the work is proven.</h1>
        <p class="lead">Aether Property Networks dispatches vetted field professionals to homes, rentals and commercial sites. Every quote is priced per square foot, and your payment stays in escrow until ten photos confirm the job.</p>
        <div class="row"><a class="btn primary" href="#${S.user ? 'console' : 'login'}" data-act="startQuote">${t('quote')}</a><a class="btn on-dark" href="#login" data-act="joinContractor">${t('join')}</a></div>
        <div class="meta atmo-chips row" style="margin-top:22px">${chips()}</div></div>
        <div><video controls preload="metadata" playsinline poster="${img('com.jpg')}" src="assets/video/vision.mp4" aria-label="Our goals and vision, 33 second film"></video>
        <div class="cap">Our goals and vision &middot; 33 seconds, captions on screen, no sound</div></div></div></section>
    <section class="band"><div class="wrap"><div class="eyebrow">${t('services')}</div><h2>${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][APN.SECTORS.filter(x => !x.soon).length]} sectors live. One price structure.</h2>
      <p class="muted" style="max-width:70ch">Every sector has its own tier names and scope, and every sector uses the same three rates: ${APN.RATES.map(r => money(r)).join(', ')} per square foot.</p>
      <div class="grid g3">${APN.SECTORS.map(sectorCard).join('')}</div></div></section>
    <section class="band alt"><div class="wrap"><div class="eyebrow">How it works</div><h2>From address to released payment</h2>
      <div class="grid g4 steps">
        <div class="card"><h4>Search the property</h4><p class="small muted">Satellite view separates the building footprint from the land, so interior and grounds work are each priced on the right area.</p></div>
        <div class="card"><h4>Choose sector and tier</h4><p class="small muted">Pick the services you need. The price is the area times the tier rate, shown before you commit.</p></div>
        <div class="card"><h4>Funds held in escrow</h4><p class="small muted">Your payment is held, a dispatch ticket goes live, and a cleared contractor claims it.</p></div>
        <div class="card"><h4>Ten photos, then release</h4><p class="small muted">Five checkpoints, before and after. Payment releases only once the record is complete.</p></div>
      </div></div></section>
    <section class="band"><div class="wrap grid g2" id="vision">
      <div><div class="eyebrow">${t('vision')}</div><h2>Property care that is transparent, verified and fair to the people who do the work.</h2>
        <p>Our goal is a single network where an owner can price any property in a minute, where the same trusted technician returns for recurring work, and where no one is paid on a promise or left unpaid for finished work.</p>
        <p class="muted">Field partners start at ${APN.PAYOUT.base}% of the service total and earn up to ${APN.PAYOUT.cap}% through five-star reviews, with a ${money(APN.FEES.transit)} transit stipend on every job.</p></div>
      <div class="card"><h3>For contractors</h3><p class="small muted">Independent 1099 partners complete vetting once, then claim live dispatch tickets in their area.</p>
        <table><tr><td>Vetting</td><td>ISSA CIMS certification, liability insurance and bond, background check, W-9. Landscaping work also needs a landscaping certification and an applicator license.</td></tr><tr><td>Split</td><td>${APN.PAYOUT.base}% rising ${APN.PAYOUT.step}% per ${APN.PAYOUT.every} five-star reviews, capped at ${APN.PAYOUT.cap}%</td></tr><tr><td>After the cap</td><td>${money(APN.PAYOUT.bonus)} bonus per further ${APN.PAYOUT.every} five-star reviews</td></tr><tr><td>After-hours</td><td>100% of the ${money(APN.FEES.afterHours)} fee</td></tr></table>
        <p style="margin:14px 0 0"><a class="btn" href="#login" data-act="joinContractor">${t('join')}</a></p></div></div></section>`;
  }

  /* ---------- sign in ---------- */
  function vLogin() {
    const up = ui.loginTab === 'up';
    const rb = (k, l) => `<button type="button" class="${ui.loginRole === k ? 'on' : ''}" data-act="loginRole" data-k="${k}">${l}</button>`;
    return `<div class="wrap dash" style="max-width:520px"><div class="card">
      <div class="tabs"><button class="${up ? '' : 'on'}" data-act="loginTab" data-k="in">Sign in</button><button class="${up ? 'on' : ''}" data-act="loginTab" data-k="up">Create account</button></div>
      <form data-form="login" novalidate>
        ${up ? `<div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" type="text" autocomplete="name"></div>` : ''}
        <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email"></div>
        ${up ? `<div class="field"><label for="f-phone">Mobile number for dispatch messages</label><input id="f-phone" name="phone" type="tel" placeholder="+16145550123" autocomplete="tel"><div class="small muted">International format, starting with + and country code.</div></div>` : ''}
        <div class="field"><label for="f-pw">Password</label><input id="f-pw" name="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"></div>
        ${up ? `<div class="field"><label for="f-pw2">Confirm password</label><input id="f-pw2" name="pw2" type="password" autocomplete="new-password"></div>` : ''}
        <div class="field"><label>Account type</label><div class="seg">${rb('customer', 'Customer')}${rb('contractor', '1099 contractor')}${cfg.DEMO_MODE ? rb('ops', 'Operations') : ''}</div></div>
        <div id="login-err" class="small" style="color:var(--bad);min-height:20px" role="alert"></div>
        <button class="btn primary" style="width:100%">${up ? 'Create account' : 'Sign in'}</button>
      </form>
      ${cfg.DEMO_MODE ? `<p class="note" style="margin:16px 0 0">Demo mode: any email and password work, and the account type you pick decides which dashboard opens. In production the role comes from the server and Operations is not selectable here.</p>` : ''}
    </div></div>`;
  }

  /* ---------- customer dashboard ---------- */
  const myTickets = () => S.tickets.filter(x => x.mine);
  function vConsole() {
    const tabs = [['overview', 'Overview'], ['props', 'Properties'], ['order', 'New order'], ['orders', 'Orders & receipts']];
    const body = { overview: cOverview, props: cProps, order: cOrder, orders: cOrders }[ui.cTab]();
    return sky(`Welcome back, ${S.user.name}`, 'Customer dashboard') + `<div class="wrap dash"><div class="tabs">${tabs.map(([k, l]) => `<button class="${ui.cTab === k ? 'on' : ''}" data-act="cTab" data-k="${k}">${l}${k === 'order' && S.cart.length ? ` (${S.cart.length})` : ''}</button>`).join('')}</div><p class="tabdesc">${esc(APN.tabHelp.cTab[ui.cTab])}</p>${body}</div>`;
  }
  function cOverview() {
    const mine = myTickets(), open = mine.filter(x => !['released', 'refunded'].includes(x.status));
    const held = open.reduce((a, x) => a + x.total, 0), pct = APN.portfolioPct(S.props.length);
    return `<div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><b>${S.props.length}</b><span>Properties</span></div>
      <div class="card kpi"><b>${open.length}</b><span>Open orders</span></div>
      <div class="card kpi"><b>${mine.filter(x => x.status === 'review').length}</b><span>Awaiting photo review</span></div>
      <div class="card kpi"><b>${money(held)}</b><span>Held in escrow</span></div></div>
    <div class="grid g2"><div class="card"><div class="row between"><h3>Recent orders</h3><button class="btn sm" data-act="cTab" data-k="order">New order</button></div>
      ${mine.length ? mine.slice(-5).reverse().map(x => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(APN.sector(x.sector).short)}</b> &middot; ${esc(tierName(x))}<div class="small muted">${esc(x.address)}</div></div>${pill(STATUS[x.status])}${escrowPill(x)}</div>`).join('') : `<p class="muted">No orders yet. Start with a property and a quote.</p>`}</div>
    <div class="card"><h3>Account</h3><table class="sum">
      <tr><td>Portfolio discount</td><td class="r num">${pct ? Math.round(pct * 100) + '% off' : 'None yet'}</td></tr>
      <tr><td class="small muted" colspan="2">${APN.PORTFOLIO[1].min} or more properties: ${Math.round(APN.PORTFOLIO[1].pct * 100)}% off the rate. ${APN.PORTFOLIO[0].min} or more: ${Math.round(APN.PORTFOLIO[0].pct * 100)}% off. There is no limit on properties.</td></tr>
      <tr><td>Bundle discount</td><td class="r">2+ sectors on one property</td></tr>
      <tr><td>Same technician on recurring work</td><td class="r">${pill('Active', 'ok')}</td></tr></table></div></div>`;
  }
  function parcelSVG(p) {
    const lot = Math.max(1, p.building + p.land), f = Math.sqrt(Math.min(0.92, p.building / lot));
    return `<div class="parcel"><div class="lot"></div><div class="bld" style="width:${(f * 84).toFixed(1)}%;height:${(f * 84).toFixed(1)}%"></div><div class="lbl">Schematic, not imagery. Blue: building. Dashed: lot line.</div></div>`;
  }
  const isV = (x, k) => !x.verified || !!x.verified[k];
  const vp = (x, k, label) => pill(label + (isV(x, k) ? ' verified' : ' pending'), isV(x, k) ? 'ok' : 'warn');
  /* ---------- auto-clean from a booking calendar ---------- */
  const STR = () => APN.sector('str');
  const calProp = () => S.props.find(x => x.id === ui.cal);
  function calCard() {
    const p = calProp(); if (!p) return '';
    const c = p.cal, sec = STR(), pend = c.pending || [];
    return `<div class="card" style="margin-bottom:16px"><div class="row between"><h3 style="margin:0">Auto-clean: ${esc(p.label)}</h3><button class="btn sm ghost" data-act="calClose">Close</button></div>
      <p class="small muted">Paste your booking calendar link (the iCal / .ics link from Airbnb, Vrbo or your property manager). When a stay ends, we dispatch a cleaner. The link only shows booked dates, never guest details.</p>
      <div class="field"><label for="c-url">Calendar link</label><input id="c-url" type="text" data-cal="url" value="${esc(c.url || '')}" placeholder="https://www.airbnb.com/calendar/ical/....ics" autocomplete="off"></div>
      <div class="grid g2" style="gap:10px"><div class="field"><label for="c-tier">Clean after every stay</label><select id="c-tier" data-cal="tier">${sec.tiers.map((t, i) => `<option value="${i}" ${+c.tier === i ? 'selected' : ''}>${esc(t[0])} (${money(APN.RATES[i])}/sq ft)</option>`).join('')}</select></div>
        <div class="field"><label for="c-mode">When a stay ends</label><select id="c-mode" data-cal="confirm"><option value="0" ${!c.confirm ? 'selected' : ''}>Order the clean automatically</option><option value="1" ${c.confirm ? 'selected' : ''}>Ask me to approve each one</option></select></div></div>
      <div class="grid g2" style="gap:8px">${sec.services.map(([n]) => `<label class="opt ${(c.services || []).includes(n) ? 'on' : ''}"><input type="checkbox" data-cal-svc="${esc(n)}" ${(c.services || []).includes(n) ? 'checked' : ''}><span><b>${esc(n)}</b></span></label>`).join('')}</div>
      <label class="opt ${c.on ? 'on' : ''}" style="margin-top:10px"><input type="checkbox" data-cal="on" ${c.on ? 'checked' : ''}><span><b>Auto-clean is on for this property</b><small>Each check-out creates a paid order held in escrow. Turn it off any time.</small></span></label>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="calSave">Save and sync now</button>${c.last ? `<span class="small muted">Last checked ${ago(c.last)}${c.found != null ? ` &middot; ${c.found} upcoming check-out${c.found === 1 ? '' : 's'}` : ''}</span>` : ''}</div>
      ${c.err ? `<p class="small" style="color:var(--bad);margin:8px 0 0" role="alert">${esc(c.err)}</p>` : ''}
      ${pend.length ? `<h4 style="margin-top:16px">Waiting for your approval</h4>${pend.map((e, i) => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span>Check-out <b>${esc(e.checkOut)}</b>${e.sameDay ? ' ' + pill('Same-day turnover', 'warn') : ''}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</span><span class="row"><button class="btn sm primary" data-act="calApprove" data-i="${i}">Order clean</button><button class="btn sm" data-act="calSkip" data-i="${i}">Skip</button></span></div>`).join('')}` : ''}</div>`;
  }
  function calOrder(p, e) {
    const c = p.cal, item = { propId: p.id, sector: 'str', tier: +c.tier || 0, services: (c.services && c.services.length ? c.services : STR().services.slice(0, 2).map(x => x[0])), freq: 'One-time', immediate: false, afterHours: false };
    const q = APN.quote(item, S); if (!q) return false;
    S.tickets.push({ id: APN.uid('DT'), sector: 'str', tier: item.tier, services: item.services, freq: 'One-time', address: p.address, propId: p.id, area: q.area, service: q.service, total: q.total, immediate: false, afterHours: false, window: `Check-out ${e.checkOut}${e.sameDay ? ' (same-day turnover)' : ''}`, sameDay: e.sameDay, auto: true, status: 'open', escrow: 'held', photos: {}, created: Date.now(), mine: true });
    return true;
  }
  async function calSync(p, manual) {
    const c = p.cal; if (!c || !c.url) return;
    c.last = Date.now(); c.err = '';
    try {
      const r = await fetch('/api/ical?url=' + encodeURIComponent(c.url)), j = await r.json();
      if (!r.ok) throw new Error(j.error);
      c.found = j.checkouts.length; c.seen = c.seen || {}; c.pending = c.pending || []; let made = 0;
      if (c.on) for (const e of j.checkouts) {
        const k = e.uid + '|' + e.checkOut; if (c.seen[k]) continue; c.seen[k] = 1;
        if (!isV(p, 'building')) { c.pending.push(Object.assign({ note: 'Waiting for our team to verify this property\'s measurements.' }, e)); continue; }
        if (c.confirm) c.pending.push(e); else if (calOrder(p, e)) made++;
      }
      save(); if (made) toast(`${made} cleaning${made === 1 ? '' : 's'} ordered from your calendar`); else if (manual) toast(c.on ? 'Calendar checked. Nothing new to order.' : 'Calendar checked. Turn auto-clean on to start ordering.');
    } catch (e) {
      c.err = { bad_url: 'That link could not be used. Use the https calendar (.ics) link from your booking platform.', fetch_failed: 'The calendar link did not respond. Check that it is still active.', too_large: 'That calendar is too large to read.' }[e.message] || 'We could not read that calendar right now. Try again shortly.';
      save();
    }
    render();
  }
  let lastAuto = 0;
  function calAuto() { if (role() !== 'customer' || Date.now() - lastAuto < 15 * 60e3) return; lastAuto = Date.now(); S.props.filter(p => p.cal && p.cal.on && p.cal.url).forEach(p => calSync(p, false)); }

  function bulkCard() {
    if (ui.bulk === null) return '';
    return `<div class="card" style="margin-bottom:16px"><div class="row between"><h3 style="margin:0">Add many properties</h3><button class="btn sm ghost" data-act="bulkClose">Close</button></div>
      <p class="small muted">Paste one full address per line. There is no limit on how many properties you can add. Our team verifies each measurement before ordering opens for it. Reaching 5 properties earns ${Math.round(APN.PORTFOLIO[1].pct * 100)}% off and 10 earns ${Math.round(APN.PORTFOLIO[0].pct * 100)}% off.</p>
      <div class="field"><label for="b-type">Property type</label><select id="b-type" data-bulk-type>${['Residential', 'STR', 'Commercial'].map(x => `<option ${ui.bulkType === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="b-text">Addresses</label><textarea id="b-text" data-bulk rows="8" placeholder="123 Main St, Louisville, KY 40202&#10;456 Oak Ave, Lexington, KY 40507">${esc(ui.bulk)}</textarea></div>
      <button class="btn primary" data-act="bulkAdd">Add these properties</button></div>`;
  }
  function cProps() {
    const p = ui.prop;
    const form = p ? `<div class="card" style="margin-bottom:16px"><h3>Add a property</h3><div class="grid g2">
      <div><div class="field"><label for="p-addr">Property address</label><input id="p-addr" type="text" data-prop="address" value="${esc(p.address)}" autocomplete="street-address"></div>
        <div class="grid g2" style="gap:10px"><div class="field"><label for="p-label">Name</label><input id="p-label" type="text" data-prop="label" value="${esc(p.label)}"></div>
        <div class="field"><label for="p-type">Type</label><select id="p-type" data-prop="type">${['Residential', 'STR', 'Commercial'].map(x => `<option ${p.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
        <button class="btn" data-act="measure">Measure from satellite</button>
        ${p.measured ? `<div class="grid g2" style="gap:10px;margin-top:14px"><div class="field"><label for="p-b">Building footprint (sq ft)</label><input id="p-b" type="number" readonly value="${p.building}"></div>
        <div class="field"><label for="p-l">Land, excluding building (sq ft)</label><input id="p-l" type="number" readonly value="${p.land}"></div></div>
        <p class="small muted">${p.source === 'satellite' ? (p.auto ? 'Building footprint measured automatically and locked. Click the corners of the lot; our team verifies the lot before grounds work can be ordered.' : 'No automatic outline for this address. Trace the building and the lot; our team verifies both before you can order.') : 'Estimated without imagery. Our team verifies these figures before you can order.'}</p>
        <div class="row"><button class="btn primary" data-act="saveProp">Save property</button><button class="btn ghost" data-act="cancelProp">Cancel</button></div>` : ''}</div>
      <div>${p.measured ? (cfg.GOOGLE_MAPS_KEY ? `<div id="gmap"></div><div class="seg" style="margin-top:8px"><button data-act="trace" data-k="building" class="${p.trace !== 'land' ? 'on' : ''}" ${p.auto ? 'disabled' : ''}>${p.auto ? 'Building locked' : 'Trace building'}</button><button data-act="trace" data-k="land" class="${p.trace === 'land' ? 'on' : ''}">Trace lot</button><button data-act="traceClear">Clear outline</button></div>` : parcelSVG(p)) : `<div class="note">Enter the address and measure. We read the building footprint and the land separately: interior work is priced on the building, grounds work on the land.</div>`}</div></div></div>` : '';
    return `${form}${bulkCard()}${calCard()}<div class="card"><div class="row between"><h3>Your properties</h3>${p ? '' : `<span class="row"><button class="btn sm" data-act="bulkOpen">Add many at once</button><button class="btn primary sm" data-act="newProp">Add property</button></span>`}</div>
      <div class="scroll-x"><table><tr><th>Property</th><th>Type</th><th class="r">Building</th><th class="r">Land</th><th>Verification</th><th></th></tr>
      ${S.props.map(x => `<tr><td><b>${esc(x.label)}</b><div class="small muted">${esc(x.address)}</div></td><td>${esc(x.type)}</td><td class="r num">${sqft(x.building)}</td><td class="r num">${sqft(x.land)}</td><td>${vp(x, 'building', 'Building')} ${vp(x, 'land', 'Land')}</td><td class="r"><button class="btn sm" data-act="orderFor" data-id="${x.id}">Order</button> <button class="btn sm" data-act="calOpen" data-id="${x.id}">Auto-clean${x.cal && x.cal.on ? ' &#10003;' : ''}</button> <button class="btn sm danger" data-act="delProp" data-id="${x.id}">Remove</button></td></tr>`).join('') || `<tr><td colspan="6" class="muted">No properties yet.</td></tr>`}</table></div></div>`;
  }
  function cOrder() {
    if (!S.props.length) return `<div class="card"><p>Add a property first so we can measure it.</p><button class="btn primary" data-act="newProp">Add property</button></div>`;
    const o = ui.order; if (!S.props.find(p => p.id === o.propId)) o.propId = S.props[0].id;
    const sec = APN.sector(o.sector), q = APN.quote(o, S), prop = S.props.find(p => p.id === o.propId);
    const cart = S.cart.map((c, i) => ({ c, i, q: APN.quote(c, S), p: S.props.find(p => p.id === c.propId) })).filter(x => x.q);
    const total = cart.reduce((a, x) => a + x.q.total, 0);
    return `<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);align-items:start" id="order-grid">
    <div class="grid">
      <div class="card"><h3>1. Property and sector</h3><div class="field"><label for="o-prop">Property</label><select id="o-prop" data-order="propId">${S.props.map(p => `<option value="${p.id}" ${p.id === o.propId ? 'selected' : ''}>${esc(p.label)}: ${esc(p.address)}</option>`).join('')}</select></div>
        <div class="seg">${APN.SECTORS.map(s => `<button data-act="oSector" data-k="${s.id}" class="${o.sector === s.id ? 'on' : ''}" ${s.soon ? 'disabled title="Coming soon"' : ''}>${esc(s.short)}${s.soon ? ' (soon)' : ''}</button>`).join('')}</div></div>
      <div class="card"><h3>2. Services in ${esc(sec.name)}</h3><div class="grid g2" style="gap:8px">${sec.services.map(([n, d]) => `<label class="opt ${o.services.includes(n) ? 'on' : ''}"><input type="checkbox" data-svc="${esc(n)}" ${o.services.includes(n) ? 'checked' : ''}><span><b>${esc(n)}</b><small>${esc(d)}</small></span></label>`).join('')}</div></div>
      <div class="card"><h3>3. Tier</h3><div class="grid g3" style="gap:8px">${sec.tiers.map(([n, d], i) => `<label class="opt ${o.tier === i ? 'on' : ''}"><input type="radio" name="tier" data-tier="${i}" ${o.tier === i ? 'checked' : ''}><span><b>${esc(n)}</b><small>${money(APN.RATES[i])} per sq ft<br>${esc(d)}</small></span></label>`).join('')}</div></div>
      <div class="card"><h3>4. Schedule</h3><div class="seg" style="margin-bottom:12px">${APN.FREQ.map(f => `<button data-act="oFreq" data-k="${f}" class="${o.freq === f ? 'on' : ''}">${f}</button>`).join('')}</div>
        <label class="opt ${o.afterHours ? 'on' : ''}" style="margin-bottom:8px"><input type="checkbox" data-flag="afterHours" ${o.afterHours ? 'checked' : ''}><span><b>After-hours dispatch (+${money(APN.FEES.afterHours)})</b><small>Evenings, nights and weekends. The full fee goes to the contractor.</small></span></label>
    </div>
    <div class="grid" style="position:sticky;top:80px">
      <div class="card"><h3>Quote</h3><table class="sum">
        <tr><td>${q.basis === 'land' ? 'Land area' : 'Building area'}</td><td class="r num">${sqft(q.area)}</td></tr>
        ${q.guarded ? `<tr><td colspan="2" class="small muted">Large residential lot: priced on a ${sqft(APN.RES_GUARD.anchor)} core footprint.</td></tr>` : ''}
        <tr><td>${esc(sec.tiers[o.tier][0])}</td><td class="r num">${money(q.base)}/sq ft</td></tr>
        ${q.bundle ? `<tr><td>Bundle discount</td><td class="r num">&minus;${money(q.bundle)}</td></tr>` : ''}${q.port ? `<tr><td>Portfolio discount (${Math.round(q.portPct * 100)}%)</td><td class="r num">&minus;${money(q.port)}</td></tr>` : ''}
        <tr><td>Service</td><td class="r num">${money(q.service)}</td></tr>${q.fees ? `<tr><td>Dispatch fees</td><td class="r num">${money(q.fees)}</td></tr>` : ''}
        <tr class="t"><td>Total per visit</td><td class="r num">${money(q.total)}</td></tr></table>
        <p class="small muted">${esc(prop.label)} &middot; ${o.services.length} service${o.services.length === 1 ? '' : 's'} &middot; ${o.freq}. Tax is added at payment by jurisdiction.</p>
        ${isV(prop, q.basis) ? '' : `<p class="note">The ${q.basis === 'land' ? 'land' : 'building'} measurement for this property is awaiting verification. You can see the estimate, and ordering opens once our team confirms it.</p>`}
        <button class="btn primary" style="width:100%" data-act="addCart" ${o.services.length && isV(prop, q.basis) ? '' : 'disabled'}>${!isV(prop, q.basis) ? 'Awaiting measurement verification' : o.services.length ? 'Add to cart' : 'Select at least one service'}</button></div>
      <div class="card"><h3>Cart</h3>${cart.length ? cart.map(x => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(APN.sector(x.c.sector).short)}</b> &middot; ${esc(APN.sector(x.c.sector).tiers[x.c.tier][0])}<div class="small muted">${esc(x.p.label)} &middot; ${x.c.freq}</div></div><b class="num">${money(x.q.total)}</b><button class="btn sm" data-act="rmCart" data-i="${x.i}" aria-label="Remove">&times;</button></div>`).join('') + `<table class="sum"><tr class="t"><td>Due now, held in escrow</td><td class="r num">${money(total)}</td></tr></table>
        <p class="small muted">${cfg.STRIPE_PUBLISHABLE_KEY ? 'Card details are collected securely by Stripe.' : 'Test mode: the Stripe key is not set, so no card is charged.'}</p>
        <button class="btn primary" style="width:100%" data-act="checkout">Place order and hold funds</button>` : `<p class="muted small">Your cart is empty.</p>`}</div>
    </div></div>`;
  }
  function cOrders() {
    const mine = myTickets().slice().reverse();
    const tracking = mine.filter(x => APN.track.live(x)).map(x => `<div class="card" style="margin-bottom:16px"><div class="row between"><h3 style="margin:0">${esc(APN.sector(x.sector).short)} &middot; ${x.id}</h3><b id="track-${x.id}-st" class="small">Waiting for the contractor to share a location…</b></div>
      <p class="small muted" style="margin:4px 0 10px">${esc(x.address)}. You can see your contractor only while this job is in progress. It disappears when the job is submitted.</p>
      ${cfg.GOOGLE_MAPS_KEY ? `<div id="track-${x.id}" data-track="${x.id}" data-who="customer" class="trackmap"></div>` : '<p class="small muted">Live map needs the Google Maps key.</p>'}</div>`).join('');
    return tracking + `<div class="card"><h3>Orders</h3><div class="scroll-x"><table><tr><th>Order</th><th>Service</th><th>Status</th><th>Escrow</th><th>Photos</th><th class="r">Total</th><th></th></tr>
      ${mine.map(x => `<tr><td class="num">${x.id}<div class="small muted">${ago(x.created)}</div></td><td><b>${esc(APN.sector(x.sector).short)}</b> &middot; ${esc(tierName(x))}<div class="small muted">${esc(x.address)}</div></td><td>${pill(STATUS[x.status])}</td><td>${escrowPill(x)}</td><td class="num">${Object.keys(x.photos).length}/10</td><td class="r num">${money(x.total)}</td>
        <td class="r">${['claimed', 'onsite', 'review'].includes(x.status) ? `<button class="btn sm danger" data-act="dispute" data-id="${x.id}">Dispute</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">No orders yet.</td></tr>`}</table></div></div>
    <div class="card" style="margin-top:16px"><h3>Receipts</h3>${S.receipts.filter(r => r.mine).map(r => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><div class="grow"><b class="num">${r.id}</b> &middot; ${esc(r.line)}<div class="small muted num">${r.iso} &middot; audit hash ${r.hash}</div></div><b class="num">${money(r.total)}</b></div>`).join('') || `<p class="muted small">Receipts appear here when escrow is released.</p>`}</div>`;
  }

  /* ---------- contractor ---------- */
  function ticketCard(x, mode) {
    const pay = APN.payout(x, S.contractor.reviews), s = APN.sector(x.sector);
    let action = '';
    if (mode === 'board') action = x.status !== 'open' ? pill(STATUS[x.status]) : canClaim(x) && role() === 'contractor' ? `<button class="btn primary sm" data-act="claim" data-id="${x.id}">Claim</button>` : `<button class="btn sm" disabled title="${esc(claimBlock(x))}">Claim</button>${cleared() && tradeMissing(x.sector).length ? `<div class="small muted" style="margin-top:4px">${esc(claimBlock(x))}</div>` : ''}`;
    if (mode === 'mine') action = `<button class="btn sm primary" data-act="openJob" data-id="${x.id}">Open</button>`;
    return `<div class="ticket ${ui.fresh === x.id ? 'new' : ''}"><div><div class="row"><b>${esc(s.short)}</b>${pill(tierName(x), 'info')}${x.immediate ? pill('Immediate', 'bad') : ''}${x.sameDay ? pill('Same-day turnover', 'warn') : ''}${x.afterHours ? pill('After-hours', 'warn') : ''}</div>
      <div>${esc(x.address)}</div><div class="small muted">${sqft(x.area)} &middot; ${esc(x.window || 'Flexible')} &middot; posted ${ago(x.created)}</div>
      <div class="small muted">${x.services.map(esc).join(', ')}</div></div>
      <div style="text-align:right"><div class="small muted">Your payout</div><b class="num" style="font-size:18px">${money(pay.total)}</b><div class="small muted num">${pay.pct}% + ${money(pay.extra)}</div><div style="margin-top:8px">${action}</div></div></div>`;
  }
  function vContractor() {
    if (!cleared()) return sky('Contractor dashboard', '1099 field partner') + `<div class="wrap dash"><div class="card lock"><h2>Access denied: compliance threshold unmet</h2><p class="muted">Dispatch opens once your ISSA CIMS exam, liability bond and background check are verified.</p><a class="btn primary" href="#vetting">Go to vetting</a></div></div>`;
    const tabs = [['overview', 'Overview'], ['queue', 'Job queue'], ['mine', 'My jobs'], ['earn', 'Earnings']];
    const body = { overview: kOverview, queue: kQueue, mine: kMine, earn: kEarn }[ui.kTab]();
    return sky(`Welcome back, ${S.user.name}`, '1099 contractor dashboard') + `<div class="wrap dash"><div class="tabs">${tabs.map(([k, l]) => `<button class="${ui.kTab === k ? 'on' : ''}" data-act="kTab" data-k="${k}">${l}</button>`).join('')}</div><p class="tabdesc">${esc(APN.tabHelp.kTab[ui.kTab])}</p>${body}</div>`;
  }
  const mineK = () => S.tickets.filter(x => x.claimedBy === ME);
  function kOverview() {
    const m = mineK(), done = m.filter(x => x.status === 'released'), c = S.contractor;
    const earned = done.reduce((a, x) => a + APN.payout(x, c.reviews).total, 0);
    return `<div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><b>${S.tickets.filter(x => x.status === 'open').length}</b><span>Open tickets nearby</span></div>
      <div class="card kpi"><b>${m.filter(x => ['claimed', 'onsite'].includes(x.status)).length}</b><span>Active jobs</span></div>
      <div class="card kpi"><b>${APN.split(c.reviews)}%</b><span>Current split</span></div><div class="card kpi"><b>${money(earned)}</b><span>Released to you</span></div></div>
      <div class="card"><div class="row between"><h3>Newest tickets</h3><span class="live"><i></i>Live</span></div><div class="grid">${S.tickets.filter(x => x.status === 'open').slice(-3).reverse().map(x => ticketCard(x, 'board')).join('') || '<p class="muted">No open tickets right now.</p>'}</div></div>`;
  }
  const kQueue = () => `<div class="row between" style="margin-bottom:10px"><h3 style="margin:0">Open dispatch tickets</h3><span class="live"><i></i>Live</span></div><div class="grid">${S.tickets.filter(x => x.status === 'open').slice().reverse().map(x => ticketCard(x, 'board')).join('') || '<p class="muted">No open tickets right now.</p>'}</div>`;
  function kMine() {
    const job = S.tickets.find(x => x.id === ui.job && x.claimedBy === ME);
    if (!job) return `<div class="grid">${mineK().slice().reverse().map(x => ticketCard(x, 'mine')).join('') || '<p class="muted">You have not claimed a job yet.</p>'}</div>`;
    const n = Object.keys(job.photos).length, editable = ['claimed', 'onsite'].includes(job.status);
    const slots = APN.PHOTO_POINTS.flatMap((p, i) => [[i * 2, p, 'Before'], [i * 2 + 1, p, 'After']]);
    return `<button class="btn sm" data-act="closeJob">&lsaquo; All my jobs</button><div class="card" style="margin-top:12px"><div class="row between"><h3>${esc(APN.sector(job.sector).name)} &middot; ${esc(tierName(job))}</h3>${pill(STATUS[job.status])}</div>
      <p>${esc(job.address)}<br><span class="small muted">${sqft(job.area)} &middot; ${esc(job.window || '')} &middot; ${job.services.map(esc).join(', ')}</span></p>
      ${editable ? navBlock(job) : ''}
      <h4>Ten-photo verification (${n}/10)</h4><div class="bar" style="margin-bottom:12px"><i style="width:${n * 10}%"></i></div>
      <div class="photos">${slots.map(([i, p, w]) => { const u = (ui.photoURL[job.id] || {})[i]; return `<label class="photo ${job.photos[i] ? 'done' : ''}" ${u ? `style="background-image:url(${u})"` : ''}><span><b>${w}</b></span><span>${esc(p)}</span><span class="small">${job.photos[i] ? 'Added' : 'Tap to add'}</span>${editable ? `<input type="file" accept="image/*" data-photo="${i}" aria-label="${w} photo: ${esc(p)}">` : ''}</label>`; }).join('')}</div>
      <div class="row" style="margin-top:14px">${job.status === 'claimed' ? `<button class="btn" data-act="onsite" data-id="${job.id}">Mark on site</button>` : ''}
      ${editable ? `<button class="btn primary" data-act="submitJob" data-id="${job.id}" ${n < 10 ? 'disabled' : ''}>${n < 10 ? `Add ${10 - n} more photo${10 - n === 1 ? '' : 's'} to submit` : 'Submit for review'}</button>` : `<span class="muted small">${job.status === 'review' ? 'Submitted. Escrow releases after review.' : ''}</span>`}</div></div>`;
  }
  function navBlock(job) {
    const url = APN.directionsUrl(job.address);
    if (!job.enroute) return `<div class="note" style="margin:0 0 14px"><div class="row between"><div class="grow"><b>Heading to the job?</b><div class="small muted">Tap On my way to open Google Maps directions. The customer will see your live position until you submit the job.</div></div>
      <button class="btn primary" data-act="enroute" data-id="${job.id}">On my way</button></div></div>`;
    return `<div class="card" style="margin:0 0 14px"><div class="row between"><b id="route-${job.id}-st" class="small">Finding your location…</b>
      <span class="row"><a class="btn sm primary" href="${esc(url)}" target="_blank" rel="noopener">Open in Google Maps</a><button class="btn sm" data-act="stopShare" data-id="${job.id}">Stop sharing</button></span></div>
      ${cfg.GOOGLE_MAPS_KEY ? `<div id="route-${job.id}" data-track="${job.id}" data-who="contractor" class="trackmap" style="margin-top:10px"></div>` : ''}
      <p class="small muted" style="margin:8px 0 0">Keep this page open while you drive so your position keeps updating. Sharing ends automatically when you submit the job.</p></div>`;
  }
  function kEarn() {
    const c = S.contractor, P = APN.PAYOUT, pct = APN.split(c.reviews), capAt = (P.cap - P.base) / P.step * P.every;
    const next = c.reviews < capAt ? P.every - (c.reviews % P.every) : P.every - ((c.reviews - capAt) % P.every);
    const rows = mineK().filter(x => ['review', 'released'].includes(x.status));
    return `<div class="grid g2"><div class="card"><h3>Revenue split</h3><p><b style="font:700 28px Manrope">${pct}%</b> of each service total, from ${c.reviews} verified five-star reviews.</p>
      <div class="bar"><i style="width:${Math.min(100, (c.reviews % P.every) / P.every * 100)}%"></i></div>
      <p class="small muted" style="margin-top:8px">${next} more review${next === 1 ? '' : 's'} to ${c.reviews < capAt ? `reach ${pct + P.step}%` : `earn a ${money(P.bonus)} bonus`}.</p>
      <table><tr><th>Reviews</th><th class="r">Your split</th></tr>${[0, 1, 2].map(i => `<tr><td class="num">${i * P.every}${i === 2 ? '+' : '–' + ((i + 1) * P.every - 1)}</td><td class="r num">${P.base + i * P.step}%</td></tr>`).join('')}</table>
      <p class="small muted" style="margin:10px 0 0">Every job adds a ${money(APN.FEES.transit)} transit stipend. After-hours jobs add the full ${money(APN.FEES.afterHours)} fee.</p></div>
      <div class="card"><h3>Payouts</h3>${rows.length ? `<table><tr><th>Job</th><th>Status</th><th class="r">Amount</th></tr>${rows.map(x => `<tr><td>${esc(APN.sector(x.sector).short)}<div class="small muted">${esc(x.address)}</div></td><td>${x.status === 'released' ? pill('Paid', 'ok') : pill('Pending review', 'warn')}</td><td class="r num">${money(APN.payout(x, c.reviews).total)}</td></tr>`).join('')}</table>` : '<p class="muted small">Payouts appear after you submit a job.</p>'}</div></div>`;
  }

  /* ---------- vetting portal + live dispatch board ---------- */
  const VST = { missing: ['Not submitted', ''], submitted: ['In review', 'warn'], verified: ['Verified', 'ok'], rejected: ['Rejected', 'bad'] };
  const tradeFor = k => Object.keys(APN.TRADE_GATE).filter(sec => APN.TRADE_GATE[sec].includes(k)).map(sec => APN.sector(sec).name);
  function vetRows(list, isC) {
    const c = S.contractor;
    return list.map(([k, n, d]) => { const st = c.vetting[k]; return `<div style="padding:12px 0;border-top:1px solid var(--line)"><div class="row between"><b>${n}</b>${pill(VST[st][0], VST[st][1])}</div><div class="small muted">${d}${APN.GATE.includes(k) ? ' Required to claim any job.' : tradeFor(k).length ? ' Required for ' + tradeFor(k).join(' and ') + ' jobs.' : ''}</div>
      ${isC && (st === 'missing' || st === 'rejected') ? `<label class="btn sm" style="margin-top:8px;position:relative;overflow:hidden">Upload document<input type="file" data-vet="${k}" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Upload ${n}"></label>` : ''}</div>`; }).join('');
  }
  function vVetting() {
    const c = S.contractor, isC = role() === 'contractor', open = S.tickets.filter(x => x.status === 'open');
    return sky('Vetting & live dispatch', cleared() ? 'Cleared for dispatch' : 'Complete vetting to claim tickets') + `<div class="wrap dash"><div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);align-items:start" id="vet-grid">
      <div class="card"><div class="row between"><h3>Vetting checklist</h3>${cleared() ? pill('Cleared', 'ok') : pill('Not cleared', 'warn')}</div>
        ${vetRows(APN.VETTING.filter(v => APN.GATE.includes(v[0])), isC)}
        <h4 style="margin:18px 0 0">Trade credentials</h4><p class="small muted" style="margin:4px 0 0">Needed only for the sectors named below. You can still claim every other sector without them.</p>
        ${vetRows(APN.VETTING.filter(v => !APN.GATE.includes(v[0])), isC)}
        ${cfg.DEMO_MODE ? `<p class="note" style="margin:12px 0 0">Demo: uploads are marked "In review" and stay on this device. Sign in as Operations to verify them.</p>` : ''}</div>
      <div><div class="row between" style="margin-bottom:10px"><h3 style="margin:0">Active dispatch tickets (${open.length})</h3><span class="live"><i></i>Live</span></div>
        <div class="grid">${open.slice().reverse().map(x => ticketCard(x, 'board')).join('') || '<p class="muted">No open tickets right now.</p>'}</div></div></div></div>`;
  }

  /* ---------- operations ---------- */
  function vOps() {
    const c = S.contractor, q = S.tickets.filter(x => ['review', 'disputed'].includes(x.status));
    const held = S.tickets.filter(x => ['held', 'transit', 'disputed'].includes(x.escrow)).reduce((a, x) => a + x.total, 0);
    const svc = [['Xano backend', cfg.XANO_BASE_URL ? 'Configured' : 'Not connected in this build', cfg.XANO_BASE_URL], ['Google Maps satellite', cfg.GOOGLE_MAPS_KEY ? 'Key set' : 'Key not set: estimates only', cfg.GOOGLE_MAPS_KEY], ['Stripe', cfg.STRIPE_PUBLISHABLE_KEY ? 'Key set' : 'Key not set: test mode', cfg.STRIPE_PUBLISHABLE_KEY], ['Twilio / Brevo', 'Server-side, not wired in this build', false], ['Weather', APN.atmo.s.live ? 'Live' : 'Unavailable here', APN.atmo.s.live]];
    return sky('Operations', 'Escrow, vetting and announcements') + `<div class="wrap dash">
      <div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><b>${S.tickets.filter(x => x.status === 'open').length}</b><span>Open tickets</span></div><div class="card kpi"><b>${q.length}</b><span>Awaiting your decision</span></div><div class="card kpi"><b>${money(held)}</b><span>In escrow</span></div><div class="card kpi"><b>${S.receipts.length}</b><span>Receipts issued</span></div></div>
      <div class="grid g2">
      <div class="card"><h3>Escrow queue</h3>${q.map(x => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><b>${esc(APN.sector(x.sector).short)} &middot; ${x.id}</b>${escrowPill(x)}</div><div class="small muted">${esc(x.address)} &middot; ${Object.keys(x.photos).length}/10 photos &middot; ${money(x.total)}</div>
        <div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="release" data-id="${x.id}">Release payment</button>${x.status === 'review' ? `<button class="btn sm" data-act="dispute" data-id="${x.id}">Hold as disputed</button>` : `<button class="btn sm danger" data-act="refund" data-id="${x.id}">Refund customer</button>`}</div></div>`).join('') || '<p class="muted small">Nothing waiting.</p>'}</div>
      <div class="card"><h3>Contractor vetting: ${esc(c.name)}</h3>${APN.VETTING.map(([k, n]) => { const st = c.vetting[k]; return `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span>${n}</span><span class="row">${pill(VST[st][0], VST[st][1])}${st === 'submitted' ? `<button class="btn sm primary" data-act="vet" data-k="${k}" data-v="verified">Verify</button><button class="btn sm danger" data-act="vet" data-k="${k}" data-v="rejected">Reject</button>` : ''}</span></div>`; }).join('')}</div>
      <div class="card"><h3>Measurements to verify</h3>${S.props.filter(x => !isV(x, 'building') || !isV(x, 'land')).map(x => `<form data-form="verify" data-id="${x.id}" style="padding:10px 0;border-top:1px solid var(--line)"><b>${esc(x.label)}</b><div class="small muted">${esc(x.address)} &middot; ${x.source === 'satellite' ? 'customer satellite trace' : 'estimate'}</div>
        <div class="row" style="margin-top:8px"><label class="grow">Building sq ft${isV(x, 'building') ? ' (automatic)' : ''}<input name="building" type="number" min="1" value="${x.building}" ${isV(x, 'building') ? 'readonly' : ''}></label><label class="grow">Land sq ft<input name="land" type="number" min="0" value="${x.land}"></label><button class="btn sm primary" style="align-self:flex-end">Verify</button></div></form>`).join('') || '<p class="muted small">Nothing waiting.</p>'}</div>
      <div class="card"><h3>Front-page banner</h3>${S.promos.map(p => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="grow">${pill(p.tag)} ${esc(p.text)}</span><button class="btn sm" data-act="rmPromo" data-id="${p.id}" aria-label="Remove">&times;</button></div>`).join('')}
        <form data-form="promo" class="row" style="margin-top:10px"><select name="tag" style="width:auto"><option>Promotion</option><option>News</option><option>Update</option></select><input class="grow" name="text" type="text" placeholder="Announcement text" aria-label="Announcement text"><button class="btn sm primary">Add</button></form></div>
      <div class="card"><h3>System status</h3>${svc.map(([n, s, ok]) => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${n}</span>${pill(s, ok ? 'ok' : 'warn')}</div>`).join('')}</div>
      </div></div>`;
  }
  const vW2 = () => `<div class="wrap dash"><div class="card lock" style="filter:grayscale(1)"><div class="eyebrow">${t('soon')}</div><h2>W-2 team dashboard</h2><p class="muted" style="max-width:56ch;margin:0 auto 1em">Hospital and clinical work will be staffed by our own W-2 teams on fixed shifts. This dashboard opens when the Hospital sector goes live.</p></div></div>`;

  /* ---------- render ---------- */
  function render() {
    let r = route();
    const need = { console: ['customer', 'ops'], contractor: ['contractor'], vetting: ['contractor', 'ops'], ops: ['ops'] }[r];
    if (need && !need.includes(role())) { if (r === 'ops' && role()) r = 'home'; else r = 'login'; }
    if (r === 'login' && S.user) r = { customer: 'console', contractor: cleared() ? 'contractor' : 'vetting', ops: 'ops' }[role()];
    renderPromo(); renderTop(); renderFoot();
    $('#view').innerHTML = PUBLIC_PAGES.includes(r) ? APN.pages[r]() : { home: vHome, login: vLogin, console: vConsole, contractor: vContractor, vetting: vVetting, ops: vOps, w2: vW2 }[r]();
    document.documentElement.lang = S.lang;
    APN.atmo.particles.sync();
    if (r === 'console' && ui.cTab === 'props' && ui.prop && ui.prop.measured && cfg.GOOGLE_MAPS_KEY) gmap.mount();
    ui.fresh = null;
    APN.track.after(S, ME, role());
    calAuto();
    APN.tips.apply();
  }

  /* ---------- property measurement ---------- */
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function estimate(p) {
    const h = hash(p.address.toLowerCase().trim()), a = (h % 1000) / 1000, b = ((h >>> 10) % 1000) / 1000;
    const com = p.type === 'Commercial';
    p.building = Math.round((com ? 6000 + a * 18000 : 1200 + a * 2200) / 10) * 10;
    p.land = Math.round((com ? 12000 + b * 40000 : 4000 + b * 9000) / 10) * 10;
    p.source = 'estimate'; p.measured = true;
  }
  /* Google Maps satellite tracing. Runs only when GOOGLE_MAPS_KEY is set. */
  const gmap = {
    loading: null, map: null, poly: {},
    load() {
      if (window.google && google.maps) return Promise.resolve();
      return this.loading || (this.loading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(cfg.GOOGLE_MAPS_KEY)}&libraries=geometry&v=weekly`; s.onload = ok; s.onerror = no; document.head.appendChild(s); }));
    },
    async locate(p) {
      await this.load();
      const res = await new google.maps.Geocoder().geocode({ address: p.address });
      if (!res.results.length) throw new Error('not found');
      p.center = res.results[0].geometry.location.toJSON(); p.address = res.results[0].formatted_address;
      p.paths = { building: [], land: [] }; p.source = 'satellite'; p.measured = true; p.trace = 'building'; p.auto = false;
      /* Ask Google for the building outline so the customer does not have to trace it. Falls back to manual tracing. */
      try {
        const r = await fetch('/api/outline?address=' + encodeURIComponent(p.address));
        const j = r.ok ? await r.json() : {}, geo = j.outline;
        if (geo) {
          const rings = geo.type === 'MultiPolygon' ? geo.coordinates.map(c => c[0]) : [geo.coordinates[0]];
          const area = ring => google.maps.geometry.spherical.computeArea(ring.map(([lng, lat]) => new google.maps.LatLng(lat, lng)));
          const ring = rings.sort((x, y) => area(y) - area(x))[0];
          if (ring && ring.length > 3) { p.paths.building = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng })); p.auto = true; p.trace = 'land'; }
        }
      } catch (e) { console.warn('Building outline lookup failed', e); }
    },
    mount() {
      const el = $('#gmap'), p = ui.prop; if (!el || !p.center || !window.google) return;
      this.map = new google.maps.Map(el, { center: p.center, zoom: 19, mapTypeId: 'satellite', tilt: 0, disableDefaultUI: true, zoomControl: true });
      const mk = (k, color) => {
        const path = new google.maps.MVCArray((p.paths[k] || []).map(x => new google.maps.LatLng(x.lat, x.lng)));
        const g = new google.maps.Polygon({ map: this.map, editable: !(k === 'building' && p.auto), clickable: false, strokeColor: color, fillColor: color, fillOpacity: 0.18, strokeWeight: 2 });
        g.setPath(path);
        ['insert_at', 'set_at', 'remove_at'].forEach(e => path.addListener(e, () => this.measure()));
        return g;
      };
      this.poly = { land: mk('land', '#ffe08a'), building: mk('building', '#6ec1ff') };
      this.map.addListener('click', e => { const k = p.trace || 'building'; if (k === 'building' && p.auto) return; this.poly[k].getPath().push(e.latLng); });
      if (p.paths.building.length > 2 || p.paths.land.length > 2) this.measure();
    },
    measure() {
      const p = ui.prop, M2 = 10.7639, area = k => google.maps.geometry.spherical.computeArea(this.poly[k].getPath()) * M2;
      p.paths = { building: this.poly.building.getPath().getArray().map(x => x.toJSON()), land: this.poly.land.getPath().getArray().map(x => x.toJSON()) };
      const b = area('building'), l = area('land');
      if (b > 0) p.building = Math.round(b); if (l > 0) p.land = Math.max(0, Math.round(l - b));
      const ib = $('#p-b'), il = $('#p-l'); if (ib) ib.value = p.building; if (il) il.value = p.land;
    }
  };

  APN.loadMaps = () => gmap.load();

  /* ---------- actions ---------- */
  const ticket = id => S.tickets.find(x => x.id === id);
  async function receipt(tk) {
    const iso = new Date().toISOString(), line = `${APN.sector(tk.sector).name}, ${tierName(tk)}, ${tk.address}`;
    let h = hash(tk.id + iso + tk.total).toString(16);
    try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ id: tk.id, iso, total: tk.total, line }))); h = [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { /* fallback hash kept */ }
    S.receipts.push({ id: APN.uid('RC'), ticket: tk.id, iso, line, total: tk.total, hash: h, mine: !!tk.mine });
  }
  const act = {
    promoNext() { ui.promo++; renderPromo(); }, promoOff() { ui.promoOff = true; renderPromo(); },
    signout() { S.user = null; save(); go('home'); },
    reset() { APN.store.reset(); S = APN.store.s; toast('Demo data reset'); go('home'); },
    atmo(d) { const k = d.k, o = APN.atmo.s.override || { phase: APN.atmo.s.phase, cond: 'clear' };
      APN.atmo.setOverride(k === 'auto' ? null : ['rain', 'snow'].includes(k) ? { phase: o.phase, cond: o.cond === k ? 'clear' : k } : { phase: k, cond: o.cond }); renderFoot(); },
    startQuote() { ui.cTab = S.props.length ? 'order' : 'props'; }, joinContractor() { ui.loginRole = 'contractor'; ui.loginTab = 'up'; },
    loginTab(d) { ui.loginTab = d.k; render(); }, loginRole(d) { ui.loginRole = d.k; render(); },
    cTab(d) { ui.cTab = d.k; render(); }, kTab(d) { ui.kTab = d.k; ui.job = null; render(); },
    newProp() { ui.cTab = 'props'; ui.prop = { label: '', address: '', type: 'Residential', building: 0, land: 0, measured: false }; render(); },
    cancelProp() { ui.prop = null; render(); },
    async measure() {
      const p = ui.prop; if (p.address.trim().length < 6) return toast('Enter the full property address first');
      if (cfg.GOOGLE_MAPS_KEY) { try { await gmap.locate(p); toast(p.auto ? 'Building outline found. Now click the corners of the lot.' : 'Click the corners of the building, then switch to the lot'); } catch (e) { estimate(p); toast('Satellite lookup failed, showing an estimate'); } } else estimate(p);
      render();
    },
    trace(d) { ui.prop.trace = d.k; render(); }, traceClear() { const k = ui.prop.trace || 'building'; if (k === 'building' && ui.prop.auto) return toast('The building outline is set automatically and cannot be changed'); const g = gmap.poly[k]; if (g) g.getPath().clear(); gmap.measure(); },
    saveProp() { const p = ui.prop; if (!(p.building > 0)) return toast('Building footprint must be above zero');
      S.props.push({ id: APN.uid('P'), label: p.label.trim() || p.address.split(',')[0], address: p.address.trim(), type: p.type, building: +p.building, land: +p.land || 0, source: p.source, verified: { building: !!p.auto, land: false } }); ui.prop = null; save(); toast(p.auto ? 'Property saved. Lot size is pending verification.' : 'Property saved. Measurements are pending verification.'); render(); },
    bulkOpen() { ui.bulk = ui.bulk === null ? '' : ui.bulk; ui.cTab = 'props'; render(); }, bulkClose() { ui.bulk = null; render(); },
    bulkAdd() {
      const have = new Set(S.props.map(x => x.address.toLowerCase().trim()));
      const lines = [...new Set(String(ui.bulk || '').split(/\r?\n/).map(x => x.trim()).filter(x => x.length >= 6))].filter(x => !have.has(x.toLowerCase())).slice(0, 500);
      if (!lines.length) return toast('Paste at least one new address, one per line');
      lines.forEach(a => { const p = { address: a, type: ui.bulkType }; estimate(p); S.props.push({ id: APN.uid('P'), label: a.split(',')[0], address: a, type: p.type, building: p.building, land: p.land, source: 'estimate', verified: { building: false, land: false } }); });
      ui.bulk = null; save(); toast(`${lines.length} propert${lines.length === 1 ? 'y' : 'ies'} added. Measurements are pending verification.`); render();
    },
    calOpen(d) { const p = S.props.find(x => x.id === d.id); if (!p) return; p.cal = p.cal || { url: '', on: false, confirm: false, tier: 0, services: [], seen: {}, pending: [] }; ui.cal = p.id; ui.cTab = 'props'; render(); },
    calClose() { ui.cal = null; render(); },
    calSave() { const p = calProp(); if (!p) return; save(); if (!p.cal.url) { toast('Paste your calendar link first'); return; } calSync(p, true); },
    calApprove(d) { const p = calProp(); if (!p) return; const e = p.cal.pending[+d.i]; if (!e) return; if (!isV(p, 'building')) return toast('This property is still awaiting measurement verification'); if (calOrder(p, e)) { p.cal.pending.splice(+d.i, 1); save(); toast('Cleaning ordered. Funds are held in escrow.'); render(); } },
    calSkip(d) { const p = calProp(); if (!p) return; p.cal.pending.splice(+d.i, 1); save(); render(); },
    delProp(d) { S.props = S.props.filter(p => p.id !== d.id); S.cart = S.cart.filter(c => c.propId !== d.id); save(); render(); },
    orderFor(d) { ui.order.propId = d.id; ui.cTab = 'order'; render(); },
    oSector(d) { Object.assign(ui.order, { sector: d.k, services: [], immediate: false }); render(); }, oFreq(d) { ui.order.freq = d.k; render(); },
    addCart() { const pr = S.props.find(x => x.id === ui.order.propId); if (!pr || !isV(pr, APN.sector(ui.order.sector).basis)) return; S.cart.push(JSON.parse(JSON.stringify(ui.order))); ui.order.services = []; save(); toast('Added to cart'); render(); },
    rmCart(d) { S.cart.splice(+d.i, 1); save(); render(); },
    checkout() {
      for (const c of S.cart) { const q = APN.quote(c, S), p = S.props.find(x => x.id === c.propId); if (!q) continue;
        S.tickets.push({ id: APN.uid('DT'), sector: c.sector, tier: c.tier, services: c.services, freq: c.freq, address: p.address, propId: p.id, area: q.area, service: q.service, total: q.total, immediate: c.immediate, afterHours: c.afterHours, window: c.immediate ? 'Immediate' : c.afterHours ? 'After hours' : 'Next available', status: 'open', escrow: 'held', photos: {}, created: Date.now(), mine: true }); }
      S.cart = []; save(); ui.cTab = 'orders'; toast('Order placed. Funds are held in escrow.'); render();
    },
    claim(d) { const x = ticket(d.id); if (!x || x.status !== 'open' || !canClaim(x)) return; Object.assign(x, { status: 'claimed', escrow: 'transit', claimedBy: ME }); save(); ui.kTab = 'mine'; ui.job = x.id; toast('Ticket claimed'); go('contractor'); },
    openJob(d) { ui.job = d.id; render(); }, closeJob() { ui.job = null; render(); },
    enroute(d) { const x = ticket(d.id); if (!x || !ACTIVE_JOB.includes(x.status)) return; Object.assign(x, { enroute: true, enrouteAt: Date.now(), tkey: x.tkey || APN.track.tkey() }); save(); window.open(APN.directionsUrl(x.address), '_blank', 'noopener'); render(); },
    stopShare(d) { const x = ticket(d.id); if (!x) return; x.enroute = false; save(); APN.track.stop(x); toast('Location sharing stopped'); render(); },
    onsite(d) { ticket(d.id).status = 'onsite'; save(); render(); },
    submitJob(d) { const x = ticket(d.id); if (Object.keys(x.photos).length < 10) return; x.status = 'review'; x.enroute = false; save(); APN.track.stop(x); toast('Submitted for review'); render(); },
    dispute(d) { const x = ticket(d.id); x.status = 'disputed'; x.escrow = 'disputed'; x.enroute = false; save(); APN.track.stop(x); toast('Marked as disputed. Funds stay held.'); render(); },
    async release(d) { const x = ticket(d.id); x.status = 'released'; x.escrow = 'released'; x.enroute = false; await receipt(x); save(); APN.track.stop(x); toast('Payment released and receipt issued'); render(); },
    refund(d) { const x = ticket(d.id); x.status = 'refunded'; x.escrow = 'refunded'; x.enroute = false; save(); APN.track.stop(x); toast('Customer refunded'); render(); },
    vet(d) { S.contractor.vetting[d.k] = d.v; save(); render(); },
    rmPromo(d) { S.promos = S.promos.filter(p => p.id !== d.id); save(); render(); }
  };
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const f = act[el.dataset.act]; if (!f) return; if (el.tagName === 'A' && el.getAttribute('href') === '#home' && el.dataset.act === 'reset') e.preventDefault(); f(el.dataset, el); });
  document.addEventListener('change', e => {
    const el = e.target, d = el.dataset;
    if (d.bind) { S[d.bind] = el.value; save(); render(); }
    else if (d.order) { ui.order[d.order] = el.value; render(); }
    else if (d.svc) { const a = ui.order.services, i = a.indexOf(d.svc); if (i < 0) a.push(d.svc); else a.splice(i, 1); render(); }
    else if (d.tier) { ui.order.tier = +d.tier; render(); }
    else if (d.flag) { ui.order[d.flag] = el.checked; render(); }
    else if (d.prop) { ui.prop[d.prop] = el.type === 'number' ? Math.max(0, +el.value || 0) : el.value; if (d.prop === 'building' || d.prop === 'land' || d.prop === 'type') render(); }
    else if (d.photo && el.files[0]) { const x = ticket(ui.job); if (!x) return; (ui.photoURL[x.id] = ui.photoURL[x.id] || {})[d.photo] = URL.createObjectURL(el.files[0]); x.photos[d.photo] = true; save(); render(); }
    else if (d.vet && el.files[0]) { S.contractor.vetting[d.vet] = 'submitted'; save(); toast('Document received, now in review'); render(); }
  });
  document.addEventListener('input', e => { if (e.target.hasAttribute('data-bulk')) ui.bulk = e.target.value; });
  document.addEventListener('change', e => { if (e.target.hasAttribute('data-bulk-type')) ui.bulkType = e.target.value; });
  document.addEventListener('input', e => { const el = e.target, p = calProp(); if (p && el.dataset.cal === 'url') p.cal.url = el.value.trim(); });
  document.addEventListener('change', e => {
    const el = e.target, p = calProp(); if (!p) return;
    if (el.dataset.cal === 'tier') p.cal.tier = +el.value; else if (el.dataset.cal === 'confirm') p.cal.confirm = el.value === '1'; else if (el.dataset.cal === 'on') p.cal.on = el.checked;
    else if (el.dataset.calSvc) { const set = new Set(p.cal.services || []); el.checked ? set.add(el.dataset.calSvc) : set.delete(el.dataset.calSvc); p.cal.services = [...set]; } else return;
    save(); render();
  });
  document.addEventListener('input', e => { const d = e.target.dataset; if (d.prop && e.target.type === 'text') ui.prop[d.prop] = e.target.value; });
  document.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, v = Object.fromEntries(new FormData(f));
    if (f.dataset.form === 'login') {
      const err = m => { $('#login-err').textContent = m; };
      if (!/^\S+@\S+\.\S+$/.test(v.email || '')) return err('Enter a valid email address.');
      if (!v.pw || v.pw.length < 8) return err('Password must be at least 8 characters.');
      if (ui.loginTab === 'up') { if (!(v.name || '').trim()) return err('Enter your name.'); if (!/^\+[1-9]\d{6,14}$/.test((v.phone || '').replace(/[\s()-]/g, ''))) return err('Enter the phone number in international format, for example +16145550123.'); if (v.pw !== v.pw2) return err('The two passwords do not match.'); }
      const name = (v.name || '').trim() || v.email.split('@')[0];
      S.user = { name, email: v.email, role: ui.loginRole }; if (ui.loginRole === 'contractor') S.contractor.name = name; save();
      go({ customer: 'console', contractor: cleared() ? 'contractor' : 'vetting', ops: 'ops' }[ui.loginRole]);
    }
    if (f.dataset.form === 'verify') { const x = S.props.find(q => q.id === f.dataset.id); if (x) { x.building = Math.max(1, +v.building || x.building); x.land = Math.max(0, +v.land || 0); x.verified = { building: true, land: true }; save(); toast('Measurements verified'); render(); } }
    if (f.dataset.form === 'promo' && (v.text || '').trim()) { S.promos.push({ id: APN.uid('N'), tag: v.tag, text: v.text.trim() }); save(); render(); }
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* demo feed: new dispatch tickets arrive while a board is open */
  const FEED = [['str', 0, '1210 Summit St, Columbus, OH', 1600], ['res', 1, '48 Elm Grove, Bexley, OH', 2400], ['land', 0, '700 Polaris Pkwy, Columbus, OH', 9800], ['com', 1, '95 Front St, Columbus, OH', 5200], ['wash', 1, '33 Hayden Run, Dublin, OH', 1900], ['gutter', 0, '82 Cherry Bottom Rd, Gahanna, OH', 2100]];
  let feedI = 0;
  setInterval(() => {
    if (!cfg.DEMO_MODE || document.hidden || !['vetting', 'contractor'].includes(route()) || ui.job) return;
    if (S.tickets.filter(x => x.status === 'open').length >= 9) return;
    const active = document.activeElement; if (active && ['INPUT', 'SELECT'].includes(active.tagName)) return;
    const [sector, tier, address, area] = FEED[feedI++ % FEED.length], service = +(area * APN.RATES[tier]).toFixed(2), s = APN.sector(sector);
    const tk = { id: APN.uid('DT'), sector, tier, address, area, service, total: service, services: s.services.slice(0, 2).map(x => x[0]), freq: 'One-time', window: 'Next available', status: 'open', escrow: 'held', photos: {}, created: Date.now(), demo: true };
    S.tickets.push(tk); save(); ui.fresh = tk.id; render();
  }, 20000);

  APN.atmo.listeners.push(() => document.querySelectorAll('.atmo-chips').forEach(el => { el.innerHTML = chips(); }));
  APN.atmo.init();
  render();
  window.APN_DEBUG = { ui, render, state: () => S };
})();
