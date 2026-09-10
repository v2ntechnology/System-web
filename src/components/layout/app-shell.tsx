import { Outlet } from 'react-router';

import type { NavGroup } from '@/app/navigation';
import { AssistantDrawer } from '@/management/features/assistant/components/assistant-drawer';
import { useAssistantShortcut } from '@/management/features/assistant/use-assistant-shortcut';

import { AiLauncher } from './ai-launcher';
import { AppSidebar } from './app-sidebar';
import { MobileSidebar } from './mobile-sidebar';
import { Topbar } from './topbar';

/**
 * A casca do painel operacional.
 *
 * ⚠️ O assistente é o MESMO dos quatro perfis desde 09/09/2026, a pedido do
 * usuário. Antes daqui saía um caminho próprio: o atalho flutuante navegava
 * para `/app/ia`, uma tela que **fabricava a resposta em código** (texto fixo,
 * fontes fixas, histórico fixo), enquanto o dono e o gestor conversavam com o
 * `/v1/assistant/ask` de verdade pelo drawer. Dois assistentes, e o de cá não
 * era assistente nenhum.
 *
 * ⚠️ Importar do `management` aqui é de propósito, e não descuido. O drawer, o
 * store e o atalho são os mesmos objetos do outro painel: uma cópia local
 * divergiria na primeira correção, que é justamente o defeito que este bloco
 * existe para não repetir. A sessão atravessa porque
 * `management/features/auth/store` é uma ponte sobre o `session-store` único.
 */
export function AppShell({ navigation }: { navigation: NavGroup[] }) {
  /* Ctrl+K abre o assistente aqui também. O `title` do atalho flutuante já
     prometia o atalho antes de ele existir deste lado. */
  useAssistantShortcut();

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
      <AssistantDrawer />
    </div>
  );
}
