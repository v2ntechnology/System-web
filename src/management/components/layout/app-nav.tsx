import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { CaretDownIcon, LockSimpleIcon } from '@phosphor-icons/react';
import { cn } from '@/management/ui';
import { NavLink, useLocation } from 'react-router';

import { useSession } from '@/management/features/auth/store';

import { isGroup, navForRole, type NavLeaf } from './nav-items';

const triggerClass =
  'rounded-pill text-body-md focus-visible:ring-secondary focus-visible:ring-offset-background flex items-center gap-1 px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const activeClass = 'bg-primary-strong text-on-primary font-medium';
const idleClass = 'text-on-surface-variant hover:text-on-surface hover:bg-white/10';

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
                    {isLocked(entry) ? (
                      <LockSimpleIcon size={13} weight="fill" aria-label="Não contratado" />
                    ) : null}
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
                <CaretDownIcon
                  size={12}
                  weight="bold"
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
                <ul className="bg-surface-low ring-outline-variant min-w-64 rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1">
                  {entry.items.map((item) => {
                    const locked = isLocked(item);
                    const active = isItemActive(item);

                    return (
                      <li key={item.to}>
                        <NavigationMenu.Link asChild active={active}>
                          <NavLink
                            to={item.to}
                            className={cn(
                              'focus-visible:ring-secondary block rounded-md px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-white/8',
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
                                <LockSimpleIcon
                                  size={13}
                                  weight="fill"
                                  aria-label="Não contratado"
                                  className={active ? '' : 'text-warning'}
                                />
                              ) : null}
                            </span>
                            <span
                              className={cn(
                                'text-label-md mt-0.5 block normal-case',
                                active ? 'text-on-primary' : 'text-on-surface-muted',
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
      'focus-visible:ring-secondary focus-visible:outline-none focus-visible:ring-2',
      isActive
        ? 'bg-primary-strong text-on-primary font-medium'
        : 'text-on-surface-variant hover:bg-white/8',
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
                  {isLocked(item) ? (
                    <LockSimpleIcon size={13} weight="fill" aria-label="Não contratado" />
                  ) : null}
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
