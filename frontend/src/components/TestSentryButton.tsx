// src/components/TestSentryButton.tsx
import * as Sentry from "@sentry/react";

export const TestSentryButton = () => {
  const testError = () => {
    try {
      // This will throw an error
      throw new Error('Test error from School Management System!');
    } catch (error) {
      // Send the error to Sentry
      Sentry.captureException(error);
      alert('✅ Error sent to Sentry! Check your dashboard.');
    }
  };

  const testMessage = () => {
    Sentry.captureMessage('Test message from user', 'info');
    alert('✅ Message sent to Sentry!');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2">
      <button
        onClick={testError}
        className="px-3 py-1 bg-red-500 text-white text-xs rounded opacity-50 hover:opacity-100 transition-opacity"
      >
        Test Error
      </button>
      <button
        onClick={testMessage}
        className="px-3 py-1 bg-blue-500 text-white text-xs rounded opacity-50 hover:opacity-100 transition-opacity"
      >
        Test Message
      </button>
    </div>
  );
};