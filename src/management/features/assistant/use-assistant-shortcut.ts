import { useEffect } from 'react';

import { useAssistantStore } from './store';

/**
 * Atalho do assistente.
 *
 * ⚠️ **Ctrl+K, e só ele.** É o padrão de mercado para paleta de comando e é o
 * que o PRD especifica em RF-033.
 *
 * O Ctrl+R existiu aqui e foi REMOVIDO a pedido do usuário em 30/08/2026. Ele
 * sobrescrevia o "recarregar página" do navegador: `preventDefault` funciona, o
 * problema é outro. É um atalho que a pessoa já tem memorizado para outra coisa
 * há anos, e não há como avisá-la de que mudou. Quem apertava esperando
 * recarregar recebia um painel de conversa. Não repor.
 */
export function useAssistantShortcut() {
  const toggleAssistant = useAssistantStore((state) => state.toggleAssistant);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      if (event.key.toLowerCase() !== 'k') return;

      event.preventDefault();
      toggleAssistant();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleAssistant]);
}
