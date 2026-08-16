import { useEffect, useState } from 'react';

/**
 * `prefers-reduced-motion` como estado de React.
 *
 * Existe para a animação que **não** dá para escrever em classe utilitária —
 * `style={{ animation }}` inline, laço de canvas, timer. Nesses casos não há
 * variante `motion-safe:` para carregar a responsabilidade, e esquecer disso
 * significa piscar a tela de alguém que pediu explicitamente para não piscar.
 *
 * Reage à mudança da preferência em tempo real: o usuário pode ligar a opção no
 * sistema com a aba aberta.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
