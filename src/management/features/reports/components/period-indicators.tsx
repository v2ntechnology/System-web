import type { AnalyticsPeriod } from '@/management/types';
import { LightCard, Spinner } from '@/management/ui';
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
        <Spinner className="text-on-light-muted size-6" label="Carregando os indicadores" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-error-on-light text-body-md py-10 text-center">
        Não foi possível carregar os indicadores do período.
      </p>
    );
  }

  return (
    /*
     * ⚠️ **`LightCard`, e não `GlassCard`** (corrigido em 19/09/2026, relatado
     * pelo usuário). Este bloco mora dentro do `PageContent bg-light`, e o vidro
     * ali é branco sobre branco com o traço transparente: o card sumia, e o que
     * restava era um título solto flutuando no painel. É a regra que a memória já
     * registra, de trocar a FAMÍLIA DE TOKEN ao mover algo para dentro do painel
     * branco, e aqui ela valia também para a moldura.
     */
    <LightCard
      title="Disponibilidade da frota"
      action={
        <span className="text-on-light-muted text-label-md normal-case">
          % do tempo apta a rodar · {PERIOD_LABELS[period].toLowerCase()}
        </span>
      }
    >
      {/*
       * ⚠️ **`h-56` SEM `flex-1`.** Os dois juntos é que sumiam com o gráfico: o
       * card é uma coluna flex de altura automática, e `flex-1` traz
       * `flex-basis: 0%`, que vence a altura declarada. O item ficava com 0px,
       * medido na tela, e o Recharts, sem altura, não desenha nem o `svg`. O
       * sintoma era um cartão de 94px com título e mais nada.
       */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.availability} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="availability-dark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/*
             * ⚠️ **Tokens da família `light`, e não `surface`.** O gráfico mora
             * no painel branco: a grade em `outline-variant` e os rótulos em
             * `on-surface-muted` são do papel escuro, e aqui saíam quase
             * invisíveis. É a mesma troca de família que a moldura precisou.
             */}
            <CartesianGrid
              vertical={false}
              stroke="var(--color-light-outline)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
              dy={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[80, 100]}
              ticks={[80, 85, 90, 95, 100]}
              tick={{ fill: 'var(--color-on-light-muted)', fontSize: 12 }}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-on-light-muted)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--color-light)',
                border: '1px solid var(--color-light-outline)',
                borderRadius: 12,
                color: 'var(--color-on-light)',
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
    </LightCard>
  );
}
