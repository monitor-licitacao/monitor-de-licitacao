import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global fetch interceptor adds API key to all /api requests (Rule 3: Security Default-On)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    config.headers = {
      ...config.headers,
      'x-api-key': import.meta.env.VITE_MONITOR_API_KEY || 'monitor-dev-key'
    };
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
