import type { ResultPoint } from '@/management/types';
import { LightCard } from '@/management/ui';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartLegend,
  ChartTooltipShell,
  ChartViewToggle,
} from '@/management/components/charts/chart-frame';

import { brlCompact, brlWhole } from '@/management/lib/format';

/**
 * Ordem FIXA das séries — a cor segue a série, nunca a posição no ranking.
 *
 * Duas séries na mesma unidade (R$), num eixo só. A distância vertical entre as
 * linhas **é** o resultado do mês: é isso que o dono lê sem precisar de um
 * terceiro gráfico. Dois eixos Y aqui destruiriam essa leitura.
 */
const SERIES = [
  { key: 'revenue', label: 'Receita bruta', color: 'var(--color-chart-1)' },
  { key: 'cost', label: 'Custo operacional', color: 'var(--color-chart-2)' },
] as const;

interface TooltipPayloadItem {
  dataKey?: string | number | undefined;
  value?: number | undefined;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean | undefined;
  payload?: TooltipPayloadItem[] | undefined;
  label?: string | undefined;
}) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((item) => item.dataKey === 'revenue')?.value ?? 0;
  const cost = payload.find((item) => item.dataKey === 'cost')?.value ?? 0;

  return (
    <ChartTooltipShell
      label={label}
      rows={SERIES.flatMap((series) => {
        const item = payload.find((entry) => entry.dataKey === series.key);
        if (!item) return [];
        return [
          { label: series.label, color: series.color, value: brlWhole.format(item.value ?? 0) },
        ];
      })}
      footer={{ label: 'Diferença', value: brlWhole.format(revenue - cost) }}
    />
  );
}

export interface ResultTrendCardProps {
  data: ResultPoint[];
  className?: string | undefined;
}

/**
 * Receita contra custo, mês a mês (visão do dono).
 *
 * A série é sempre de 12 meses, independente do período agregado da página: um
 * recorte de 30 dias renderizaria um gráfico de um ponto só. O rótulo declara o
 * recorte para que ninguém confunda com o período dos indicadores.
 */
export function ResultTrendCard({ data, className }: ResultTrendCardProps) {
  const [asTable, setAsTable] = useState(false);
  const latest = data[data.length - 1];

  return (
    <LightCard
      title="Receita e custo"
      className={className}
      action={<ChartViewToggle asTable={asTable} onToggle={() => setAsTable((c) => !c)} />}
    >
      <ChartLegend
        note="últimos 12 meses"
        items={SERIES.map((series) => ({
          label: series.label,
          color: series.color,
          value: latest ? brlWhole.format(latest[series.key]) : '—',
        }))}
      />

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-140 w-full text-left">
            <caption className="sr-only">
              Receita bruta, custo operacional e resultado por mês
            </caption>
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
                  Diferença
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
                      {brlWhole.format(point[series.key])}
                    </td>
                  ))}
                  <td className="text-on-light text-body-md py-2 text-right font-semibold">
                    {brlWhole.format(point.revenue - point.cost)}
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
              {/* Grade recessiva: só horizontal, que é o eixo que se lê. */}
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
                width={72}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                tickFormatter={brlCompact}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: 'var(--color-on-light-muted)', strokeWidth: 1 }}
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-light)' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightCard>
  );
}
