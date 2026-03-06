// src/contexts/FetchContext.tsx
import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from 'react';

const API_BASE = 'http://127.0.0.1:8000';
const LLM_API_KEY = 'MySecretKey12345';

interface FetchContextType {
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const FetchContext = createContext<FetchContextType | null>(null);

export const FetchProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const apiFetch = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
        ...options.headers,
      };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP error! status: ${response.status}`);
      }

      if (response.status === 204) return null;
      return await response.json();
    },
    [],
  );

  return (
    <FetchContext.Provider value={{ apiFetch }}>
      {children}
    </FetchContext.Provider>
  );
};

export const useFetch = () => {
  const ctx = useContext(FetchContext);
  if (!ctx) throw new Error('useFetch must be used within FetchProvider');
  return ctx;
};
