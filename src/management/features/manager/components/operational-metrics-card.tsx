import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@phosphor-icons/react';
import type { OperationalMetric } from '@/management/types';
import { LightCard, cn } from '@/management/ui';

export interface OperationalMetricsCardProps {
  metrics: OperationalMetric[];
  periodLabel: string;
  className?: string | undefined;
}

/**
 * Indicadores de desempenho operacional (visão do gestor).
 *
 * A direção do bem e do mal muda por indicador: fadiga que sobe é ruim,
 * disponibilidade que sobe é boa. Quem decide a cor é o `lowerIsBetter` do
 * próprio indicador — pintar toda alta de verde é o erro clássico deste painel.
 *
 * A seta nunca vai sozinha: vem sempre com o número assinado ao lado, porque
 * direção comunicada só por cor não chega a quem não distingue vermelho e verde.
 */
export function OperationalMetricsCard({
  metrics,
  periodLabel,
  className,
}: OperationalMetricsCardProps) {
  return (
    <LightCard
      title="Desempenho operacional"
      className={className}
      action={<span className="text-on-light-muted text-label-md normal-case">{periodLabel}</span>}
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const stable = metric.delta === 0;
          const worse = metric.lowerIsBetter ? metric.delta > 0 : metric.delta < 0;

          return (
            <li key={metric.id} className="bg-light-container min-w-0 rounded-lg p-4">
              <p className="text-on-light-variant text-label-md normal-case">{metric.label}</p>

              <p className="mt-2 flex items-baseline gap-2">
                <span className="tabular font-sora text-on-light text-[28px] font-bold leading-none">
                  {metric.value.toLocaleString('pt-BR')}
                  {metric.unit ? (
                    <span className="text-on-light-muted text-body-md font-normal">
                      {metric.unit}
                    </span>
                  ) : null}
                </span>

                <span
                  className={cn(
                    'tabular text-label-md flex items-center gap-0.5 normal-case',
                    stable
                      ? 'text-on-light-muted'
                      : worse
                        ? 'text-error-on-light'
                        : 'text-success-on-light',
                  )}
                >
                  {stable ? (
                    <MinusIcon size={12} weight="bold" aria-hidden="true" />
                  ) : metric.delta > 0 ? (
                    <ArrowUpIcon size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <ArrowDownIcon size={12} weight="bold" aria-hidden="true" />
                  )}
                  {metric.delta > 0 ? '+' : ''}
                  {metric.delta.toLocaleString('pt-BR')}
                  {metric.unit ?? ''}
                </span>
              </p>

              <p className="text-on-light-muted text-label-md mt-2 normal-case">{metric.hint}</p>
            </li>
          );
        })}
      </ul>

      <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
        Variação contra o período anterior. Telemetria, checklists e controle de jornada.
      </p>
    </LightCard>
  );
}
