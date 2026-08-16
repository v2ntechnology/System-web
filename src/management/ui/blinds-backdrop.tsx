import { GradientBlinds } from './gradient-blinds';
import { cn } from './lib/cn';
import { useNoBlur } from './lib/use-no-blur';

export interface BlindsBackdropProps {
  className?: string | undefined;
}

/**
 * Fundo do login: grafite #212121 e nada mais além das persianas em gradiente.
 *
 * O `mixBlendMode: lighten` do `<GradientBlinds />` é o que mantém a regra 1 de pé —
 * onde a persiana é escura, o pixel final continua sendo o #212121 da base.
 *
 * Em `:root.no-blur` o canvas nem chega a montar (FE-07) e sobra o grafite liso,
 * que é exatamente o fundo da aplicação inteira.
 */
export function BlindsBackdrop({ className }: BlindsBackdropProps) {
  const noBlur = useNoBlur();

  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-background pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      {noBlur ? null : (
        <GradientBlinds
          /*
           * A 100% o holofote apaga o texto do card por onde passa — e ele passa por
           * toda parte, já que segue o ponteiro. 40% preserva o desenho das persianas
           * e devolve o AA (regra 7).
           */
          className="absolute inset-0 opacity-40"
          gradientColors={['#06B6D4', '#6366F1']}
          angle={20}
          noise={0.5}
          blindCount={16}
          blindMinWidth={60}
          spotlightRadius={0.5}
          spotlightSoftness={1}
          spotlightOpacity={1}
          mouseDampening={0.15}
          distortAmount={0}
          shineDirection="left"
          mixBlendMode="lighten"
        />
      )}
    </div>
  );
}
