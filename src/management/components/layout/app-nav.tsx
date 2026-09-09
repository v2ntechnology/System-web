import { ChevronDownIcon, LockIcon } from '@/components/icons';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { cn } from '@/management/ui';
import { NavLink, useLocation } from 'react-router';

import { useSession } from '@/management/features/auth/store';

import { isGroup, navForRole, type NavLeaf } from './nav-items';

const triggerClass =
  'rounded-pill text-body-md focus-visible:ring-primary focus-visible:ring-offset-surface flex items-center gap-1.5 px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

/*
 * ⚠️ A pastilha do item ativo é TERRACOTA desde 08/09/2026, a pedido do usuário.
 *
 * Ela era PRETA desde o redesign de 30/08/2026, pelo raciocínio de que a cor de
 * marca já trabalhava no logo, no botão de ação e na primeira série do gráfico,
 * e que somar o estado ativo a essa lista gastaria a cor. O usuário decidiu o
 * contrário para a navegação: com a secundária marinho entrando em link e botão
 * de contorno, a navegação selecionada é onde ele quer ver a marca quente.
 *
 * ⚠️ A classe escreve `primary-strong`, mas desde 08/09/2026 esse token É o
 * #D5623A: o usuário pediu um laranja único e a escala de terracota foi
 * colapsada na paleta. A escolha do nome ficou de quando `strong` era #B35231 e
 * devolvia 5,04:1 com branco. Hoje a pastilha dá 3,9:1 e reprova o AA de texto
 * de menu. Devolver a escala em `palette.css` conserta isto sem tocar aqui.
 *
 * ⚠️ Vale só para a navegação do painel de gestão. Aba, paginação, seletor de
 * período e passo do assistente seguem na pastilha preta (`bg-bright`), e a
 * lateral do painel operacional também.
 *
 * ⚠️ O hover do ativo ESCURECE a própria cor, e não remove a pastilha. Este par
 * é exclusivo do `idleClass` de baixo: os dois nunca entram juntos. Somar os
 * dois foi o que quebrou a lateral do painel operacional, onde o hover claro
 * vencia a pastilha por especificidade e apagava o ícone.
 */
const activeClass =
  'bg-primary-strong text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)] font-medium';

/*
 * ⚠️ Saiu o `on-media`. A barra deixou de flutuar sobre a foto do banner e
 * agora mora sobre o papel, então o texto volta a ser `on-surface`. Manter o
 * `on-media` aqui deixaria o menu branco sobre fundo branco.
 */
/*
 * ⚠️ O véu do hover subiu de 6% para 12% em 06/09/2026, a pedido do usuário.
 *
 * A 6% sobre o papel o fundo praticamente não existia: medido, ele saía em
 * `oklab(0.209768 ... / 0.06)`, uma diferença que o olho não separa do branco.
 * O único sinal de hover acabava sendo o texto escurecer, e num menu horizontal
 * isso é pouco para dizer onde o cursor está.
 */
const idleClass = 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.12]';

/**
 * Navegação principal do painel.
 *
 * Radix cuida do teclado, do `aria-expanded` e de fechar ao sair — um menu
 * suspenso feito à mão erra em pelo menos um desses três.
 *
 * ⚠️ **O `className` dos `NavLink` daqui é string, nunca função.** O `asChild` do
 * Radix monta o filho com `Slot`, que funde `className` concatenando strings —
 * a função `({ isActive }) => …` do React Router vira o **código-fonte dela** no
 * atributo `class`. O sintoma é brutal e silencioso: nenhum utilitário aplica,
 * o menu vira uma frase corrida sem padding e o item ativo nunca acende, sem
 * um único erro no console. O estado ativo sai de `isItemActive`, que já existe.
 */
