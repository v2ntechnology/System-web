import type { AnalyticsPeriod } from '@/management/types';
import { GlassCard, Spinner } from '@/management/ui';
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

/**
 * A disponibilidade da frota no período escolhido.
 *
 * Existe para responder "que números vou encontrar nesses relatórios?" antes de
 * o usuário exportar qualquer coisa.
 *
 * ⚠️ Os quatro números que moravam ao lado deste gráfico viraram os cards que
 * encostam na faixa (08/09/2026), como nas outras rotas do painel. Ficavam num
 * segundo `GlassCard` chamado "Números do período", que é exatamente o papel do
 * `HeroStats`: dois objetos com a mesma função, e o de cima aparecia depois.
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

  return (
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
  );
}
