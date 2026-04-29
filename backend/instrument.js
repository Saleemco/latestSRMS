// backend/instrument.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://77a16a812d1351649213c058ec0b62d7@o4511275699404800.ingest.us.sentry.io/4511300318199808",
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});

console.log('✅ Sentry initialized for backend');