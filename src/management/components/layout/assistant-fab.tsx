import logoMark from '@imgs/logoOfficialBranca.svg';

import { useBotAnimation } from '@/hooks/use-bot-animation';
import { cn } from '@/management/ui';

import { useAssistantStore } from '@/management/features/assistant/store';

/**
 * Atalho flutuante do "Pergunte à sua frota" (RF-033), no canto inferior direito
 * conforme o Figma. Ctrl+K abre o mesmo painel.
 *
 * Compartilha `useBotAnimation` com o atalho do painel operacional: os dois são
 * o mesmo botão para quem usa, e precisam se mexer igual.
 */
export function AssistantFab() {
  const openAssistant = useAssistantStore((state) => state.openAssistant);
  const open = useAssistantStore((state) => state.open);
  const { animation, play, handleAnimationEnd } = useBotAnimation();

  return (
    <button
      type="button"
      onClick={openAssistant}
      onMouseEnter={play}
      onFocus={play}
      aria-label="Abrir o assistente — Pergunte à sua frota"
      aria-haspopup="dialog"
      aria-expanded={open}
      title="Pergunte à sua frota (Ctrl+K)"
      className="bg-primary-strong focus-visible:ring-secondary focus-visible:ring-offset-background fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
    >
      <span className={cn('flex', animation)} onAnimationEnd={handleAnimationEnd}>
        <img src={logoMark} alt="" aria-hidden="true" className="h-7 w-auto" />
      </span>
    </button>
  );
}
