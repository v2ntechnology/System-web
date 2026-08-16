import { create } from 'zustand';

import { resolveHighPerformanceMode, setHighPerformanceMode } from '@/management/lib/performance';

/**
 * Temas disponíveis.
 *
 * Hoje só existe o escuro. O grafite `#212121` é âncora de produto (regra 1) e o
 * tema claro exige rederivar a rampa **e** revisar os componentes que hoje
 * misturam as duas famílias de propósito — `StatTile` escuro dentro de
 * `LightCard` claro, poços, as faixas `bg-light` do `PageContent`. Enquanto isso
 * não acontecer, o claro aparece no menu **desabilitado**: o usuário precisa
 * saber que a opção existe e que ainda não chegou (mesma lógica do RN-004).
 */
export type ThemeChoice = 'dark' | 'light';

export const THEME_AVAILABILITY: Record<ThemeChoice, boolean> = {
  dark: true,
  light: false,
};

interface AppearanceState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  /** Modo alto desempenho — desliga o vidro (FE-07). */
  highPerformance: boolean;
  setHighPerformance: (enabled: boolean) => void;
}

/**
 * Preferências de aparência.
 *
 * ⚠️ **Sem `persist` de propósito.** A preferência de desempenho já é gravada por
 * `lib/performance.ts`, que precisa lê-la antes do React montar para não haver
 * um quadro com vidro ligado. Dois donos da mesma chave divergiriam; aqui a
 * store só espelha o que aquele módulo decide.
 */
export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => {
    if (!THEME_AVAILABILITY[theme]) return;
    set({ theme });
  },
  highPerformance: resolveHighPerformanceMode(),
  setHighPerformance: (enabled) => {
    setHighPerformanceMode(enabled);
    set({ highPerformance: enabled });
  },
}));
