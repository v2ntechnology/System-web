import type { NavGroup } from '@/app/navigation';
import { BrandLogo } from '@/components/shared/brand-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSidebarStore } from '@/stores/sidebar-store';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';

export function MobileSidebar({ navigation }: { navigation: NavGroup[] }) {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLogo />
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        </div>
        <ScrollArea className="flex-1">
          <SidebarNav navigation={navigation} onNavigate={() => setMobileOpen(false)} />
        </ScrollArea>
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
