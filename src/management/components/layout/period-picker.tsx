import { CalendarIcon } from '@/components/icons';
import type { AnalyticsPeriod } from '@/management/types';
import { cn } from '@/management/ui';

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '30D', label: '30 dias' },
  { id: '3M', label: '3 meses' },
  { id: '6M', label: '6 meses' },
  { id: '12M', label: '12 meses' },
];

/**
 * Recorte temporal de toda a página.
 *
 * Vale para os indicadores, a prévia e o arquivo gerado — relatório sem período
 * declarado é meia informação, e o período viaja junto no cabeçalho do arquivo
 * (RN-121).
 */
export function PeriodPicker({
  value,
  onChange,
}: {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-on-surface-variant text-body-md flex items-center gap-2">
        <CalendarIcon size={18} aria-hidden="true" />
        Período
      </p>

      <div
        role="group"
        aria-label="Período dos relatórios"
        className="bg-surface-lowest rounded-pill flex gap-1 p-1"
      >
        {PERIODS.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-pill text-label-md focus-visible:ring-secondary px-3.5 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                active
                  ? 'bg-bright text-on-bright'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
