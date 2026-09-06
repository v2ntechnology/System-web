/**
 * FE-07 — Fallback de blur.
 *
 * `backdrop-filter: blur()` é uma das operações mais caras do compositor.
 * Em Android intermediário e notebooks com GPU integrada — exatamente o hardware
 * do operador de escritório — dezenas de painéis com vidro derrubam o FPS.
 *
 * A classe `no-blur` na raiz do documento desliga o vidro globalmente
 * (ver `packages/tokens/src/glass.css`).
 */

const STORAGE_KEY = 'rookhub:high-performance-mode';

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number | undefined;
}

/** Heurística de dispositivo modesto: poucos núcleos ou pouca memória. */
function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 8;

  return cores <= 4 || memory <= 4;
}

/** Preferência explícita do usuário, quando existir. Sobrepõe a heurística. */
export function getUserPreference(): boolean | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return null;
  return stored === 'true';
}

export function setHighPerformanceMode(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  document.documentElement.classList.toggle('no-blur', enabled);
}

/**
 * O modo em vigor: preferência explícita quando existe, heurística quando não.
 *
 * Exportado para a interface de aparência poder mostrar o estado **real** — sem
 * isto, o menu abriria com a caixa desmarcada num aparelho onde a heurística já
 * tinha desligado o vidro, e o primeiro clique não mudaria nada visível.
 */
export function resolveHighPerformanceMode(): boolean {
  return getUserPreference() ?? isLowEndDevice();
}

/**
 * Aplica o perfil de performance na raiz do documento. Chamar antes do render.
 *
 * São duas classes porque são dois custos diferentes, ligados pela mesma
 * heurística: `no-blur` desliga o vidro (custo de compositor) e `modo-leve`
 * simplifica animação contínua (custo de GPU por quadro). Quem tem hardware
 * modesto paga os dois.
 */
export function applyPerformanceProfile(): void {
  const leve = resolveHighPerformanceMode();
  document.documentElement.classList.toggle('no-blur', leve);
  document.documentElement.classList.toggle('modo-leve', leve);
}

/**
 * O laço de animação deve ser simplificado?
 *
 * Vale para animação em JavaScript, que não enxerga classe de CSS: o globo do
 * hub e a esfera de voz consultam isto para congelar ou reduzir o passo.
 */
export function prefersLightAnimation(): boolean {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return true;
  }
  return resolveHighPerformanceMode();
}
