import type { ResultPoint } from '@/management/types';
import { LightCard, StatusChip } from '@/management/ui';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipShell, ChartViewToggle } from '@/management/components/charts/chart-frame';

import { percent } from '@/management/lib/format';

interface TooltipPayloadItem {
  value?: number | undefined;
}

function MarginTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean | undefined;
  payload?: TooltipPayloadItem[] | undefined;
  label?: string | undefined;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;

  return (
    <ChartTooltipShell
      label={label}
      rows={[
        {
          label: 'Margem líquida',
          color: 'var(--color-chart-1)',
          value: percent(value),
        },
        { label: 'Situação', value: value >= 0 ? 'Lucro' : 'Prejuízo' },
      ]}
    />
  );
}

export interface MarginTrendCardProps {
  data: ResultPoint[];
  className?: string | undefined;
}

/**
 * Margem líquida mês a mês, em % da receita líquida.
 *
 * Série única: o título nomeia o que está plotado e a legenda seria redundante
 * (regra 8b exige legenda a partir de duas séries).
 *
 * A linha do zero é o que dá sentido ao gráfico — sem ela, um mês de -6% e um de
 * +6% parecem só "dois pontos em alturas diferentes".
 */
export function MarginTrendCard({ data, className }: MarginTrendCardProps) {
  const [asTable, setAsTable] = useState(false);
  const negatives = data.filter((point) => point.netMarginPercent < 0);

  return (
    <LightCard
      title="Margem líquida"
      className={className}
      action={<ChartViewToggle asTable={asTable} onToggle={() => setAsTable((c) => !c)} />}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {negatives.length > 0 ? (
          <StatusChip tone="critical" surface="light">
            {negatives.length === 1 ? '1 mês no prejuízo' : `${negatives.length} meses no prejuízo`}
          </StatusChip>
        ) : (
          <StatusChip tone="positive" surface="light">
            Todos os meses no lucro
          </StatusChip>
        )}
        <span className="text-on-light-muted text-label-md normal-case">
          % da receita líquida · últimos 12 meses
        </span>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-100 w-full text-left">
            <caption className="sr-only">Margem líquida por mês, em % da receita líquida</caption>
            <thead>
              <tr className="border-light-outline border-b">
                <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4">
                  Mês
                </th>
                <th
                  scope="col"
                  className="text-on-light-variant text-label-md py-2 pr-4 text-right"
                >
                  Margem
                </th>
                <th scope="col" className="text-on-light-variant text-label-md py-2 text-right">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((point) => (
                <tr key={point.month} className="border-light-outline/60 border-b last:border-0">
                  <th
                    scope="row"
                    className="text-on-light text-body-md py-2 pr-4 font-normal capitalize"
                  >
                    {point.month}
                  </th>
                  <td className="text-on-light text-body-md py-2 pr-4 text-right font-semibold">
                    {percent(point.netMarginPercent)}
                  </td>
                  <td className="text-on-light-variant text-body-md py-2 text-right">
                    {point.netMarginPercent >= 0 ? 'Lucro' : 'Prejuízo'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-75 sm:h-90 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-light-outline)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-light-outline)' }}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={20}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                content={<MarginTooltip />}
                cursor={{ stroke: 'var(--color-on-light-muted)', strokeWidth: 1 }}
              />
              {/* A fronteira entre lucro e prejuízo, marcada e rotulada. */}
              <ReferenceLine
                y={0}
                stroke="var(--color-on-light-muted)"
                strokeWidth={1}
                label={{
                  value: 'equilíbrio',
                  position: 'insideTopLeft',
                  fill: 'var(--color-on-light-muted)',
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="netMarginPercent"
                name="Margem líquida"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-chart-1)' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-light)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightCard>
  );
}
