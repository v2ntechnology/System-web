import { CloseIcon, MenuIcon } from '@/components/icons';
import type { NavGroup } from '@/app/navigation';
import { useBrandAssets } from '@/components/shared/brand-assets';
import { Button } from '@/components/ui/button';
import { usePermissions, useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { NotificationMenu } from './notification-menu';
import { UserMenu } from './user-menu';

/*
 * ⚠️ As três classes abaixo são as MESMAS do `management/components/layout/app-nav.tsx`,
 * com uma troca só: a pastilha ativa é marinho, e não terracota.
 *
 * É o ponto do desenho (decisão do usuário em 14/09/2026): a área interna usa o
 * mesmo layout do painel do dono e do gestor, para quem já conhece um conhecer o
 * outro, e a cor é o que diz em qual dos dois você está. Copiar a classe em vez
 * de importar é deliberado: `app-nav` é do painel de gestão e lê a sessão de
 * empresa, que aqui não existe.
 */
const triggerClass =
  'rounded-pill text-body-md focus-visible:ring-primary focus-visible:ring-offset-surface flex items-center gap-1.5 px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const activeClass = 'bg-accent text-on-secondary font-medium';

const idleClass = 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.12]';

/**
 * Cabeçalho do backoffice SaaS.
 *
 * <h2>Mesmo layout do painel, cor diferente</h2>
 *
 * Marca à esquerda, navegação em pastilhas no meio, notificações e conta à
 * direita: é o desenho do `AppTopbar` da gestão, e não um segundo padrão.
 *
 * ⚠️ **A marca aqui é a `BRAND_DEV`**, a mesma torre das empresas com a rampa em
 * marinho. É o sinal de que você está na porta da equipe, `dev.rookhub.com.br`,
 * e não no painel de um cliente. Ela é ARQUIVO, e não a arte laranja tingida por
 * CSS: a máscara que existia aqui antes achatava o gradiente da torre num azul
 * chapado, que é exatamente o erro que `brand-assets.ts` documenta.
 *
 * ⚠️ **Os grupos viram uma fila só.** O backoffice tem três (Plataforma,
 * Comercial, Governança) e poucas telas em cada, e pastilha agrupada em menu
 * suspenso esconderia metade do produto atrás de um clique. Em telas estreitas,
 * onde a fila não cabe, o menu suspenso volta, e aí sim com os grupos, que é
 * onde o rótulo deles ajuda.
 */
export function SaasTopbar({ navigation }: { navigation: NavGroup[] }) {
  const { hasPermission } = usePermissions();
  const { user } = useSession();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  /* ⚠️ Pelo gancho, e não pela `BRAND_DEV` direta: dentro do `/admin-saas` ele
     já devolve a arte da equipe, e é ele que troca para a versão clara no tema
     escuro, onde a rampa marinho sumiria. */
  const brand = useBrandAssets();

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

  const items = groups.flatMap((group) => group.items);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    /* z-[1000]: o menu de conta abre dentro desta barra, e um contexto de
       empilhamento baixo aqui prenderia o z-index dele. */
    <header className="relative z-[1000]">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 xl:px-10">
        <Link
          to="/admin-saas/dashboard"
          aria-label="RookHub — início"
          className="focus-visible:ring-primary shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2"
        >
          <img
            src={brand.wordmark}
            alt="RookHub"
            draggable={false}
            className="h-7 w-auto select-none object-contain sm:h-8"
          />
        </Link>

        <nav
          aria-label="Navegação da plataforma"
          className="relative hidden flex-1 justify-center lg:flex"
        >
          <div className="flex items-center gap-1">
            {items.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(triggerClass, active ? activeClass : idleClass)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <NotificationMenu />
          <UserMenu />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={
              menuOpen ? 'Fechar navegação da plataforma' : 'Abrir navegação da plataforma'
            }
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          aria-label="Navegação da plataforma"
          className={cn(
            'bg-card/95 ring-on-surface/[0.07] absolute right-4 top-full z-10 w-[min(21rem,calc(100vw-2rem))]',
            'rounded-[24px] p-3 shadow-[0_18px_48px_-24px_rgba(28,26,24,0.34)] ring-1 backdrop-blur-xl lg:hidden',
          )}
        >
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.label}>
                <p className="text-on-surface-muted mb-1 px-2 text-xs font-medium">{group.label}</p>
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
                          active ? activeClass : idleClass,
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
