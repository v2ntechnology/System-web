import logoMark from '@imgs/logoOfficialBranca.svg';

import { useAssistantStore } from '@/management/features/assistant/store';

/**
 * Atalho flutuante do "Pergunte à sua frota" (RF-033), no canto inferior direito
 * conforme o Figma. Ctrl+K abre o mesmo painel.
 *
 * ⚠️ NÃO se mexe sozinho. As 20 animações sorteadas a cada 8 segundos saíram em
 * 09/09/2026, a pedido do usuário: o atalho fica parado, e só responde ao
 * ponteiro pela escala do `hover`. O mesmo vale para o atalho do painel
 * operacional (`AiLauncher`), que era o par deste. *
 * ⚠️ Quem cresce no `hover` é o FUNDO, num `span` atrás do logo, e não o botão.
 * O motivo é de renderização: escalar um elemento que contém `<img>` faz o
 * navegador rasterizar o conteúdo uma vez e ampliar o bitmap, e o logo saía
 * borrado no hover (relatado pelo usuário em 09/09/2026). Com o `img` fora da
 * camada que escala, ele é desenhado no tamanho final e continua nítido.
 *
 * ⚠️ Por isso o `img` precisa de `relative`: o fundo é `absolute` e, sem
 * posicionamento, o logo seria pintado ATRÁS dele.
 */
export function AssistantFab() {
  const openAssistant = useAssistantStore((state) => state.openAssistant);
  const open = useAssistantStore((state) => state.open);

  return (
    <button
      type="button"
      onClick={openAssistant}
      aria-label="Abrir o assistente — Pergunte à sua frota"
      aria-haspopup="dialog"
      aria-expanded={open}
      title="Pergunte à sua frota (Ctrl+K)"
      className="focus-visible:ring-primary focus-visible:ring-offset-background group fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
    >
      <span
        aria-hidden="true"
        className="bg-primary-strong absolute inset-0 rounded-lg transition-transform group-hover:scale-105"
      />
      <img src={logoMark} alt="" aria-hidden="true" className="relative h-7 w-auto" />
    </button>
  );
}
