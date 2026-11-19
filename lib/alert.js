/* Sends an alert through every channel that is configured. Channels: ntfy.sh push, Brevo email, Twilio SMS. */
const channels = () => ({
  ntfy: !!process.env.ALERT_NTFY_TOPIC,
  email: !!(process.env.BREVO_API_KEY && process.env.ALERT_EMAIL),
  sms: !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM && process.env.ALERT_SMS_TO)
});
const t = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
async function send(title, body) {
  const out = {}; const c = channels();
  if (c.ntfy) {
    try {
      const r = await t(fetch('https://ntfy.sh/' + encodeURIComponent(process.env.ALERT_NTFY_TOPIC), { method: 'POST', headers: { Title: title, Priority: 'high', Tags: 'warning' }, body }));
      out.ntfy = r.ok ? 'sent' : 'error ' + r.status;
    } catch (e) { out.ntfy = 'error'; }
  }
  if (c.email) {
    try {
      const r = await t(fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { name: 'APN Alerts', email: process.env.ALERT_FROM || process.env.ALERT_EMAIL }, to: [{ email: process.env.ALERT_EMAIL }], subject: title, textContent: body }) }));
      out.email = r.ok ? 'sent' : 'error ' + r.status;
    } catch (e) { out.email = 'error'; }
  }
  if (c.sms) {
    try {
      const sid = process.env.TWILIO_SID;
      const r = await t(fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + process.env.TWILIO_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: process.env.ALERT_SMS_TO, From: process.env.TWILIO_FROM, Body: (title + ': ' + body).slice(0, 300) }).toString() }));
      out.sms = r.ok ? 'sent' : 'error ' + r.status;
    } catch (e) { out.sms = 'error'; }
  }
  return out;
}
module.exports = { send, channels };
