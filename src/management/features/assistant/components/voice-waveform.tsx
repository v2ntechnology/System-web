import { cn } from '@/management/ui';

import { useReducedMotion } from '@/management/hooks/use-reduced-motion';

/**
 * Alturas fixas das barras.
 *
 * Uma sequência escrita à mão, e não aleatória: com `Math.random()` o desenho
 * mudaria a cada render do React e a onda "saltaria" sem ninguém ter falado.
 */
const BARS = [
  0.3, 0.5, 0.75, 0.45, 0.3, 0.6, 0.9, 0.55, 0.35, 0.7, 0.5, 0.85, 1, 0.6, 0.4, 0.75, 0.55, 0.9,
  0.65, 0.45, 0.8, 0.5, 0.35, 0.6, 0.4, 0.7, 0.45, 0.3,
];

export interface VoiceWaveformProps {
  /** Anima as barras. Parado, o desenho vira só um indício do que a tela faz. */
  active?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Onda sonora do assistente por voz.
 *
 * É decoração de estado, não medição: por isso `aria-hidden`. Quem usa leitor de
 * tela recebe a mesma informação pelo texto ("Ouvindo…"), que é anunciado.
 *
 * ⚠️ A animação é inline (`style.animation`) porque a defasagem muda por barra.
 * Inline **não** herda a proteção do `motion-safe:` do Tailwind — quem pediu
 * menos movimento veria 28 barras pulsando mesmo assim. Daí o `useReducedMotion`
 * explícito: sem movimento, as alturas ficam paradas e ainda comunicam o estado.
 */
export function VoiceWaveform({ active = false, className }: VoiceWaveformProps) {
  const reducedMotion = useReducedMotion();
  const animated = active && !reducedMotion;

  return (
    <div aria-hidden="true" className={cn('flex h-6 items-center justify-center gap-1', className)}>
      {BARS.map((height, index) => (
        <span
          key={index}
          className={cn(
            'bg-secondary rounded-pill w-0.5 transition-[height,opacity] duration-300',
            active ? 'opacity-90' : 'opacity-40',
          )}
          style={{
            height: `${(active ? height : height * 0.4) * 100}%`,
            /* Defasagem por barra: sem ela as 28 pulsam em bloco, como um piscar. */
            animation: animated ? `pulse 1.1s ${index * 45}ms ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}
