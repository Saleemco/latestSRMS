// backend/instrument.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://77a16a812d1351649213c058ec0b62d7@o4511275699404800.ingest.us.sentry.io/4511300318199808",
  integrations: [
    // Enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Set environment
  environment: process.env.NODE_ENV || 'development',
  // Send default PII
  sendDefaultPii: true,
});

console.log('✅ Sentry initialized for backend');