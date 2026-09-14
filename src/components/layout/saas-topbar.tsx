import { CloseIcon, MenuIcon } from '@/components/icons';
import type { NavGroup } from '@/app/navigation';
import { Button } from '@/components/ui/button';
import { usePermissions, useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { NotificationMenu } from './notification-menu';
import { UserMenu } from './user-menu';

const floatingPanel = cn(
  'pointer-events-auto rounded-[24px] bg-card/95 shadow-[0_18px_48px_-24px_rgba(28,26,24,0.34)]',
  'ring-1 ring-on-surface/[0.07] backdrop-blur-xl',
);

/**
 * Cabeçalho flutuante do backoffice SaaS.
 *
 * A marca é uma cápsula independente à esquerda. A navegação não ocupa uma
 * faixa inteira: abre como um painel leve no canto direito, tal como a referência
 * visual da página institucional, e pode sair da frente ao fechar.
 */
export function SaasTopbar({ navigation }: { navigation: NavGroup[] }) {
  const { hasPermission } = usePermissions();
  const { user } = useSession();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const groups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          hasPermission(item.permission) &&
          (!item.roles || (user !== null && item.roles.includes(user.role))),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6">
      <div className={cn(floatingPanel, 'absolute left-3 top-3 px-3 py-2 sm:left-4 lg:left-6')}>
        <Link
          to="/admin-saas/dashboard"
          aria-label="RookHub — início"
          className="flex h-10 items-center rounded-2xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            aria-hidden="true"
            className="h-7 w-32 bg-[#010066]"
            style={{
              mask: "url('/logo/rookhub-full-white.svg') center / contain no-repeat",
              WebkitMask: "url('/logo/rookhub-full-white.svg') center / contain no-repeat",
            }}
          />
        </Link>
      </div>

      <div
        className={cn(
          floatingPanel,
          'absolute right-3 top-3 flex h-14 items-center gap-1 px-1.5 sm:right-4 lg:right-6',
        )}
      >
        <NotificationMenu />
        <span className="mx-0.5 h-6 w-px bg-on-surface/10" aria-hidden />
        <UserMenu />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Fechar navegação da plataforma' : 'Abrir navegação da plataforma'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </Button>
      </div>

      {menuOpen ? (
        <nav
          aria-label="Navegação da plataforma"
          className={cn(
            floatingPanel,
            'pointer-events-auto absolute right-3 top-20 w-[min(21rem,calc(100vw-1.5rem))] p-3 sm:right-4 lg:right-6',
          )}
        >
          <div className="mb-3 flex items-center justify-between px-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Plataforma RookHub
            </p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Fechar
            </button>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.label}>
                <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary text-on-primary'
                            : 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
