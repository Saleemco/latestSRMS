import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import * as Sentry from "@sentry/react";

// Initialize Sentry
Sentry.init({
  dsn: "https://4e1621b903f8746dd97b32cac84f30d1@o4511275699404800.ingest.us.sentry.io/4511300251549696",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.VITE_NODE_ENV || 'development',
  sendDefaultPii: true,
});

// Make Sentry available globally for console testing
(window as any).Sentry = Sentry;

// Define the fallback component
const ErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-red-50">
    <div className="text-center p-6 max-w-md">
      <div className="text-6xl mb-4">😵</div>
      <h1 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h1>
      <p className="text-red-600 mb-4">An unexpected error occurred</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Refresh Page
      </button>
    </div>
  </div>
);

// Wrap App with Sentry Error Boundary - using ErrorBoundary component directly
const SentryApp = () => (
  <Sentry.ErrorBoundary fallback={ErrorFallback}>
    <App />
  </Sentry.ErrorBoundary>
);

console.log('✅ App starting with Sentry');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryApp />
  </React.StrictMode>,
);