export function AppNav() {
  const session = useSession();
  const { pathname } = useLocation();
  const contracted = session?.tenant.modules ?? [];
  const nav = navForRole(session?.user.role);

  /**
   * RN-004 — módulo fora do plano aparece bloqueado, não some. O usuário precisa
   * saber que a funcionalidade existe; esconder vira chamado de suporte.
   */
  const isLocked = (item: NavLeaf) => Boolean(item.module) && !contracted.includes(item.module!);

  const isItemActive = (item: NavLeaf) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to);

  return (
    <NavigationMenu.Root className="relative hidden flex-1 justify-center lg:flex">
      <NavigationMenu.List className="flex items-center gap-1">
        {nav.map((entry) => {
          if (!isGroup(entry)) {
            const active = isItemActive(entry);

            return (
              <NavigationMenu.Item key={entry.to}>
                <NavigationMenu.Link asChild active={active}>
                  <NavLink
                    to={entry.to}
                    end={entry.end ?? false}
                    className={cn(triggerClass, active ? activeClass : idleClass)}
                  >
                    {entry.label}
                    {isLocked(entry) ? <LockIcon size={13} aria-label="Não contratado" /> : null}
                  </NavLink>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            );
          }

          /* O grupo herda o destaque quando qualquer filho está aberto. */
          const groupActive = entry.items.some(isItemActive);

          return (
            <NavigationMenu.Item key={entry.label} className="relative">
              <NavigationMenu.Trigger
                className={cn(triggerClass, groupActive ? activeClass : idleClass, 'group')}
              >
                {entry.label}
                <ChevronDownIcon
                  size={12}
                  aria-hidden="true"
                  className="transition-transform group-data-[state=open]:rotate-180"
                />
              </NavigationMenu.Trigger>

              {/*
               * `absolute` ancorado no Item (que é `relative`), não no Root.
               * Sem isso o menu alinhava com a borda esquerda da barra inteira,
               * uns 370px à esquerda do próprio botão que o abriu.
               */}
              <NavigationMenu.Content className="absolute left-0 top-full z-[1000] mt-2 w-max">
                {/* A sombra caiu de 90% para 18% de preto. Sombra quase opaca
                    sobre papel não é elevação, é mancha: ela existia para
                    destacar o menu contra a foto escura do banner. */}
                <ul className="bg-surface-low ring-outline-variant min-w-64 rounded-lg p-2 shadow-[0_2px_6px_rgba(28,26,24,0.05),0_24px_48px_-20px_rgba(28,26,24,0.18)] ring-1">
                  {entry.items.map((item) => {
                    const locked = isLocked(item);
                    const active = isItemActive(item);

                    return (
                      <li key={item.to}>
                        <NavigationMenu.Link asChild active={active}>
                          <NavLink
                            to={item.to}
                            className={cn(
                              'focus-visible:ring-primary block rounded-md px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active
                                ? 'bg-primary-strong hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]'
                                : /* Mesmo véu do menu de cima. Ver `idleClass`. */
                                  'hover:bg-on-surface/[0.12]',
                            )}
                          >
                            <span
                              className={cn(
                                'text-body-md flex items-center gap-2',
                                active ? 'text-on-primary font-medium' : 'text-on-surface',
                              )}
                            >
                              {item.label}
                              {locked ? (
                                <LockIcon
                                  size={13}
                                  aria-label="Não contratado"
                                  className={active ? '' : 'text-warning'}
                                />
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                'text-label-md mt-0.5 block normal-case',
                                /* Tinta a 70%, e não cinza: texto secundário
                                   sobre superfície colorida se tinge da própria
                                   cor de frente, senão descola do primário. */
                                active ? 'text-on-bright/70' : 'text-on-surface-muted',
                              )}
                            >
                              {locked ? 'Não incluído no seu plano' : item.hint}
                            </span>
                          </NavLink>
                        </NavigationMenu.Link>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          );
        })}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

/** Mesma árvore em lista, para o menu do mobile. */
export function AppNavMobile({ onNavigate }: { onNavigate: () => void }) {
  const session = useSession();
  const contracted = session?.tenant.modules ?? [];
  const nav = navForRole(session?.user.role);
  const isLocked = (item: NavLeaf) => Boolean(item.module) && !contracted.includes(item.module!);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-md px-3 py-2.5 text-body-md transition-colors',
      'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
      isActive
        ? 'bg-primary-strong text-on-primary font-medium'
        : 'text-on-surface-variant hover:bg-on-surface/12',
    );

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {nav.map((entry) =>
        isGroup(entry) ? (
          <div key={entry.label} className="mt-2 first:mt-0">
            <p className="text-on-surface-muted text-label-md px-3 py-1.5">{entry.label}</p>
            {entry.items.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={onNavigate} className={linkClass}>
                <span className="flex items-center gap-2">
                  {item.label}
                  {isLocked(item) ? <LockIcon size={13} aria-label="Não contratado" /> : null}
                </span>
              </NavLink>
            ))}
          </div>
        ) : (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end ?? false}
            onClick={onNavigate}
            className={linkClass}
          >
            {entry.label}
          </NavLink>
        ),
      )}
    </nav>
  );
}
