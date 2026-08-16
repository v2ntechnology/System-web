import { TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';
import type { ExpenseCategory } from '@/management/types';
import { cn } from '@/management/ui';

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export interface ExpenseCardProps {
  category: ExpenseCategory;
  /** Placa em foco na página — a barra correspondente recebe destaque. */
  highlightPlate?: string | undefined;
  onSelectPlate?: (plate: string) => void;
}

/**
 * Despesa da categoria no período, com os três veículos que mais pesaram.
 *
 * As barras são proporcionais ao valor e cada uma exibe o número — dispensa eixo
 * e garante que a informação não dependa do comprimento da barra nem da cor.
 */
export function ExpenseCard({ category, highlightPlate, onSelectPlate }: ExpenseCardProps) {
  const max = Math.max(...category.ranking.map((entry) => entry.value), 1);
  const rising = category.deltaPercent > 0;
  const TrendIcon = rising ? TrendUpIcon : TrendDownIcon;

  /* Em despesa, subir é ruim — a semântica é invertida em relação a um KPI comum. */
  const trendTone = rising ? 'text-error' : 'text-success';

  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="text-on-surface-variant text-body-md">{category.label}</h3>

      <p className="tabular font-sora text-on-surface mt-1 text-[26px] font-bold leading-none">
        {brlCompact.format(category.total)}
      </p>

      <p className={cn('text-label-md mt-2 flex items-center gap-1 normal-case', trendTone)}>
        <TrendIcon size={14} weight="bold" aria-hidden="true" />
        {rising ? '+' : ''}
        {category.deltaPercent.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
        <span className="text-on-surface-muted">vs. período anterior</span>
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {category.ranking.map((entry) => {
          const active = entry.plate === highlightPlate;

          return (
            <li key={entry.plate}>
              <button
                type="button"
                onClick={() => onSelectPlate?.(entry.plate)}
                aria-label={`${entry.plate}: ${brlCompact.format(entry.value)} em ${category.label}`}
                className={cn(
                  'focus-visible:ring-secondary group block w-full rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                  active ? 'bg-white/8' : 'hover:bg-white/5',
                )}
              >
                <span className="mb-1 flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'tabular text-label-md normal-case',
                      active ? 'text-on-surface font-semibold' : 'text-on-surface-variant',
                    )}
                  >
                    {entry.plate}
                  </span>
                  <span className="tabular text-on-surface-muted text-label-md normal-case">
                    {brlCompact.format(entry.value)}
                  </span>
                </span>

                <span aria-hidden="true" className="bg-surface-high rounded-pill block h-1.5">
                  <span
                    className={cn(
                      'rounded-pill block h-full transition-colors',
                      active ? 'bg-primary' : 'bg-outline group-hover:bg-on-surface-muted',
                    )}
                    style={{ width: `${Math.max((entry.value / max) * 100, 6)}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
