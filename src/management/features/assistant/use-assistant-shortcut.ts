import { useEffect } from 'react';

import { useAssistantStore } from './store';

/**
 * Atalhos do assistente.
 *
 * ⚠️ **Ctrl+R sobrescreve o "recarregar página" do navegador.** Foi pedido
 * explicitamente, e `preventDefault` funciona — mas é um atalho que o usuário já
 * tem memorizado para outra coisa, e não há como sinalizar a ele que mudou.
 *
 * Por isso Ctrl+K está registrado em paralelo: é o padrão de mercado para paleta
 * de comando e é o atalho que o PRD especifica em RF-033. Se o Ctrl+R incomodar
 * em uso real, apague a linha dele e nada mais muda.
 */
export function useAssistantShortcut() {
  const toggleAssistant = useAssistantStore((state) => state.toggleAssistant);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key !== 'r' && key !== 'k') return;

      event.preventDefault();
      toggleAssistant();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleAssistant]);
}
