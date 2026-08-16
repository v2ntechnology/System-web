import { useSyncExternalStore } from 'react';

/**
 * Reflete `:root.no-blur` (FE-07) em tempo real.
 *
 * O menu de aparência liga e desliga o modo alto desempenho em runtime, então não
 * basta ler a classe na montagem — daí o observer.
 *
 * ⚠️ `useSyncExternalStore` e não `useEffect` + `setState`: a classe é estado que
 * vive fora do React, e sincronizar por efeito é erro de lint aqui (as regras do
 * React Compiler são erro, não aviso).
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains('no-blur');
}

/* No servidor não há DOM: o vidro é o padrão, e o fallback só entra no cliente. */
const getServerSnapshot = () => false;

export function useNoBlur(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
