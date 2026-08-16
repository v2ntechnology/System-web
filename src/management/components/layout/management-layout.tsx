import { Outlet } from 'react-router';

import { AssistantDialog } from '@/management/features/assistant/components/assistant-dialog';
import { useAssistantShortcut } from '@/management/features/assistant/use-assistant-shortcut';

import { AssistantFab } from './assistant-fab';

/**
 * Casca de todas as telas autenticadas do painel de gestão.
 *
 * Cada página traz o próprio `PageBanner` (que já contém a navegação), porque a
 * faixa superior muda bastante entre a visão geral e as listas.
 *
 * ⚠️ `management-theme` não é decoração: é a classe que troca os tokens em
 * conflito com o tema do System-web (ver `management/styles/theme.css`). Toda
 * tela do painel precisa estar dentro dela, senão herda a paleta do painel
 * operacional e o vidro perde a base escura.
 */
export function ManagementLayout() {
  useAssistantShortcut();

  return (
    <div className="management-theme bg-surface min-h-dvh">
      <Outlet />
      <AssistantFab />
      <AssistantDialog />
    </div>
  );
}
