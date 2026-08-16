/**
 * Configuração de ambiente exposta ao cliente.
 * Nunca coloque segredos aqui — apenas variáveis públicas com prefixo VITE_.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  enableMocks: (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') === 'true',
  appName: import.meta.env.VITE_APP_NAME ?? 'RookHub',
} as const;

export const APP_TAGLINE = 'The Intelligence Behind Every Fleet.';
