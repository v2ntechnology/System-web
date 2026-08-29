/**
 * Pares de cor de campo, por superfície, e a camada dos conteúdos flutuantes.
 *
 * <h2>Por que num módulo só</h2>
 *
 * `GlassInput`, `GlassSelect` e `GlassDateField` precisam ficar idênticos: três
 * campos numa mesma linha do formulário com foco de cor diferente é o tipo de
 * detalhe que ninguém reporta e todo mundo percebe. Antes isso morava dentro do
 * `glass-input.tsx`, e o campo de data nasceria com uma segunda cópia.
 */
export const FIELD_SURFACES = {
  dark: {
    well: 'glass-well focus-within:border-secondary focus-within:ring-secondary/60 focus-within:ring-1',
    wellFocus: '',
    wellError:
      'border-error focus-within:border-error focus-within:ring-error/60 ring-1 ring-error/60',
    label: 'text-on-surface-variant',
    text: 'text-on-surface',
    placeholder: 'placeholder:text-placeholder',
    muted: 'text-on-surface-muted',
    error: 'text-error',
  },
  light: {
    well: 'light-well focus-within:border-primary-on-light focus-within:ring-primary-on-light/50 focus-within:ring-1',
    wellFocus: '',
    wellError:
      'border-error-on-light focus-within:border-error-on-light focus-within:ring-error-on-light/50 ring-1 ring-error-on-light/50',
    label: 'text-on-light-variant',
    text: 'text-on-light',
    placeholder: 'placeholder:text-placeholder',
    muted: 'text-on-light-muted',
    error: 'text-error-on-light',
  },
} as const;

/**
 * Camada de tudo que flutua: lista de select, calendário, menu.
 *
 * ⚠️ Precisa ficar acima do modal, que é `z-[1100]` (véu) e `z-[1101]`
 * (conteúdo). Enquanto a lista do `GlassSelect` era `z-[1000]`, todo select
 * dentro de um diálogo abria ATRÁS dele: o usuário clicava, nada aparecia, e a
 * página escurecia sem explicação (relatado em 27/08/2026).
 *
 * A escala do painel, para quem for acrescentar camada:
 *
 *   1000  cromo fixo: topbar, navegação, faixa da página
 *   1100  véu e conteúdo do diálogo
 *   1200  conteúdo flutuante, que é sempre aberto POR alguém e some sozinho
 */
export const POPOVER_LAYER = 'z-[1200]';

/**
 * Realce de item sob o cursor ou percorrido pelo teclado.
 *
 * ⚠️ As classes vão inteiras, e nunca montadas por concatenação. O Tailwind
 * gera só o que encontra literal no código-fonte: `data-[highlighted]:${X}` não
 * existe para o compilador e a regra simplesmente não sai no CSS.
 *
 * ⚠️ Sem `secondary`: estas classes são usadas dentro de portal, e fora de
 * `.management-theme` esse token volta a ser o cinza de controle do painel
 * operacional. Só entram tokens da paleta comum.
 *
 * 12% e não 8%: a 8% o item mal mudava sob o cursor, e num painel escuro isso
 * lê como "não é clicável".
 */
export const HIGHLIGHT = 'hover:bg-on-surface/12';
export const HIGHLIGHT_ITEM = 'data-[highlighted]:bg-on-surface/12';

/** Anel de foco seguro em portal. `secondary` não vale fora do tema da gestão. */
export const PORTAL_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong';
