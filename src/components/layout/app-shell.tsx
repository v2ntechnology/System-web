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
      {/* `relative`: é aqui que a barra de vidro se ancora. Ela saiu do fluxo
          para o conteúdo poder correr por baixo dela (ver `topbar.tsx`). */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {/* Sem largura máxima (decisão do usuário em 20/08/2026): o conteúdo
              acompanha a janela, e quem trabalha em monitor grande não fica com
              duas faixas vazias nas laterais.

              O recuo de cima é a altura da barra flutuante (56px) mais as duas
              folgas: sem ele a primeira linha da tela nasceria embaixo do vidro. */}
          <div className="w-full space-y-6 px-4 pb-8 pt-[5.25rem] sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AiLauncher />
    </div>
  );
}
