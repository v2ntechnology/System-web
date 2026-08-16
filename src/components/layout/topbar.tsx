import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/sidebar-store';

import { Breadcrumbs } from './breadcrumbs';
import { GlobalSearch } from './global-search';
import { NotificationMenu } from './notification-menu';
import { UserMenu } from './user-menu';

export function Topbar() {
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <GlobalSearch className="hidden md:block" />
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}
