/* Tiny Upstash/Vercel-KV Redis REST client shared by the API routes. */
const conf = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
};
const configured = () => !!conf();
const cmd = async (args) => {
  const s = conf();
  if (!s) throw new Error('not_configured');
  const r = await fetch(s.url, { method: 'POST', headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error('store_' + r.status);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const json = (v, d) => { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
module.exports = { configured, cmd, json };
