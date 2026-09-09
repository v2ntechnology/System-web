import { LockIcon } from '@/components/icons';
import { NavLink } from 'react-router';

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

export function SidebarNav({
  navigation,
  collapsed = false,
  onNavigate,
  ariaLabel = 'Navegação principal',
}: SidebarNavProps) {
  const { hasPermission } = usePermissions();
  const { isModuleEnabled } = usePlan();
  const { user } = useSession();

  return (
    <nav className="flex flex-col gap-5 py-4" aria-label={ariaLabel}>
      {navigation.map((group) => {
        const visibleItems = group.items.filter(
          (item) =>
            hasPermission(item.permission) &&
            (!item.roles || (user !== null && item.roles.includes(user.role))),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="px-3">
            {!collapsed && (
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const locked = !isModuleEnabled(item.moduleKey);
                const Icon = item.icon;

                const link = (
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm font-medium transition-colors',
                        /*
                         * ⚠️ Pastilha TERRACOTA, igual à do menu superior do
                         * painel de gestão (08/09/2026, a pedido do usuário).
                         *
                         * É o que faz as duas cascas lerem como um sistema só: o
                         * dono navega no topo, o operador navega na lateral, e o
                         * "você está aqui" é o mesmo objeto nos dois. Mexeu aqui,
                         * mexa no `management/components/layout/app-nav.tsx`.
                         *
                         * A pastilha era preta desde o redesign de 30/08/2026, e
                         * o par `bright`/`on-bright` continua sendo o de aba,
                         * paginação e passo do assistente.
                         *
                         * ⚠️ Os dois estados são EXCLUSIVOS, e não somados
                         * (corrigido em 30/08/2026). Antes o hover claro era
                         * incondicional e vencia a pastilha por especificidade:
                         * ao passar o mouse no item ativo, a pastilha virava
                         * papel a 6% e o ícone, que continua claro por estar
                         * dentro dela, sumia contra o fundo. Medido em 1,03:1, ou
                         * seja, invisível. Um item de menu não pode piscar e
                         * apagar justamente quando a pessoa aponta para ele.
                         */
                        isActive
                          ? 'bg-primary-strong text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]'
                          : 'text-muted-foreground hover:bg-on-surface/[0.06] hover:text-foreground',
                        collapsed && 'justify-center',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'relative flex h-5 w-5 shrink-0 items-center justify-center',
                            /* Dentro da pastilha o ícone é branco, e não a cor
                               de marca: a marca sobre a própria marca some. Fora
                               dela ele herda a cor do texto. */
                            isActive && 'text-on-primary',
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && locked && (
                          <LockIcon
                            className="h-3.5 w-3.5 text-muted-foreground/60"
                            aria-label="Recurso do plano"
                          />
                        )}
                      </>
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
