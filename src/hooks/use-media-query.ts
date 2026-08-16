import { useCallback, useSyncExternalStore } from 'react';

/**
 * Assina uma media query do navegador. Usa `useSyncExternalStore` para ler o
 * estado externo sem sincronizar via efeito, evitando renders em cascata.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
