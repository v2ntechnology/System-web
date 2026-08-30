import { ChevronLeftIcon } from '@/components/icons';
import { Link } from 'react-router';

import type { NavGroup } from '@/app/navigation';
import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';

export function AppSidebar({ navigation }: { navigation: NavGroup[] }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  return (
    <aside
      className={cn(
        'relative hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out will-change-[width] lg:flex',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <Link to="/app/dashboard" aria-label="RookHub — início">
          {collapsed ? <RookMark /> : <BrandLogo />}
        </Link>
      </div>

      <Button
        variant="ghost"
        size="icon"
        /* ⚠️ Este é o único botão só-ícone que MANTÉM fundo no hover, e não é
           exceção à regra: ele monta em cima da borda da barra, e sem um fundo
           opaco o traço da divisa passa por dentro do desenho. O que a regra
           proíbe é o fundo APARECER no hover como realce; aqui ele já existe em
           repouso e só precisa continuar existindo. O hover:bg-sidebar anula o
           hover:bg-transparent que o botão herda de ghost + icon. Quem responde
           ao cursor continua sendo a cor do traço, via .acao-neutra. */
        className="absolute -right-3 top-8 z-20 h-7 w-7 -translate-y-1/2 rounded-full border border-sidebar-border bg-sidebar hover:bg-sidebar transition-colors duration-200"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <ChevronLeftIcon
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-300 ease-in-out',
            collapsed && 'rotate-180',
          )}
        />
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarNav navigation={navigation} collapsed={collapsed} />
      </div>

      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
