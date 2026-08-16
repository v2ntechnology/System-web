import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface StatTileProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Cor do ícone. Identidade visual do indicador, não semântica de estado. */
  accent?: 'indigo' | 'cyan' | undefined;
  /** Unidade ou qualificador ao lado do número. */
  unit?: string | undefined;
  className?: string | undefined;
}

const accentStyles = {
  indigo: 'bg-primary/20 text-primary',
  cyan: 'bg-secondary/20 text-secondary',
} as const;

/**
 * Bloco escuro de indicador, usado dentro dos painéis claros do dashboard (Figma).
 *
 * O número é a informação — vem grande e em `tabular` para que a coluna de
 * indicadores alinhe (RNF-027).
 */
export function StatTile({
  label,
  value,
  icon,
  accent = 'indigo',
  unit,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'bg-surface-lowest flex flex-col justify-between gap-6 rounded-lg p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            accentStyles[accent],
          )}
        >
          {icon}
        </span>
        <span className="text-body-md text-on-surface-variant leading-tight">{label}</span>
      </div>

      <p className="tabular font-sora text-on-surface text-[40px] font-bold leading-none">
        {value}
        {unit ? (
          <span className="text-on-surface-muted text-body-md ml-1.5 font-normal">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}
