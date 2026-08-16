import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // `theme-switching` desliga as transições de cor durante a troca (ver globals.css).
  root.classList.add('theme-switching');
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;

  // Ler um valor calculado obriga o navegador a aplicar as cores novas agora,
  // ainda sem transição; só depois disso as transições voltam a valer.
  window.getComputedStyle(root).getPropertyValue('background-color');
  root.classList.remove('theme-switching');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Tema escuro é o padrão do produto.
      theme: 'dark',
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(next);
        set({ theme: next });
      },
    }),
    {
      name: 'rookhub.theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
