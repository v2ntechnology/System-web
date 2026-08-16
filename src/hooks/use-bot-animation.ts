import { useEffect, useRef, useState, type AnimationEvent } from 'react';

/** As 20 animações do atalho da IA; cada classe está em `styles/globals.css`. */
const BOT_ANIMATIONS = [
  'bot-anim-wave',
  'bot-anim-bounce',
  'bot-anim-spin',
  'bot-anim-wobble',
  'bot-anim-jelly',
  'bot-anim-peek',
  'bot-anim-heartbeat',
  'bot-anim-shake',
  'bot-anim-nod',
  'bot-anim-float',
  'bot-anim-flip',
  'bot-anim-pop',
  'bot-anim-swing',
  'bot-anim-rubber',
  'bot-anim-jump-spin',
  'bot-anim-blink',
  'bot-anim-dance',
  'bot-anim-rocket',
  'bot-anim-glitch',
  'bot-anim-orbit',
] as const;

/** Intervalo entre as animações espontâneas do atalho parado. */
const IDLE_INTERVAL_MS = 8000;

/** Sorteia um índice diferente do anterior para não repetir a mesma animação. */
function pickAnimationIndex(previous: number): number {
  const index = Math.floor(Math.random() * BOT_ANIMATIONS.length);
  return index === previous ? (index + 1) % BOT_ANIMATIONS.length : index;
}

/**
 * Vida do atalho flutuante da IA: uma animação a cada 8s parado, e uma quando o
 * ponteiro chega.
 *
 * Hook e não código solto porque os dois atalhos — o do painel operacional e o
 * do painel de gestão — precisam se mexer igual. Duas cópias divergiriam na
 * primeira correção, e é o mesmo botão para quem usa.
 *
 * As classes animam o elemento que as recebe, não o desenho de dentro: valem
 * para qualquer símbolo que o atalho carregue.
 */
export function useBotAnimation() {
  const [animation, setAnimation] = useState<string | null>(null);
  const lastIndex = useRef(-1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      lastIndex.current = pickAnimationIndex(lastIndex.current);
      setAnimation(BOT_ANIMATIONS[lastIndex.current] ?? BOT_ANIMATIONS[0]);
    }, IDLE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  /** Dispara uma animação, a menos que já haja uma correndo. */
  function play() {
    if (animation) return;
    lastIndex.current = pickAnimationIndex(lastIndex.current);
    setAnimation(BOT_ANIMATIONS[lastIndex.current] ?? BOT_ANIMATIONS[0]);
  }

  /* A guarda existe porque animação de elemento filho também borbulha até aqui. */
  function handleAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target === event.currentTarget) setAnimation(null);
  }

  return { animation, play, handleAnimationEnd };
}
