/* Catalog, pricing rules and the data store. */
(function () {
  const APN = (window.APN = {});
  APN.cfg = window.APN_CONFIG || {};

  /* One price structure on every sector. */
  APN.RATES = [0.10, 0.45, 1.20];
  APN.FEES = { pestImmediate: 350, afterHours: 100, transit: 25 };
  APN.BUNDLE_OFF = [0.05, 0.10, 0.20];           // 2+ sectors on one property
  APN.PORTFOLIO = [{ min: 10, pct: 0.15 }, { min: 5, pct: 0.07 }];   // percent off the rate by number of properties on the account
  APN.RES_GUARD = { over: 15000, anchor: 2200 };  // residential single-property safeguard
  APN.PAYOUT = { base: 60, step: 2, every: 25, cap: 64, bonus: 250 };
  APN.FREQ = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Daily'];

  APN.SECTORS = [
    { id: 'str', name: 'STR Turnover & Restock', short: 'Turnover', img: 'str.jpg', basis: 'building',
      blurb: 'Guest-ready resets for short-term rentals, dispatched between check-out and check-in.',
      tiers: [
        ['Guest-Ready Reset', 'Standard turnover: surfaces, linens, kitchen and bath reset.'],
        ['Full Turnover Deep Clean', 'Deep sanitation after every stay, appliances and upholstery included.'],
        ['Owner-Grade Restoration', 'Top-to-bottom restoration for peak season, owner stays and listing photos.']],
      services: [
        ['Express turnover reset', 'Rapid reset between same-day check-out and check-in.'],
        ['Peak-season turnover protocol', 'High-volume rotation with scheduling tied to your booking calendar.'],
        ['Pre-arrival guest staging', 'Staging and amenity placement before arrival.'],
        ['Post-checkout sanitation', 'High-touch sanitation after every departure.'],
        ['Linen, towel and amenity replenishment', 'Count, replace and report guest-facing consumables.'],
        ['Smart lock re-code', 'Credential rotation and entry check after each stay.'],
        ['Condition photo documentation', 'Photo record of property condition for review disputes.']] },
    { id: 'land', name: 'Commercial Landscaping', short: 'Landscaping', img: 'land.jpg', basis: 'land',
      blurb: 'Grounds care priced on the land itself, measured separately from the building.',
      tiers: [
        ['Grounds Upkeep', 'Mowing, edging, weed control and debris sweeps.'],
        ['Seasonal Grounds Care', 'Aeration, pruning, leaf removal and fertilization.'],
        ['Complete Grounds Restoration', 'Full renovation of neglected grounds and storm clean-up.']],
      services: [
        ['Turf mowing', 'Scheduled mowing with clipping removal.'],
        ['Boundary edging', 'Edging along walks, drives and beds.'],
        ['Autumn leaf removal', 'High-capacity collection and haul-away.'],
        ['Core aeration and fertilization', 'Soil aeration with seasonal feeding.'],
        ['Shrub and hedge pruning', 'Seasonal shaping and health pruning.'],
        ['Mulch bed refresh', 'Bed edging and mulch top-up.'],
        ['Snow and ice clearance', 'Plowing, shoveling and de-icing for drives and walks.']] },
    { id: 'res', name: 'Residential Deep Care', short: 'Residential', img: 'res.jpg', basis: 'building',
      blurb: 'Recurring and deep home care for single homes and managed residences.',
      tiers: [
        ['Essential Home Care', 'Recurring clean on a standard checklist.'],
        ['Enhanced Home Deep Clean', 'Deep clean with windows, floors and detail work.'],
        ['Whole-Home Restoration', 'Full restoration: carpets, hard floors and exterior wash.']],
      services: [
        ['Whole-home clean', 'Every room, standard or deep per tier.'],
        ['Exterior window cleaning', 'Ground-reach exterior glass.'],
        ['Pressure washing', 'Siding, walks, patios and drives.'],
        ['Gutter clearing', 'Debris removal and downspout flush.'],
        ['Carpet steam extraction', 'Hot-water extraction and spot treatment.'],
        ['Hard floor care', 'Scrub, buff and polish.'],
        ['Pet waste removal', 'Scheduled yard pickup and sanitizing.'],
        ['Move-in / move-out clean', 'Deposit-ready clean with photo record.']] },
    { id: 'com', name: 'Commercial Sanitation', short: 'Commercial', img: 'com.jpg', basis: 'building',
      blurb: 'Janitorial programs for offices, retail and multi-tenant buildings.',
      tiers: [
        ['Janitorial Standard', 'Nightly or weekly janitorial on a fixed scope.'],
        ['Facility Deep Clean', 'Deep sanitation of restrooms, break rooms and floors.'],
        ['High-Compliance Sanitization', 'Documented disinfection for regulated and high-traffic sites.']],
      services: [
        ['Office and common-area janitorial', 'Trash, surfaces, floors and glass.'],
        ['Restroom sanitation', 'Fixtures, partitions and restock.'],
        ['Floor care program', 'Strip, wax, scrub and burnish.'],
        ['Interior glass and partitions', 'Streak-free interior glass.'],
        ['Break room and kitchen deep clean', 'Appliances, cabinets and drains.'],
        ['High-touch disinfection', 'Handles, rails, elevators and shared equipment.'],
        ['Post-construction clean', 'Dust-down and detail after build-out.']] },
    { id: 'pest', name: 'Immediate Pest Abatement', short: 'Pest', img: 'garden.jpg', basis: 'building',
      blurb: 'Scheduled prevention plus immediate dispatch for active safety threats.',
      tiers: [
        ['Perimeter Defense', 'Exterior barrier and larvicide for standard lots.'],
        ['Interior + Exterior Elimination', 'Combined treatment with rodent exclusion.'],
        ['Full-Property Eradication', 'Heat treatment, exclusion and follow-up for severe infestations.']],
      services: [
        ['Perimeter insect barrier', 'Foundation spray at entry points.'],
        ['Interior roach and ant elimination', 'Gel bait and residual treatment.'],
        ['Mosquito yard treatment', 'Misting and standing-water larvicide.'],
        ['Rodent exclusion and trapping', 'Entry sealing and station grid.'],
        ['Termite barrier treatment', 'Soil barrier and wood treatment.'],
        ['Bed bug heat treatment', 'Whole-room thermal remediation.'],
        ['Wildlife exclusion', 'Humane capture and sealing.'],
        ['Wasp and hornet nest removal', 'Nest extraction and deterrent.']] },
    { id: 'hosp', name: 'Hospital & Clinical Environments', short: 'Hospital', img: 'hosp.jpg', basis: 'building', soon: true,
      blurb: 'Terminal cleaning for hospitals and clinics, staffed by our own W-2 teams.',
      tiers: [
        ['Clinical Standard', 'Low-risk clinical zones.'],
        ['Terminal Clean', 'Patient rooms and high-traffic clinical areas.'],
        ['Surgical Sterile', 'Operating suites and cleanrooms.']],
      services: [] }
  ];
  APN.sector = id => APN.SECTORS.find(s => s.id === id);

  /* Ten-photo verification: five points, before and after. */
  APN.PHOTO_POINTS = ['Pre-site arrival', 'Structural / entry', 'Work area', 'Detail close-up', 'Post-site & lock-up'];
  APN.VETTING = [
    ['identity', 'Identity & W-9', 'Government ID and taxpayer form for 1099 payments.'],
    ['issa', 'ISSA CIMS exam', 'Verified exam result from ISSA.'],
    ['bond', 'Liability bond certificate', 'Active certificate naming your business.'],
    ['background', 'Background check', 'Consent and clear result from our screening provider.']];
  APN.GATE = ['issa', 'bond', 'background'];

  /* ---------- pricing ---------- */
  APN.portfolioPct = n => (APN.PORTFOLIO.find(p => n >= p.min) || { pct: 0 }).pct;
  APN.billableArea = (sec, prop) => {
    let a = sec.basis === 'land' ? prop.land : prop.building;
    let guarded = false;
    if (sec.id === 'res' && prop.type === 'Residential' && a > APN.RES_GUARD.over) { a = APN.RES_GUARD.anchor; guarded = true; }
    return { area: Math.max(0, Math.round(a)), guarded };
  };
  /* item: {propId, sector, tier, services[], freq, immediate, afterHours} */
  APN.quote = (item, st) => {
    const sec = APN.sector(item.sector), prop = st.props.find(p => p.id === item.propId);
    if (!sec || !prop) return null;
    const { area, guarded } = APN.billableArea(sec, prop);
    const sectorsOnProp = new Set(st.cart.filter(c => c.propId === item.propId).map(c => c.sector));
    sectorsOnProp.add(item.sector);
    const bundle = sectorsOnProp.size >= 2 ? APN.BUNDLE_OFF[item.tier] : 0;
    const portPct = APN.portfolioPct(st.props.length);
    const port = +((APN.RATES[item.tier] - bundle) * portPct).toFixed(4);
    const rate = Math.max(0.01, +(APN.RATES[item.tier] - bundle - port).toFixed(4));
    const service = +(area * rate).toFixed(2);
    const fees = (item.immediate ? APN.FEES.pestImmediate : 0) + (item.afterHours ? APN.FEES.afterHours : 0);
    return { area, guarded, base: APN.RATES[item.tier], bundle, port, portPct, rate, service, fees, total: +(service + fees).toFixed(2), basis: sec.basis };
  };
  APN.split = reviews => Math.min(APN.PAYOUT.cap, APN.PAYOUT.base + APN.PAYOUT.step * Math.floor(reviews / APN.PAYOUT.every));
  APN.payout = (t, reviews) => {
    const pct = APN.split(reviews);
    const share = +(t.service * pct / 100).toFixed(2);
    const extra = (t.afterHours ? APN.FEES.afterHours : 0) + APN.FEES.transit;
    return { pct, share, extra, total: +(share + extra).toFixed(2) };
  };

  /* ---------- currency & language ---------- */
  APN.CUR = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37 }; // placeholder rates until a live feed is wired
  APN.money = (usd, cur) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD' }).format(usd * (APN.CUR[cur || 'USD'] || 1));
  APN.I18N = {
    en: { home: 'Home', services: 'Services', vision: 'Vision', signin: 'Sign in', signout: 'Sign out', customer: 'Customer dashboard', contractor: 'Contractor dashboard', vetting: 'Vetting & dispatch', quote: 'Get an instant quote', join: 'Join as a contractor', soon: 'Coming soon' },
    es: { home: 'Inicio', services: 'Servicios', vision: 'Visión', signin: 'Iniciar sesión', signout: 'Cerrar sesión', customer: 'Panel de cliente', contractor: 'Panel de contratista', vetting: 'Verificación y despacho', quote: 'Cotización inmediata', join: 'Únete como contratista', soon: 'Próximamente' },
    fr: { home: 'Accueil', services: 'Services', vision: 'Vision', signin: 'Connexion', signout: 'Déconnexion', customer: 'Espace client', contractor: 'Espace prestataire', vetting: 'Vérification et missions', quote: 'Devis immédiat', join: 'Devenir prestataire', soon: 'Bientôt disponible' },
    de: { home: 'Start', services: 'Leistungen', vision: 'Vision', signin: 'Anmelden', signout: 'Abmelden', customer: 'Kunden-Dashboard', contractor: 'Auftragnehmer-Dashboard', vetting: 'Prüfung & Einsätze', quote: 'Sofortangebot', join: 'Als Auftragnehmer starten', soon: 'Demnächst' }
  };

  /* ---------- store (demo: this browser only; production: Xano) ---------- */
  const KEY = 'apn.v1';
  const uid = p => p + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  APN.uid = uid;
  const seed = () => {
    const now = Date.now(), h = 3600e3;
    const T = (o) => Object.assign({ id: uid('DT'), status: 'open', escrow: 'held', photos: {}, demo: true, created: now, freq: 'One-time', services: [] }, o);
    return {
      user: null, lang: 'en', cur: 'USD',
      props: [
        { id: 'P-1', label: 'Lakeview Rental', address: '418 Lakeview Ter, Columbus, OH', type: 'STR', building: 1850, land: 6400, source: 'estimate' },
        { id: 'P-2', label: 'Harper Office Park', address: '2200 Harper Rd, Dublin, OH', type: 'Commercial', building: 12400, land: 31000, source: 'estimate' }],
      cart: [],
      tickets: [
        T({ sector: 'str', tier: 0, address: '77 Canal St, Columbus, OH', area: 1400, service: 140, total: 140, window: 'Today 3:00 PM', created: now - 0.4 * h, services: ['Express turnover reset', 'Smart lock re-code'] }),
        T({ sector: 'land', tier: 1, address: '9 Orchard Ln, Westerville, OH', area: 5200, service: 2340, total: 2340, window: 'Tomorrow 8:00 AM', created: now - 1.2 * h, services: ['Core aeration and fertilization', 'Shrub and hedge pruning'] }),
        T({ sector: 'pest', tier: 1, address: '301 Mill Run, Hilliard, OH', area: 2100, service: 945, total: 1295, immediate: true, window: 'Immediate', created: now - 0.1 * h, services: ['Wildlife exclusion'] }),
        T({ sector: 'com', tier: 0, address: '2200 Harper Rd, Dublin, OH', area: 12400, service: 1240, total: 1340, afterHours: true, window: 'Tonight 9:00 PM', created: now - 3 * h, services: ['Office and common-area janitorial', 'Restroom sanitation'], propId: 'P-2', mine: true }),
        T({ sector: 'res', tier: 1, address: '56 Birch Ct, Gahanna, OH', area: 2300, service: 1035, total: 1035, window: 'Yesterday', created: now - 26 * h, status: 'review', claimedBy: 'Field Partner 204', services: ['Whole-home clean', 'Carpet steam extraction'], photos: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true])) })],
      contractor: { name: 'Field Partner', reviews: 31, vetting: { identity: 'verified', issa: 'missing', bond: 'missing', background: 'submitted' }, paid: 0 },
      promos: [
        { id: 'N-1', tag: 'Promotion', text: 'Bundle two sectors on one property and take up to $0.20 off per sq ft.' },
        { id: 'N-2', tag: 'News', text: 'Hospital & Clinical Environments is in preparation. W-2 team hiring opens first.' },
        { id: 'N-3', tag: 'Update', text: 'Satellite measurement now separates building footprint from land on every quote.' }],
      receipts: []
    };
  };
  APN.store = {
    s: null,
    load() { try { const raw = localStorage.getItem(KEY); this.s = raw ? JSON.parse(raw) : seed(); } catch (e) { this.s = seed(); } return this.s; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { /* storage unavailable: session only */ } },
    reset() { this.s = seed(); this.save(); }
  };
})();
