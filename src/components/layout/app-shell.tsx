import { Outlet } from 'react-router';

import type { NavGroup } from '@/app/navigation';

import { AiLauncher } from './ai-launcher';
import { AppSidebar } from './app-sidebar';
import { MobileSidebar } from './mobile-sidebar';
import { Topbar } from './topbar';

export function AppShell({ navigation }: { navigation: NavGroup[] }) {
  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <AppSidebar navigation={navigation} />
      <MobileSidebar navigation={navigation} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AiLauncher />
    </div>
  );
}
