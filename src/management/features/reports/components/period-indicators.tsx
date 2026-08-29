import { TrendDownIcon, TrendUpIcon } from '@/components/icons';
import type { AnalyticsPeriod } from '@/management/types';
import { GlassCard, Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PERIOD_LABELS } from '@/management/components/layout/period-labels';

import { getReportIndicators } from '../api';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const brlPrecise = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');

/**
 * Visão executiva do período selecionado.
 *
 * Existe para responder "que números vou encontrar nesses relatórios?" antes de
 * o usuário exportar qualquer coisa.
 */
export function PeriodIndicators({ period }: { period: AnalyticsPeriod }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['report-indicators', period],
    queryFn: () => getReportIndicators(period),
  });

  if (isPending) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Spinner className="text-on-surface-muted size-6" label="Carregando os indicadores" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-error text-body-md py-10 text-center">
        Não foi possível carregar os indicadores do período.
      </p>
    );
  }

  const costFalling = data.costDelta < 0;
  const TrendIcon = costFalling ? TrendDownIcon : TrendUpIcon;

  const tiles = [
    {
      label: 'Custo por km',
      value: brlPrecise.format(data.costPerKm),
      hint: (
        /* Em custo, cair é bom — a semântica é invertida em relação a um KPI comum. */
        <span
          className={cn('flex items-center gap-1', costFalling ? 'text-success' : 'text-error')}
        >
          <TrendIcon size={12} aria-hidden="true" />
          {data.costDelta > 0 ? '+' : ''}
          {data.costDelta.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
        </span>
      ),
    },
    { label: 'Viagens concluídas', value: number.format(data.tripsCompleted) },
    { label: 'Eventos críticos', value: number.format(data.criticalEvents) },
    { label: 'Gasto com manutenção', value: brl.format(data.maintenanceCost) },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <GlassCard className="flex flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-on-surface-variant text-body-md">Disponibilidade da frota</h3>
          <span className="text-on-surface-muted text-label-md normal-case">
            % do tempo apta a rodar · {PERIOD_LABELS[period].toLowerCase()}
          </span>
        </div>

        <div className="mt-5 h-56 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.availability} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="availability-dark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-outline-variant)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-on-surface-muted)', fontSize: 12 }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                domain={[80, 100]}
                ticks={[80, 85, 90, 95, 100]}
                tick={{ fill: 'var(--color-on-surface-muted)', fontSize: 12 }}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-on-surface-muted)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'var(--color-surface-low)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 12,
                  color: 'var(--color-on-surface)',
                }}
                formatter={(value: unknown) =>
                  [
                    `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`,
                    'Disponibilidade',
                  ] as [string, string]
                }
              />
              <Area
                type="monotone"
                dataKey="availability"
                stroke="var(--secondary)"
                strokeWidth={2}
                fill="url(#availability-dark)"
                dot={{ r: 3, fill: 'var(--secondary)', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col p-5 sm:p-6">
        <h3 className="text-on-surface-variant text-body-md">Números do período</h3>

        <div className="mt-4 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-surface-lowest rounded-lg p-4">
              <p className="text-on-surface-variant text-label-md normal-case">{tile.label}</p>
              <p className="tabular font-sora text-on-surface mt-2 text-[28px] font-bold leading-none">
                {tile.value}
              </p>
              {tile.hint ? <p className="text-label-md mt-2 normal-case">{tile.hint}</p> : null}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
