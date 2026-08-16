import { Lock } from 'lucide-react';
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
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
                        'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                        'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                        isActive && 'bg-sidebar-accent text-foreground',
                        collapsed && 'justify-center',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'relative flex h-5 w-5 shrink-0 items-center justify-center',
                            isActive && 'text-primary',
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && locked && (
                          <Lock
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
