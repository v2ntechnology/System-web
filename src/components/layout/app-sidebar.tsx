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
        className="absolute -right-3 top-8 z-20 h-7 w-7 -translate-y-1/2 rounded-full border border-sidebar-border bg-sidebar text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-foreground"
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
