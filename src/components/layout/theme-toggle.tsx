import { MoonIcon, SunIcon } from '@/components/icons';

import { cn } from '@/lib/utils';
import { DARK_MODE_ENABLED, useThemeStore, type Theme } from '@/stores/theme-store';

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Tema claro', Icon: SunIcon },
  { value: 'dark', label: 'Tema escuro', Icon: MoonIcon },
];

/**
 * Seletor de tema em trilho, com o realce deslizando para a opção escolhida.
 *
 * Duas opções sempre visíveis, e não um item que alterna: quem abre o menu vê de
 * imediato em que tema está e para onde vai clicar, sem ler o rótulo.
 *
 * O realce é um elemento próprio e absoluto, e não o fundo do botão ativo: só
 * assim ele desliza entre as posições. `translate-x-9` = a largura de um botão.
 *
 * `radiogroup` porque é escolha entre alternativas, não dois botões avulsos: o
 * leitor de tela anuncia "2 de 2, selecionado" em vez de dois comandos soltos.
 *
 * ⚠️ Os botões são `tabIndex={-1}` porque isto mora dentro de um menu, e num
 * menu quem manda no foco são as setas do Radix — Tab fecha o menu inteiro. Pelo
 * teclado, quem alterna o tema é o item que embrulha este seletor (ver
 * `user-menu.tsx`); aqui o clique é do ponteiro.
 *
 * ⚠️ Enquanto `DARK_MODE_ENABLED` for falso (redesign em andamento, 30/08/2026),
 * a lua fica visível e recusa o clique, com o motivo na dica. Gêmeo do
 * `management/features/appearance/components/theme-switch.tsx`: mexeu num,
 * espelhe no outro.
 */
export function ThemeSwitch() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="relative inline-flex items-center rounded-full bg-background p-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1 top-1 size-9 rounded-full border border-border bg-card transition-transform duration-200 ease-out',
          theme === 'dark' && 'translate-x-9',
        )}
      />

      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        const blocked = value === 'dark' && !DARK_MODE_ENABLED;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            tabIndex={-1}
            aria-checked={active}
            aria-disabled={blocked}
            aria-label={label}
            title={blocked ? 'Tema escuro em breve. A interface está sendo refeita no claro.' : label}
            /* Sem roubar o foco do menu: quem clica com o mouse deixaria o foco
               preso neste botão, e as setas parariam de andar pelos itens. */
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              /* ⚠️ O clique não pode subir: o item de menu que embrulha este
                 seletor tem o `onSelect` que **alterna** o tema (é o caminho de
                 teclado). Sem isto, clicar no sol escolhia claro e em seguida o
                 item alternava de volta para escuro, e nada mudava na tela. */
              event.stopPropagation();
              if (blocked) return;
              setTheme(value);
            }}
            className={cn(
              'relative z-10 flex size-9 items-center justify-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              /* `aria-disabled` em vez de `disabled`: o botão continua na leitura
                 do leitor de tela, anunciando que a opção existe e está
                 indisponível. */
              blocked && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
