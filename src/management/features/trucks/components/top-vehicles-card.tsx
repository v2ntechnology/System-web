import type { VehicleCostRank } from '@/management/types';
import { cn } from '@/management/ui';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export interface TopVehiclesCardProps {
  ranking: VehicleCostRank[];
  highlightPlate?: string | undefined;
  onSelectPlate?: (plate: string) => void;
}

/**
 * Pódio de custo acumulado (Figma).
 *
 * Barras verticais proporcionais, com o valor rotulado em cada uma — a altura é
 * reforço visual, não o portador da informação.
 */
export function TopVehiclesCard({ ranking, highlightPlate, onSelectPlate }: TopVehiclesCardProps) {
  const max = Math.max(...ranking.map((entry) => entry.value), 1);
  const total = ranking.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-on-surface-variant text-body-md">Top caminhões por custo</h3>
        <span className="text-on-surface-muted text-label-md normal-case">últimos 6 meses</span>
      </div>

      <p className="tabular font-sora text-on-surface mt-1 text-[26px] font-bold leading-none">
        {brl.format(total)}
      </p>
      <p className="text-on-surface-muted text-label-md mt-2 normal-case">
        Somando manutenção, combustível e multas dos três mais caros.
      </p>

      {/*
       * `items-stretch` (padrão), não `items-end`: alinhar ao fim tira o stretch dos
       * itens, o `h-full` do <li> vira altura de conteúdo e a altura percentual da
       * barra deixa de ter referência — as três saíam do mesmo tamanho.
       * O alinhamento à base é feito pelo `justify-end` dentro de cada item.
       */}
      <ul className="mt-6 flex min-h-44 flex-1 justify-center gap-4 sm:gap-6">
        {ranking.map((entry) => {
          const active = entry.plate === highlightPlate;
          const heightPercent = Math.max((entry.value / max) * 100, 18);

          return (
            <li key={entry.plate} className="flex min-w-0 flex-1 flex-col justify-end">
              <button
                type="button"
                onClick={() => onSelectPlate?.(entry.plate)}
                aria-label={`${entry.plate}: ${brl.format(entry.value)} acumulados`}
                className="focus-visible:ring-secondary group flex h-full flex-col justify-end rounded-md focus-visible:outline-none focus-visible:ring-2"
              >
                <span
                  className={cn(
                    'tabular text-label-md mb-1.5 block text-center normal-case',
                    active ? 'text-on-surface font-semibold' : 'text-on-surface-muted',
                  )}
                >
                  {brl.format(entry.value)}
                </span>

                <span
                  aria-hidden="true"
                  className={cn(
                    'flex items-end justify-center rounded-md pb-2 transition-colors',
                    active
                      ? 'bg-primary'
                      : 'bg-surface-lowest group-hover:bg-surface-high border-outline-variant border',
                  )}
                  style={{ height: `${heightPercent}%`, minHeight: 56 }}
                >
                  <span
                    className={cn(
                      'tabular text-label-md truncate px-1 normal-case',
                      active ? 'text-on-primary font-semibold' : 'text-on-surface-variant',
                    )}
                  >
                    {entry.plate}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
