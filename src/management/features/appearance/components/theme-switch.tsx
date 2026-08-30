import { MoonIcon, SunIcon } from '@/components/icons';
import { cn } from '@/management/ui';

import { DARK_MODE_ENABLED, useThemeStore, type Theme } from '@/stores/theme-store';

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Tema claro', Icon: SunIcon },
  { value: 'dark', label: 'Tema escuro', Icon: MoonIcon },
];

/**
 * Seletor de tema em trilho, gêmeo do `ThemeSwitch` do painel operacional.
 *
 * Mesmo desenho e mesmo comportamento, com os primitivos daqui: o par
 * `surface-lowest` (trilho) e `surface-container` (realce) é o único que mantém
 * o realce visível nos dois temas, porque a rampa inverte entre claro e escuro.
 *
 * O realce desliza `translate-x-9`, a largura de um botão.
 *
 * ⚠️ Botões em `tabIndex={-1}`: isto vive dentro de um menu, onde o foco é das
 * setas do Radix e Tab fecharia tudo. Quem alterna pelo teclado é o item que
 * embrulha o seletor (ver `app-topbar.tsx`).
 *
 * <h2>O escuro aparece desabilitado, e não some</h2>
 *
 * ⚠️ Enquanto `DARK_MODE_ENABLED` for falso (redesign em andamento, 30/08/2026),
 * a lua fica visível e recusa o clique, com o motivo na dica. Esconder a opção
 * faria o seletor virar um botão só, sem escolha nenhuma, e ninguém saberia que
 * o escuro está a caminho. Deixá-la clicável e sem efeito seria pior: leria como
 * defeito.
 */
export function ThemeSwitch() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="bg-surface-lowest rounded-pill relative inline-flex items-center p-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-surface-container ring-outline-variant rounded-pill absolute left-1 top-1 size-9 ring-1 transition-transform duration-200 ease-out',
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
              'rounded-pill focus-visible:ring-secondary relative z-10 flex size-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2',
              active ? 'text-on-surface' : 'text-on-surface-muted hover:text-on-surface',
              /* `aria-disabled` em vez de `disabled`: o botão continua no fluxo
                 do leitor de tela, anunciando que a opção existe e está
                 indisponível. `disabled` o tiraria da leitura, e a pessoa não
                 saberia que há um tema escuro a caminho. */
              blocked && 'cursor-not-allowed opacity-40 hover:text-on-surface-muted',
            )}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
}
