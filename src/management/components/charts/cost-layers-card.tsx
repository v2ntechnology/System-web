import type { CostPerKmPoint } from '@/management/types';
import { LightCard } from '@/management/ui';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartLegend, ChartTooltipShell, ChartViewToggle } from './chart-frame';

export interface CostLayersCardProps {
  data: CostPerKmPoint[];
  /** Título do painel. O dashboard e a tela de Custos usam recortes diferentes. */
  title?: string | undefined;
  /** Rótulo do recorte exibido ao lado da legenda. */
  periodLabel?: string | undefined;
  className?: string | undefined;
}

/**
 * Camadas do custo por km (RN-055).
 *
 * Ordem FIXA — a cor segue a camada, nunca a posição no ranking. A paleta foi
 * validada sobre a superfície clara: deutan ΔE 15.5 · tritan 11.6 · contraste ≥3:1.
 */
const SERIES = [
  { key: 'fuel', label: 'Combustível', color: 'var(--color-chart-1)' },
  { key: 'maintenance', label: 'Manutenção', color: 'var(--color-chart-2)' },
  { key: 'fixed', label: 'Custos fixos', color: 'var(--color-chart-3)' },
] as const;

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

function total(point: CostPerKmPoint) {
  return point.fuel + point.maintenance + point.fixed;
}

interface TooltipPayloadItem {
  dataKey?: string | number | undefined;
  value?: number | undefined;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean | undefined;
  payload?: TooltipPayloadItem[] | undefined;
  label?: string | undefined;
}) {
  if (!active || !payload?.length) return null;

  const sum = payload.reduce((acc, item) => acc + (item.value ?? 0), 0);

  return (
    <ChartTooltipShell
      label={label}
      rows={SERIES.flatMap((series) => {
        const item = payload.find((entry) => entry.dataKey === series.key);
        if (!item) return [];
        return [{ label: series.label, color: series.color, value: brl.format(item.value ?? 0) }];
      })}
      footer={{ label: 'Total', value: brl.format(sum) }}
    />
  );
}

/**
 * Camadas do custo por km, compartilhado entre a Visão geral e a tela de Custos.
 * Vive em `components/charts` para os dois consumirem sem import cruzado entre features.
 */
export function CostLayersCard({
  data,
  title = 'Custo por quilômetro',
  periodLabel = 'R$/km · últimos 12 meses',
  className,
}: CostLayersCardProps) {
  const [asTable, setAsTable] = useState(false);
  const latest = data[data.length - 1];

  return (
    <LightCard
      title={title}
      className={className}
      action={<ChartViewToggle asTable={asTable} onToggle={() => setAsTable((c) => !c)} />}
    >
      {/* Legenda com o valor mais recente — identidade nunca fica só na cor. */}
      <ChartLegend
        note={periodLabel}
        items={SERIES.map((series) => ({
          label: series.label,
          color: series.color,
          value: latest ? brl.format(latest[series.key]) : '—',
        }))}
      />

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-140 w-full text-left">
            <caption className="sr-only">{title} em camadas, por período</caption>
            <thead>
              <tr className="border-light-outline border-b">
                <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4">
                  Mês
                </th>
                {SERIES.map((series) => (
                  <th
                    key={series.key}
                    scope="col"
                    className="text-on-light-variant text-label-md py-2 pr-4 text-right"
                  >
                    {series.label}
                  </th>
                ))}
                <th scope="col" className="text-on-light-variant text-label-md py-2 text-right">
                  Total
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
                  {SERIES.map((series) => (
                    <td
                      key={series.key}
                      className="text-on-light-variant text-body-md py-2 pr-4 text-right"
                    >
                      {brl.format(point[series.key])}
                    </td>
                  ))}
                  <td className="text-on-light text-body-md py-2 text-right font-semibold">
                    {brl.format(total(point))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-75 sm:h-90 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {/* Grade recessiva: só horizontal, que é o eixo que se lê. */}
              <CartesianGrid
                vertical={false}
                stroke="var(--color-light-outline)"
                strokeDasharray="3 3"
              />
              {/* minTickGap: no mobile os 12 meses colidiam ("jan fev" colados). */}
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-light-outline)' }}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={20}
                dy={6}
              />
              {/* Ticks fixos em valores redondos — o passo automático caía em R$ 0,90. */}
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                domain={[0, 3.4]}
                ticks={[0, 1, 2, 3]}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                tickFormatter={(value: number) => brl.format(value)}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'var(--color-on-light-muted)', strokeWidth: 1 }}
              />
              {SERIES.map((series) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stackId="cost"
                  fill={series.color}
                  fillOpacity={0.9}
                  /* Filete da cor do painel: separa as faixas empilhadas. */
                  stroke="var(--color-light)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightCard>
  );
}
