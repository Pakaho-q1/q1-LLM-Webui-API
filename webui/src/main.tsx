import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

import { SSEProvider } from './contexts/SSEContext';
import { FetchProvider } from './contexts/FetchContext';
import { SettingsProvider } from './services/SettingsContext';
import { SystemMonitor } from './services/SystemMonitor';
import { ToastViewport } from './components/ui/ToastViewport';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <FetchProvider>
          <SSEProvider>
            <SystemMonitor />
            <App />
            <ToastViewport />
          </SSEProvider>
        </FetchProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
