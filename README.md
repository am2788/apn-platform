# Aether Property Networks: platform front end

Built from scratch, no Lovable code or dependencies. Plain HTML, CSS and JavaScript: no build step, no packages. Host the folder on any static host (Vercel, Netlify, Cloudflare Pages) and point `aetherpropertynetworks.com` at it.

## Files
- `index.html`: shell
- `css/app.css`: layout and the day / dusk / night / weather themes
- `js/config.js`: keys and switches (publishable keys only)
- `js/data.js`: sectors, tier names, rates, discounts, payout ladder, demo data store
- `js/atmosphere.js`: local time, weather (Open-Meteo) and holiday theme
- `js/app.js`: views: home, sign-in, customer dashboard, 1099 dashboard, vetting + live dispatch, operations, W-2 placeholder
- `assets/`: logo, photos, vision video

## Going live
1. `js/config.js`: add `GOOGLE_MAPS_KEY` (Maps JavaScript + Geocoding, referrer-restricted). This switches property measurement from estimates to satellite tracing.
2. Add `STRIPE_PUBLISHABLE_KEY`. Payment intents and escrow holds must be created server-side (Xano), not in the browser.
3. Set `XANO_BASE_URL`, replace the `APN.store` calls in `js/data.js` with Xano requests, then set `DEMO_MODE: false`.
4. Sign-in is a demo. In production the role must come from the Xano auth response, never from a field on the form.

## Not yet wired (demo behaviour today)
- Xano, Stripe, Twilio and Brevo are not connected. Data is stored in the visitor's browser.
- Satellite tracing code is written but has not been run against a live Google key.
- Uploaded photos and vetting documents are not stored anywhere.
- Currency rates are fixed placeholders. Language switch covers navigation and main buttons only.
- Tax is not calculated.
