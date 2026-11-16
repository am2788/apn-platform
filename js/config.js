/* Aether Property Networks: runtime configuration.
   Publishable keys only. Secret keys (Stripe secret, Twilio, Brevo) never belong in this file;
   they live in the backend (Xano environment variables). */
window.APN_CONFIG = {
  // Google Maps Platform browser key (Maps JavaScript + Geocoding + Places). Restrict it by HTTP referrer.
  GOOGLE_MAPS_KEY: '',
  // Stripe publishable key (pk_live_... / pk_test_...).
  STRIPE_PUBLISHABLE_KEY: '',
  // Xano API group base URL, e.g. https://xr36-ytey-jl5h.n7e.xano.io/api:XXXXXXXX
  XANO_BASE_URL: '',
  // true = data lives in this browser only (demo). Set false once XANO_BASE_URL is wired.
  DEMO_MODE: true,
  // Live weather for the dashboard atmosphere (Open-Meteo needs no key).
  WEATHER_URL: 'https://api.open-meteo.com/v1/forecast'
};
