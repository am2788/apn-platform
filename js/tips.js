/* Aether Property Networks: plain-language help.
   Every dashboard tab has a one-line description, and buttons, statuses and headings explain themselves on hover or keyboard focus. */
(function () {
  const APN = window.APN;

  APN.tabHelp = {
    cTab: {
      overview: 'Your orders, properties and spending at a glance.',
      props: 'Add every property you own or manage, as many as you like. We measure each building and its land from satellite and property records. Reach 5 properties for 7% off and 10 for 15% off.',
      order: 'Choose a property, a sector, the services and a tier. The price is the measured area times the tier rate, and you see it before you pay.',
      orders: 'Follow each job, see where your escrowed payment stands, and find your receipts once funds are released.'
    },
    kTab: {
      overview: 'Open tickets, your active jobs and your current revenue split.',
      queue: 'Live dispatch tickets you can claim. Claiming opens once your vetting is complete.',
      mine: 'Jobs you have claimed: get directions, take the ten verification photos and submit for review.',
      earn: 'Your revenue split, progress toward the next level, and payouts.'
    }
  };

  const ACT = {
    startQuote: 'Get a price for any address in about a minute.', joinContractor: 'Create a contractor account. You complete vetting once, then claim jobs.',
    newProp: 'Add a property so we can measure it and price your work.', bulkOpen: 'Paste many addresses at once. Each is added and sent for measurement.',
    measure: 'Look up the building and land size from satellite imagery and property records.', saveProp: 'Save this property to your account.',
    orderFor: 'Start an order for this property.', delProp: 'Remove this property and any cart items for it.',
    addCart: 'Add this service to your cart. Nothing is charged yet.', rmCart: 'Remove this item from your cart.',
    checkout: 'Funds are held in escrow. They are not paid to the contractor until the job is verified.',
    claim: 'Take this job. Only fully vetted contractors can claim.', openJob: 'Open this job to see photos, directions and status.',
    onsite: 'Tell the customer you have arrived.', submitJob: 'Send your ten photos for review. Location sharing stops when you submit.',
    enroute: 'Opens Google Maps directions and shares your live position with the customer until you submit the job.',
    stopShare: 'Stop sharing your location with the customer.', dispute: 'Flag a problem. Payment stays on hold while we review.',
    release: 'Pay the contractor now and issue the receipt.', refund: 'Return the held funds to the customer.',
    calOpen: 'Order a cleaning automatically at every checkout, from your booking calendar link.', calSave: 'Save these settings and check your calendar now.',
    calApprove: 'Order this cleaning now.', calSkip: 'Do not order a cleaning for this stay.',
    trace: 'Choose whether you are outlining the building or the lot.', traceClear: 'Start the outline over.',
    promoNext: 'Next announcement.', promoOff: 'Hide announcements.', signout: 'Sign out of this device.', previewAs: 'Open this dashboard with sample data. Demo mode only.',
    vet: 'Record the result of this vetting check.', rmPromo: 'Remove this announcement.',
    atmo: 'Preview how the site looks at another time of day or in other weather.', reset: 'Erase the demo data stored in this browser.'
  };
  const NAV = { home: 'The front page.', faq: 'Short answers about pricing, measurement, escrow and getting paid.', contact: 'How to reach support.', console: 'Your properties, orders and receipts.', contractor: 'Your jobs and earnings.', vetting: 'Your vetting checklist and live dispatch tickets.', ops: 'Escrow, vetting, measurements and system status.', login: 'Sign in or create an account.' };
  const PILL = [
    [/^Funds held$/, 'Your payment is held in escrow and has not been paid out.'], [/^In transit$/, 'A contractor has claimed the job. Funds are still held.'],
    [/^Disputed$/, 'A problem was raised. Funds stay on hold during review.'], [/^Released$/, 'Payment has been released to the contractor.'], [/^Refunded$/, 'The funds were returned to the customer.'],
    [/^Awaiting contractor$/, 'Posted and waiting for a vetted contractor to claim it.'], [/^Claimed$/, 'A contractor has taken this job.'], [/^On site$/, 'The contractor has arrived.'],
    [/^Photo review$/, 'Photos are in. Our team reviews them before payment is released.'], [/^Completed$/, 'Job finished and paid.'],
[/^After-hours$/, 'Evenings, nights or weekends. The full after-hours fee goes to the contractor.'],
    [/^Same-day turnover$/, 'A new guest checks in the day this stay ends, so the clean needs to finish in time.'],
    [/ verified$/, 'Our team confirmed this measurement.'], [/ pending$/, 'Our team is confirming this measurement. Ordering opens once it is verified.'],
    [/^Not cleared$/, 'Finish vetting to start claiming jobs.'], [/^Cleared$/, 'All required vetting checks are verified.'], [/^Paid$/, 'This payout has been released.'], [/^Pending review$/, 'Payout releases after photo review.']
  ];
  const HEAD = {
    'Your properties': 'Every property on your account. There is no limit.', 'Add a property': 'Enter an address and we measure the building and land.',
    'Orders': 'Your jobs and where each payment stands.', 'Receipts': 'Proof of each completed job and payment.', 'Cart': 'Items waiting to be ordered.', 'Quote': 'Measured area times the tier rate, plus any fees.',
    'Escrow queue': 'Jobs with funds on hold, waiting for release, dispute or refund.', 'Measurements to verify': 'Properties whose size needs a human check before they can be ordered.',
    'Front-page banner': 'Announcements shown at the top of the site.', 'System status': 'Whether each connected service is working.', 'Vetting checklist': 'The checks required before you can claim jobs.',
    'Revenue split': 'The share of each job you keep. It rises with five-star reviews.', 'Payouts': 'Money from completed jobs.', 'Newest tickets': 'The latest open jobs.',
    'Open dispatch tickets': 'Jobs waiting for a contractor to claim them.', 'Services': 'What is included at each tier.'
  };
  const KPI = { 'Properties': 'Properties on your account.', 'Open orders': 'Orders still in progress.', 'Awaiting photo review': 'Jobs submitted and being reviewed.', 'Open tickets nearby': 'Unclaimed jobs you could take.', 'Active jobs': 'Jobs you have claimed and not yet submitted.', 'Current split': 'Your share of each service total.', 'Released to you': 'Total paid out to you so far.' };

  const set = (el, text) => { if (text && !el.hasAttribute('data-tip') && !el.getAttribute('title')) { el.setAttribute('data-tip', text); } };
  function apply() {
    document.querySelectorAll('.tabs button').forEach(b => { const a = b.dataset.act, k = b.dataset.k; set(b, APN.tabHelp[a] && APN.tabHelp[a][k]); });
    document.querySelectorAll('nav.main a').forEach(a => set(a, NAV[a.getAttribute('href').replace('#', '')]));
    document.querySelectorAll('[data-act]').forEach(el => { if (!el.closest('.tabs')) set(el, ACT[el.dataset.act]); });
    document.querySelectorAll('.pill').forEach(p => { const t = p.textContent.trim(), m = PILL.find(([re]) => re.test(t)); if (m) set(p, m[1]); });
    document.querySelectorAll('h3,h4').forEach(h => { const t = (HEAD[h.textContent.trim()] || ''); if (t) { set(h, t); h.classList.add('hint'); } });
    document.querySelectorAll('.kpi span').forEach(s => set(s.parentNode, KPI[s.textContent.trim()]));
    document.querySelectorAll('select[data-bind=lang]').forEach(s => set(s, 'Language'));
    document.querySelectorAll('select[data-bind=cur]').forEach(s => set(s, 'Currency used to display prices. Charges are in US dollars.'));
    document.querySelectorAll('.photo').forEach(p => set(p, 'Take this photo at the job site. All ten are required before you can submit.'));
  }

  /* one floating tooltip, shown on hover and on keyboard focus */
  let tip = null, cur = null;
  function show(el) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    cur = el; tip.textContent = el.getAttribute('data-tip'); tip.style.display = 'block';
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8), y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hide = () => { if (tip) tip.style.display = 'none'; cur = null; };
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && el !== cur) show(el); else if (!el) hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', hide); document.addEventListener('click', hide); document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

  APN.tips = { apply };
})();
