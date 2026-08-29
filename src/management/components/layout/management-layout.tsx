import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { AssistantDialog } from '@/management/features/assistant/components/assistant-dialog';
import { useAssistantShortcut } from '@/management/features/assistant/use-assistant-shortcut';
import { Spinner } from '@/management/ui';

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
      {/*
       * Limite de suspense **único** do painel, e não um por rota (ver
       * `routes.tsx`). Como ele já existe quando a navegação começa, o React
       * mantém a tela atual no ar até o próximo módulo chegar, em vez de trocar
       * tudo por um spinner. O fallback abaixo só aparece na primeira entrada no
       * painel, quando ainda não há tela anterior para segurar.
       */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      <AssistantFab />
      <AssistantDialog />
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="text-on-surface-muted flex min-h-dvh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
