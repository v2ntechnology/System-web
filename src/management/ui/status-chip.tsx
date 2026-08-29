import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export type StatusTone = 'neutral' | 'positive' | 'attention' | 'critical' | 'info';

export interface StatusChipProps {
  children: ReactNode;
  tone?: StatusTone | undefined;
  icon?: ReactNode | undefined;
  /** `light` para uso dentro de um `LightCard`; `dark` sobre o grafite. */
  surface?: 'dark' | 'light' | undefined;
  className?: string | undefined;
}

/**
 * Etiqueta de estado.
 *
 * O tom NUNCA é o único portador da informação — o texto sempre diz o estado, e
 * há slot para ícone. Os pares de cor mudam conforme a superfície: os semânticos
 * da marca são claros e ficam ilegíveis sobre o painel claro (ver `*-on-light`).
 */
const TONES: Record<StatusTone, { dark: string; light: string }> = {
  neutral: {
    dark: 'bg-on-surface/8 text-on-surface-variant',
    /* `on-light` e não preto fixo: o painel acompanha o tema, e um véu preto
       sobre ele no escuro não aparece. */
    light: 'bg-on-light/8 text-on-light-variant',
  },
  positive: {
    dark: 'bg-success/15 text-success',
    light: 'bg-success-on-light/12 text-success-on-light',
  },
  attention: {
    dark: 'bg-warning/15 text-warning',
    light: 'bg-warning-on-light/12 text-warning-on-light',
  },
  critical: {
    dark: 'bg-error/15 text-error',
    light: 'bg-error-on-light/12 text-error-on-light',
  },
  info: {
    dark: 'bg-info/15 text-info',
    light: 'bg-primary-on-light/12 text-primary-on-light',
  },
};

export function StatusChip({
  children,
  tone = 'neutral',
  icon,
  surface = 'dark',
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        'rounded-pill text-label-md inline-flex items-center gap-1.5 px-2.5 py-1 normal-case',
        TONES[tone][surface],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
