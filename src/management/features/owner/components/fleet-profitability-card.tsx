import { MedalIcon } from '@/components/icons';
import type { FleetProfitability } from '@/management/types';
import { DataTable, LightCard, StatusChip, cn, type Column } from '@/management/ui';
import { useState } from 'react';

import { ChartViewToggle } from '@/management/components/charts/chart-frame';

import { brl, brlWhole, km, percent } from '@/management/lib/format';

/** Ouro, prata e bronze. Fora do pódio, o indicador some. */
const MEDAL: Record<number, { color: string; label: string }> = {
  1: { color: 'text-[#B8860B]', label: '1º lugar' },
  2: { color: 'text-[#6E7480]', label: '2º lugar' },
  3: { color: 'text-[#8A5A2B]', label: '3º lugar' },
};

export interface FleetProfitabilityCardProps {
  fleet: FleetProfitability[];
  periodLabel: string;
  className?: string | undefined;
}

/**
 * Frotas mais rentáveis (gamificação do ativo).
 *
 * Ranking por **resultado**, não por receita: o caminhão que mais fatura pode ser
 * o que menos sobra. A barra é reforço visual da magnitude — o valor vem
 * rotulado em texto em toda linha.
 *
 * As medalhas usam tons escurecidos do ouro/prata/bronze: os tons vivos do pódio
 * escuro (#F4C430) dão ~1,8:1 sobre o painel claro.
 */
export function FleetProfitabilityCard({
  fleet,
  periodLabel,
  className,
}: FleetProfitabilityCardProps) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...fleet.map((entry) => Math.abs(entry.result)), 1);

  const columns: Column<FleetProfitability>[] = [
    {
      key: 'position',
      header: '#',
      sortValue: (row) => row.position,
      cell: (row) => <span className="tabular">{row.position}</span>,
    },
    {
      key: 'plate',
      header: 'Placa',
      sortValue: (row) => row.plate,
      cell: (row) => <span className="tabular font-semibold">{row.plate}</span>,
    },
    { key: 'model', header: 'Modelo', hideOnMobile: true, sortValue: (row) => row.model },
    {
      key: 'km',
      header: 'Km rodados',
      align: 'right',
      hideOnMobile: true,
      sortValue: (row) => row.kmDriven,
      cell: (row) => km.format(row.kmDriven),
    },
    {
      key: 'revenue',
      header: 'Receita',
      align: 'right',
      hideOnMobile: true,
      sortValue: (row) => row.revenue,
      cell: (row) => brlWhole.format(row.revenue),
    },
    {
      key: 'cost',
      header: 'Custo',
      align: 'right',
      hideOnMobile: true,
      sortValue: (row) => row.cost,
      cell: (row) => brlWhole.format(row.cost),
    },
    {
      key: 'result',
      header: 'Resultado',
      align: 'right',
      sortValue: (row) => row.result,
      cell: (row) => (
        <span
          className={cn(
            'font-semibold',
            row.result >= 0 ? 'text-success-on-light' : 'text-error-on-light',
          )}
        >
          {brlWhole.format(row.result)}
        </span>
      ),
    },
    {
      key: 'margin',
      header: 'Margem',
      align: 'right',
      sortValue: (row) => row.marginPercent,
      cell: (row) => percent(row.marginPercent),
    },
  ];

  return (
    <LightCard
      title="Frotas mais rentáveis"
      className={className}
      action={<ChartViewToggle asTable={asTable} onToggle={() => setAsTable((c) => !c)} />}
    >
      {asTable ? (
        <DataTable
          columns={columns}
          rows={fleet}
          rowKey={(row) => row.vehicleId}
          caption="Rentabilidade por veículo no período, ordenada por resultado"
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {fleet.map((entry) => {
            const medal = MEDAL[entry.position];
            const width = Math.max((Math.abs(entry.result) / max) * 100, 3);
            const negative = entry.result < 0;

            return (
              <li key={entry.vehicleId} className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="tabular text-on-light-muted text-label-md w-4 shrink-0 normal-case">
                      {entry.position}
                    </span>
                    <span className="tabular text-on-light font-semibold">{entry.plate}</span>
                    <span className="text-on-light-muted text-label-md truncate normal-case">
                      {entry.model}
                    </span>
                    {medal ? (
                      <MedalIcon
                        size={18}
                        className={cn('shrink-0', medal.color)}
                        aria-label={medal.label}
                      />
                    ) : null}
                  </p>

                  <p className="flex items-baseline gap-3">
                    {/* Resultado ÷ km, não receita − custo: o primeiro já desconta
                        os impostos sobre o frete, o segundo não — e os dois números
                        lado a lado numa tela só não podem divergir. */}
                    <span className="tabular text-on-light-muted text-label-md normal-case">
                      {brl.format(entry.result / entry.kmDriven)}/km
                    </span>
                    <span
                      className={cn(
                        'tabular font-semibold',
                        negative ? 'text-error-on-light' : 'text-on-light',
                      )}
                    >
                      {brlWhole.format(entry.result)}
                    </span>
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-light-container rounded-pill h-2.5 min-w-0 flex-1 overflow-hidden"
                  >
                    <span
                      className={cn(
                        'rounded-pill block h-full',
                        negative ? 'bg-error-on-light' : 'bg-chart-1',
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </span>

                  {/* Margem negativa não é "só um número menor" — é etiqueta. */}
                  {negative ? (
                    <StatusChip tone="critical" surface="light">
                      {percent(entry.marginPercent)}
                    </StatusChip>
                  ) : (
                    <span className="tabular text-on-light-variant text-label-md w-16 shrink-0 text-right normal-case">
                      {percent(entry.marginPercent)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
        Resultado = receita líquida do veículo menos o custo rateado · {periodLabel}
      </p>
    </LightCard>
  );
}
