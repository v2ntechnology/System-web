import { create } from 'zustand';

import { resolveHighPerformanceMode, setHighPerformanceMode } from '@/management/lib/performance';

interface AppearanceState {
  /** Modo alto desempenho — desliga o vidro (FE-07). */
  highPerformance: boolean;
  setHighPerformance: (enabled: boolean) => void;
}

/**
 * Preferências de aparência do painel de gestão.
 *
 * ⚠️ O **tema não mora aqui**. Desde 19/08/2026 os dois painéis dividem a mesma
 * paleta, e quem decide claro ou escuro é o `useThemeStore` de `src/stores`, que
 * também põe a classe no `<html>`. Duas stores de tema divergiriam na primeira
 * troca feita fora deste menu.
 *
 * ⚠️ **Sem `persist` de propósito.** A preferência de desempenho já é gravada por
 * `lib/performance.ts`, que precisa lê-la antes do React montar para não haver
 * um quadro com vidro ligado. Dois donos da mesma chave divergiriam; aqui a
 * store só espelha o que aquele módulo decide.
 */
export const useAppearanceStore = create<AppearanceState>((set) => ({
  highPerformance: resolveHighPerformanceMode(),
  setHighPerformance: (enabled) => {
    setHighPerformanceMode(enabled);
    set({ highPerformance: enabled });
  },
}));
