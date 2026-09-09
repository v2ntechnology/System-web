import { LockIcon } from '@/components/icons';
import { NavLink, useLocation } from 'react-router';

import { type NavGroup } from '@/app/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions, usePlan, useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  navigation: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
  ariaLabel?: string;
}

/*
 * Sombra das pastilhas do trilho recolhido: a mesma do `Card` (deslocamento e
 * desfoque, sem halo). Recolhido, o item de menu É um bloco solto sobre o papel,
 * e não uma linha de lista.
 */
const CHIP_SHADOW = 'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]';

export function SidebarNav({
  navigation,
  collapsed = false,
  onNavigate,
  ariaLabel = 'Navegação principal',
}: SidebarNavProps) {
  const { hasPermission } = usePermissions();
  const { isModuleEnabled } = usePlan();
  const { user } = useSession();
  const { pathname } = useLocation();

  /**
   * ⚠️ O estado ativo sai DAQUI, e não do `({ isActive }) => …` do React Router.
   *
   * Recolhida, cada item é embrulhado por `TooltipTrigger asChild`, e o `Slot`
   * do Radix funde `className` concatenando strings. Se o `className` do
   * `NavLink` for função, o que vai parar no atributo `class` é o CÓDIGO-FONTE
   * dela: nenhum utilitário aplica, a pastilha some, o disco perde tamanho e
   * fundo, e o menu recolhido vira uma coluna de ícones soltos sem nada em
   * volta. Não há erro no console. É a mesma armadilha que o menu superior do
   * painel de gestão documenta em `management/components/layout/app-nav.tsx`.
   */
  const isItemActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <nav
      className={cn('flex flex-col py-4', collapsed ? 'items-center gap-4' : 'gap-5')}
      aria-label={ariaLabel}
    >
      {navigation.map((group) => {
        const visibleItems = group.items.filter(
          (item) =>
            hasPermission(item.permission) &&
            (!item.roles || (user !== null && item.roles.includes(user.role))),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className={collapsed ? '' : 'px-3'}>
            {!collapsed && (
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className={cn(collapsed ? 'flex flex-col items-center gap-2' : 'space-y-0.5')}>
              {visibleItems.map((item) => {
                const locked = !isModuleEnabled(item.moduleKey);
                const active = isItemActive(item.path);
                const Icon = item.icon;

                const link = (
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center text-sm font-medium transition-colors',
                      /*
                       * Recolhida, a barra vira TRILHO DE PASTILHAS (desenho
                       * pedido pelo usuário em 09/09/2026): cada item é um disco
                       * de 44px solto sobre o papel, e não uma linha de lista sem
                       * rótulo. O disco em repouso já tem fundo próprio, que é o
                       * que dá alvo de clique quando não existe texto para dizer
                       * onde o item começa e termina.
                       */
                      collapsed
                        ? 'h-11 w-11 justify-center rounded-full'
                        : 'gap-3 rounded-pill px-3 py-2.5',
                      /*
                       * ⚠️ Pastilha TERRACOTA, igual à do menu superior do painel
                       * de gestão (08/09/2026, a pedido do usuário). É o que faz
                       * as duas cascas lerem como um sistema só. Mexeu aqui, mexa
                       * no `management/components/layout/app-nav.tsx`.
                       *
                       * ⚠️ Os dois estados são EXCLUSIVOS, e não somados: o hover
                       * claro incondicional vencia a pastilha por especificidade
                       * e apagava o ícone dentro dela (1,03:1, medido em
                       * 30/08/2026).
                       */
                      active
                        ? cn(
                            'bg-primary-strong text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
                            collapsed && 'shadow-[0_8px_20px_-10px_var(--color-primary-strong)]',
                          )
                        : collapsed
                          ? cn('bg-card text-muted-foreground hover:text-foreground', CHIP_SHADOW)
                          : 'text-muted-foreground hover:bg-on-surface/[0.06] hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'relative flex h-5 w-5 shrink-0 items-center justify-center',
                        /* Dentro da pastilha o ícone é branco, e não a cor de
                           marca: a marca sobre a própria marca some. */
                        active && 'text-on-primary',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {/* Recolhido não há rótulo para receber o cadeado ao lado,
                          então ele vira um selo no canto do disco: sumir seria
                          esconder que o módulo existe (RN-004). */}
                      {collapsed && locked && (
                        <span
                          className={cn(
                            'absolute -right-2 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full',
                            active ? 'bg-on-primary/20' : 'bg-card',
                          )}
                        >
                          <LockIcon
                            className="h-2.5 w-2.5 text-muted-foreground"
                            aria-label="Recurso do plano"
                          />
                        </span>
                      )}
                    </span>
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && locked && (
                      <LockIcon
                        className="h-3.5 w-3.5 text-muted-foreground/60"
                        aria-label="Recurso do plano"
                      />
                    )}
                  </NavLink>
                );

                return (
                  <li key={item.path}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
