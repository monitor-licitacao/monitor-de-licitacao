import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as amplitude from '@amplitude/unified';
import App from './App.tsx';
import './index.css';

const amplitudeApiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
if (!amplitudeApiKey) {
  console.warn('Amplitude API key missing — analytics disabled');
} else {
  amplitude.initAll(amplitudeApiKey, {
    analytics: { autocapture: true },
    sessionReplay: { sampleRate: 1 },
  });
  amplitude.track('Viewed Dashboard Page', { prompt_version: 'BA400.4' });
}

// Keep authentication headers consistent for direct fetch calls outside apiClient.
// Global fetch interceptor adds API key to all /api requests (Rule 3: Security Default-On)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    config.headers = config.headers || {};
    const headers = config.headers as Record<string, string>;

    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      (window as any).__AUTH_TOKEN__;
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env?.DEV && import.meta.env?.VITE_MONITOR_API_KEY) {
      const explicitDevKey = import.meta.env.VITE_MONITOR_API_KEY.trim();
      if (explicitDevKey && !headers['x-api-key']) {
        headers['x-api-key'] = explicitDevKey;
      }
    }
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
