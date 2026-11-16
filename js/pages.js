/* Aether Property Networks: public information pages (FAQ, contact, privacy, terms). */
(function () {
  const APN = window.APN;
  const SUPPORT = 'support@supportaether.com';
  const money = v => APN.money(v, (APN.store.load().cur) || 'USD');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mail = `<a href="mailto:${SUPPORT}">${SUPPORT}</a>`;
  const P = APN.PAYOUT, F = APN.FEES;

  const FAQ = [
    ['Customers', [
      ['How is my price calculated?', () => `Price is the measured area times the tier rate. Every sector uses the same three rates: ${APN.RATES.map(r => money(r)).join(', ')} per square foot. You see the total before you commit.`],
      ['How do you measure my property?', () => `We look up the address and measure it automatically from property records and satellite footprints, separating the building from the land. Interior work is priced on the building and grounds work on the land. You cannot edit these figures, so a quote always matches what the crew will find. If our sources disagree, the property is held for a manual check before it is priced.`],
      ['Why can\'t I type in my own square footage?', () => `Measured areas are locked so that customers and contractors both see the same numbers. If you believe a measurement is wrong, email ${mail} and we will review it.`],
      ['What does escrow mean?', () => `When you place an order your payment is held, not paid out. It is released to the contractor only after ten verification photos confirm the work. If something is wrong you can dispute the job and the funds stay on hold while it is reviewed.`],
      ['What are the ten photos?', () => `Five checkpoints on the property, each photographed before and after the work. The record is attached to your ticket.`],
      ['What do the tiers mean?', () => `Each sector has three tiers with their own names and scope, from routine upkeep to full restoration. The tier names differ by sector but the rates are the same.`],
      ['Are there fees on top of the price?', () => `After-hours dispatch adds ${money(F.afterHours)}. Immediate pest response adds ${money(F.pestImmediate)}. Both are shown before you pay.`],
      ['Do you offer discounts?', () => `Yes. Ordering from more than one sector on the same property earns a bundle discount, and larger portfolios earn a volume discount. Both are applied automatically at checkout.`],
      ['Where do you operate?', () => `We are launching in Kentucky and adding areas as vetted field partners join. Email ${mail} to ask about your area.`],
      ['What is the Hospital sector?', () => `Hospital and clinical environments are coming soon. They will be staffed by our own W-2 teams on fixed shifts rather than independent contractors.`]
    ]],
    ['Contractors', [
      ['How do I get started?', () => `Create a contractor account and complete vetting once: an ISSA CIMS exam, a liability bond and a background check. After all three are verified you can claim live dispatch tickets in your area.`],
      ['How am I paid?', () => `You start at ${P.base}% of the service total and rise ${P.step}% for every ${P.every} five-star reviews, up to ${P.cap}%. After the cap there is a ${money(P.bonus)} bonus for each further ${P.every} five-star reviews. Every job also pays a ${money(F.transit)} transit stipend.`],
      ['Will I know what I am walking into?', () => `Yes. The building and land areas on your ticket are the same measured figures the customer was quoted, so crew size and pay are based on real numbers. If a property clearly does not match its listing, flag it from the job and we will review it.`],
      ['When does my money arrive?', () => `Escrow releases once your ten photos are submitted and reviewed. A complete photo record is the fastest way to get paid.`],
      ['Am I an employee?', () => `No. Field partners are independent 1099 contractors. Hospital work, when it opens, will use separate W-2 teams.`]
    ]]
  ];

  const q = (a, b) => `<details class="faq"><summary>${esc(a)}</summary><p class="muted" style="margin:10px 0 2px">${b()}</p></details>`;
  const head = (eyebrow, title, lead) => `<section class="band"><div class="wrap" style="max-width:860px"><div class="eyebrow">${eyebrow}</div><h1 style="font-size:clamp(26px,3.6vw,38px)">${title}</h1>${lead ? `<p class="muted">${lead}</p>` : ''}`;

  APN.pages = {
    faq: () => head('FAQ', 'Frequently asked questions', `Short answers about pricing, measurement, escrow and getting paid. Anything missing? Write to ${mail}.`)
      + FAQ.map(([g, items]) => `<h2 style="margin-top:28px">${g}</h2>${items.map(([a, b]) => q(a, b)).join('')}`).join('')
      + `</div></section>`,

    contact: () => head('Contact', 'Talk to a person', 'We answer every message. Include the address or ticket number if your question is about a specific job.')
      + `<div class="grid g2"><div class="card"><h3>Support</h3><p class="small muted">Orders, tickets, measurements, billing and disputes.</p><p style="margin:0"><a class="btn primary" href="mailto:${SUPPORT}">${SUPPORT}</a></p></div>
        <div class="card"><h3>Company</h3><p class="small muted" style="margin:0">Aether Property Networks, a division of Environmental Wellness Lab Groups Inc.</p></div></div>
        <p class="small muted" style="margin-top:20px">Common questions are answered in the <a href="#faq">FAQ</a>.</p></div></section>`,

    privacy: () => head('Legal', 'Privacy policy', 'Last updated November 2026.')
      + `<div class="card legal"><h3>What we collect</h3><p class="small">Account details you give us (name, email, mobile number), the property addresses you enter, measurement data we look up for those addresses, order and payment records, and the photos contractors upload to verify a job. Contractors also provide vetting documents.</p>
        <h3>How we use it</h3><p class="small">To price and dispatch work, hold and release escrow, verify completed jobs, send dispatch and service messages, prevent fraud and meet legal obligations. We do not sell your personal information.</p>
        <h3>Who sees it</h3><p class="small">Contractors see the job address, measured areas and scope for tickets they claim. Service providers that run our hosting, maps, messaging and payments process data for us under their own terms. We may disclose information when the law requires it.</p>
        <h3>Your choices</h3><p class="small">You can ask to access, correct or delete your information by writing to ${mail}. We keep records as long as needed to operate the service and meet legal requirements.</p>
        <h3>Contact</h3><p class="small" style="margin:0">${mail}</p></div></div></section>`,

    terms: () => head('Legal', 'Terms of service', 'Last updated November 2026.')
      + `<div class="card legal"><h3>The service</h3><p class="small">Aether Property Networks connects property owners with independent, vetted field partners. Prices are the measured area times the published tier rate, plus any fees shown before checkout.</p>
        <h3>Escrow and disputes</h3><p class="small">Payment is held when an order is placed and released after the ten-photo verification record is complete and reviewed. Either party may dispute a job; funds remain on hold during review, and we decide the outcome based on the photo record and the ticket history.</p>
        <h3>Measurements</h3><p class="small">Areas come from third-party property records and satellite footprints and are locked for quoting. We may correct a measurement after review, and the price follows the corrected figure.</p>
        <h3>Contractors</h3><p class="small">Field partners are independent contractors, responsible for their own taxes, tools and conduct on site, and must complete vetting before claiming work.</p>
        <h3>Acceptable use</h3><p class="small">Do not misstate a property, interfere with the measurement process, or use the service for anything unlawful. We may suspend accounts that do.</p>
        <h3>Contact</h3><p class="small" style="margin:0">${mail}</p></div></div></section>`
  };
})();
