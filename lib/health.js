/* Connection checks. Each returns { id, name, state: ok|down|off, ms, detail, fix }.
   "off" means the service is not configured yet, which is not an alert. */
const store = require('./store');
const SITE = process.env.SITE_URL || 'https://www.aetherpropertynetworks.com';
const to = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const run = async (id, name, fix, fn, enabled = true) => {
  if (!enabled) return { id, name, state: 'off', ms: 0, detail: 'Not connected yet', fix };
  const t0 = Date.now();
  try { const d = await to(fn()); return { id, name, state: 'ok', ms: Date.now() - t0, detail: d || 'Responding', fix }; }
  catch (e) { return { id, name, state: 'down', ms: Date.now() - t0, detail: String(e.message || e).slice(0, 140), fix }; }
};
const env = (k) => !!process.env[k];

async function checkAll(opts = {}) {
  const cache = opts.cache || {}; const force = !!opts.force; const now = Date.now();
  const metered = async (id, name, fix, enabled, fn) => {
    const c = cache[id];
    if (!force && enabled && c && now - c.at < 55 * 60 * 1000) return Object.assign({}, c.r, { detail: c.r.detail + ' (checked ' + Math.round((now - c.at) / 60000) + ' min ago)' });
    const r = await run(id, name, fix, fn, enabled);
    if (enabled) cache[id] = { at: now, r };
    return r;
  };
  const list = await Promise.all([
    run('site', 'Website (www)', 'Check the Vercel deployment and that the domain still points at Vercel.', async () => {
      const r = await fetch(SITE + '/', { redirect: 'manual' }); if (r.status >= 400) throw new Error('HTTP ' + r.status); return 'HTTP ' + r.status;
    }),
    run('redis', 'Shared storage (Upstash Redis)', 'Vercel > Storage > add Upstash Redis and connect it to this project. Powers online users, applicants, alerts and live tracking.', async () => {
      const p = await store.cmd(['PING']); if (String(p).toUpperCase() !== 'PONG') throw new Error('bad reply'); return 'PONG';
    }, store.configured()),
    metered('google', 'Google Maps (server key)', 'Check GOOGLE_SERVER_KEY in Vercel and that Geocoding, Places and Directions are enabled with billing on.', env('GOOGLE_SERVER_KEY'), async () => {
      const r = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=Lexington+KY&key=' + encodeURIComponent(process.env.GOOGLE_SERVER_KEY));
      const j = await r.json(); if (j.status !== 'OK') throw new Error((j.status || 'HTTP ' + r.status) + (j.error_message ? ': ' + j.error_message : '')); return 'Geocoding OK';
    }),
    metered('regrid', 'Regrid (parcel sizes)', 'Check REGRID_TOKEN and that your plan covers the counties you serve.', env('REGRID_TOKEN'), async () => {
      const r = await fetch('https://app.regrid.com/api/v2/parcels/point?lat=38.0406&lon=-84.5037&limit=1&token=' + encodeURIComponent(process.env.REGRID_TOKEN));
      if (r.status === 401 || r.status === 403) throw new Error('Token rejected (HTTP ' + r.status + ')');
      if (r.status === 429) throw new Error('Rate limited');
      if (r.status >= 500) throw new Error('HTTP ' + r.status);
      return 'Token accepted (HTTP ' + r.status + ')';
    }),
    run('xano', 'Xano (accounts and data)', 'Set XANO_BASE_URL (and optionally XANO_HEALTH_PATH) to your Xano API group URL.', async () => {
      const u = process.env.XANO_BASE_URL.replace(/\/$/, '') + (process.env.XANO_HEALTH_PATH || '');
      const r = await fetch(u); if (r.status >= 500) throw new Error('HTTP ' + r.status); return 'HTTP ' + r.status;
    }, env('XANO_BASE_URL')),
    run('stripe', 'Stripe (payments)', 'Set STRIPE_SECRET_KEY in Vercel (test key first).', async () => {
      const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY } });
      if (!r.ok) throw new Error('HTTP ' + r.status); return /^sk_live/.test(process.env.STRIPE_SECRET_KEY) ? 'Live mode' : 'Test mode';
    }, env('STRIPE_SECRET_KEY')),
    run('gemini', 'Gemini (verification)', 'Set GEMINI_API_KEY in Vercel.', async () => {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=' + encodeURIComponent(process.env.GEMINI_API_KEY));
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'Key accepted';
    }, env('GEMINI_API_KEY')),
    run('brevo', 'Brevo (email sending)', 'Set BREVO_API_KEY in Vercel.', async () => {
      const r = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': process.env.BREVO_API_KEY } });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'Key accepted';
    }, env('BREVO_API_KEY')),
    run('twilio', 'Twilio (text messages)', 'Set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM and ALERT_SMS_TO in Vercel.', async () => {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}.json`, { headers: { Authorization: 'Basic ' + Buffer.from(process.env.TWILIO_SID + ':' + process.env.TWILIO_TOKEN).toString('base64') } });
      if (!r.ok) throw new Error('HTTP ' + r.status); return 'Account reachable';
    }, env('TWILIO_SID') && env('TWILIO_TOKEN'))
  ]);
  return { list, cache };
}
module.exports = { checkAll };
