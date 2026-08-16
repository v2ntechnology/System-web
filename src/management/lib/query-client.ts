import { QueryClient } from '@tanstack/react-query';

/**
 * FE-08 — TanStack Query como camada de server state.
 *
 * Cache agressivo é parte da mitigação do RNF-001 (< 2s no p95) sem SSR:
 * o painel prefere dado levemente velho a tela em branco.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
