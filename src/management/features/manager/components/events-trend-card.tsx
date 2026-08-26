import type { OperationalTrendPoint } from '@/management/types';
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

/**
 * Ordem FIXA das séries — a cor segue a série, nunca a contagem da semana.
 *
 * Três séries na mesma unidade (ocorrências), num eixo só. Filtrar uma delas não
 * pode repintar as outras duas.
 */
const SERIES = [
  { key: 'fatigue', label: 'Sonolência', color: 'var(--color-chart-1)' },
  /* Nao existe desvio de rota: a telemetria nao sabe para onde o caminhao
     deveria estar indo. Conducao brusca e medida de verdade. */
  { key: 'harshDriving', label: 'Condução brusca', color: 'var(--color-chart-2)' },
  { key: 'speeding', label: 'Excesso de velocidade', color: 'var(--color-chart-3)' },
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

  const total = payload.reduce((acc, item) => acc + (item.value ?? 0), 0);

  return (
    <ChartTooltipShell
      label={label}
      rows={SERIES.flatMap((series) => {
        const item = payload.find((entry) => entry.dataKey === series.key);
        if (!item) return [];
        return [{ label: series.label, color: series.color, value: String(item.value ?? 0) }];
      })}
      footer={{ label: 'Total', value: String(total) }}
    />
  );
}

export interface EventsTrendCardProps {
  data: OperationalTrendPoint[];
  className?: string | undefined;
}

/**
 * Eventos de risco por semana (visão do gestor).
 *
 * É o gráfico que diz se a tratativa está funcionando: excesso de velocidade
 * caindo semana a semana é resultado de advertência aplicada; sonolência subindo
 * é escala mal distribuída, e vira parecer.
 */
export function EventsTrendCard({ data, className }: EventsTrendCardProps) {
  const [asTable, setAsTable] = useState(false);
  const latest = data[data.length - 1];

  return (
    <LightCard
      title="Eventos de risco"
      className={className}
      action={<ChartViewToggle asTable={asTable} onToggle={() => setAsTable((c) => !c)} />}
    >
      <ChartLegend
        note="ocorrências por semana"
        items={SERIES.map((series) => ({
          label: series.label,
          color: series.color,
          value: latest ? String(latest[series.key]) : '—',
        }))}
      />

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-120 w-full text-left">
            <caption className="sr-only">Eventos de risco por semana, por tipo</caption>
            <thead>
              <tr className="border-light-outline border-b">
                <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4">
                  Semana
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
                <tr key={point.label} className="border-light-outline/60 border-b last:border-0">
                  <th scope="row" className="text-on-light text-body-md py-2 pr-4 font-normal">
                    {point.label}
                  </th>
                  {SERIES.map((series) => (
                    <td
                      key={series.key}
                      className="text-on-light-variant text-body-md py-2 pr-4 text-right"
                    >
                      {point[series.key]}
                    </td>
                  ))}
                  <td className="text-on-light text-body-md py-2 text-right font-semibold">
                    {point.fatigue + point.harshDriving + point.speeding}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-70 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {/* Grade recessiva: só horizontal, que é o eixo que se lê. */}
              <CartesianGrid
                vertical={false}
                stroke="var(--color-light-outline)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-light-outline)' }}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
                dy={6}
              />
              {/* Contagem inteira: passo fracionário num eixo de ocorrências é ruído. */}
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
                tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
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
                  dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-light)' }}
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
