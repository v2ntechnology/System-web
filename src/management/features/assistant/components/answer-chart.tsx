import type { AssistantAnswer } from '@/management/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Gráfico embutido na resposta do assistente (RN-116).
 *
 * Série única em todos os casos: a resposta a uma pergunta é uma leitura, não um
 * painel. Sem série múltipla não há legenda a fazer — o título da resposta já
 * nomeia o que está no eixo.
 */
export function AnswerChart({ chart }: { chart: NonNullable<AssistantAnswer['chart']> }) {
  const series = chart.series[0];
  if (!series) return null;

  const data = series.data.map((point) => ({ x: point.x, y: point.y }));
  const isCurrency = chart.unit.startsWith('R$');

  const format = (value: number) =>
    isCurrency
      ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : `${value.toLocaleString('pt-BR')}`;

  const axisTick = { fill: 'var(--color-on-surface-muted)', fontSize: 12 };
  const gridStroke = 'var(--color-outline-variant)';

  return (
    <figure className="mt-4">
      <figcaption className="text-on-surface-muted text-label-md mb-2 normal-case">
        {series.label} · {chart.unit}
      </figcaption>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === 'bar' ? (
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={axisTick} dy={4} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={isCurrency ? 64 : 40}
                tick={axisTick}
                tickFormatter={format}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{
                  background: 'var(--color-surface-lowest)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 12,
                  color: 'var(--color-on-surface)',
                }}
                formatter={(value: unknown) =>
                  [format(Number(value)), series.label] as [string, string]
                }
              />
              {/* Extremidade arredondada e ancorada na linha de base. */}
              <Bar
                dataKey="y"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={axisTick} dy={4} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={isCurrency ? 64 : 40}
                tick={axisTick}
                tickFormatter={format}
                domain={['dataMin - 0.15', 'dataMax + 0.15']}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-on-surface-muted)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'var(--color-surface-lowest)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 12,
                  color: 'var(--color-on-surface)',
                }}
                formatter={(value: unknown) =>
                  [format(Number(value)), series.label] as [string, string]
                }
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="var(--secondary)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--secondary)', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
