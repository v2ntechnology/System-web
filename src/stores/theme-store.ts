import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

/**
 * O tema escuro está desligado no produto inteiro.
 *
 * ⚠️ Decisão do usuário em 30/08/2026, e é temporária de propósito. O redesign
 * está sendo feito **primeiro no claro**: manter as duas rampas vivas durante a
 * reforma obrigaria a conferir cada tela duas vezes, e as telas que ainda não
 * foram refeitas ficariam com metade dos tokens de um desenho e metade do outro.
 *
 * Quando o claro estiver fechado, o escuro volta trocando esta constante para
 * `true`. Nada mais precisa mudar: a rampa escura continua inteira em
 * `styles/palette.css`, o seletor continua na tela, e a preferência de quem já
 * tinha escolhido escuro continua gravada em `localStorage`.
 *
 * Não apagar a rampa escura nem os caminhos de código que ela usa "já que não
 * roda": reconstruir depois custa mais do que manter.
 */
export const DARK_MODE_ENABLED = false;

/**
 * Telas que ficam claras mesmo quando o escuro voltar.
 *
 * ⚠️ Decisão do usuário em 30/08/2026. São as telas sem sessão e sem casca de
 * aplicação: login, recuperação de senha, convite, sessão expirada e 404, mais o
 * hub que escolhe entre plataforma e assistente.
 *
 * O motivo é que elas são a porta de entrada do produto e não pertencem a
 * ninguém ainda: quando o navegador abre `/`, não existe usuário de quem herdar
 * preferência, e uma tela de login que muda de cor conforme o último tema
 * escolhido em outra máquina é imprevisível. Fixar o branco também dá um ponto
 * único de referência para a marca.
 *
 * Este trilho é **de rota, e não de componente**: a tela não sabe que está
 * travada, e o mesmo componente renderizado dentro da aplicação seguiria o tema
 * normalmente.
 */
let lockedToLight = false;

/** Qual tema realmente vai para o `<html>`, depois das duas travas. */
function resolve(preferred: Theme): Theme {
  if (lockedToLight || !DARK_MODE_ENABLED) return 'light';
  return preferred;
}

export function applyThemeClass(preferred: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = resolve(preferred);

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

/**
 * Prende a página no claro. Usado pelo `ThemeLock` das rotas públicas.
 *
 * Devolve a preferência gravada ao soltar, e não o claro: quem tem escuro salvo
 * e passa pelo login precisa reencontrar o escuro ao entrar.
 */
export function lockThemeToLight(): void {
  lockedToLight = true;
  applyThemeClass('light');
}

export function unlockTheme(): void {
  lockedToLight = false;
  applyThemeClass(useThemeStore.getState().theme);
}

interface ThemeState {
  /** O que a pessoa escolheu. Pode não ser o que está na tela: ver `resolve`. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      /*
       * Enquanto o escuro está desligado, o padrão é claro, e o seletor precisa
       * refletir o que está na tela. Guardar 'dark' aqui deixaria o realce do
       * seletor parado na lua com a tela branca, que lê como defeito.
       */
      theme: DARK_MODE_ENABLED ? 'dark' : 'light',

      setTheme: (theme) => {
        const escolhido = DARK_MODE_ENABLED ? theme : 'light';
        applyThemeClass(escolhido);
        set({ theme: escolhido });
      },

      toggleTheme: () => {
        if (!DARK_MODE_ENABLED) return;
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(next);
        set({ theme: next });
      },
    }),
    {
      name: 'rookhub.theme',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        /* Quem já tinha escuro salvo volta para claro enquanto a trava existe.
           A preferência é reescrita, e não só ignorada, para o seletor não
           mostrar uma opção que a tela não obedece. */
        if (!DARK_MODE_ENABLED && state.theme !== 'light') {
          state.theme = 'light';
        }
        applyThemeClass(state.theme);
      },
    },
  ),
);
