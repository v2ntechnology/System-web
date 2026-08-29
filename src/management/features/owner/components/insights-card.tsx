import {
  ArrowRightIcon,
  InfoIcon,
  TrendDownIcon,
  TrendUpIcon,
  WarningIcon,
} from '@/components/icons';
import type { OwnerInsight, OwnerInsightTone } from '@/management/types';
import { LightCard, cn } from '@/management/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { brlWhole } from '@/management/lib/format';

/**
 * Estilo de cada tom sobre o painel claro.
 *
 * ⚠️ Os semânticos da marca (`success`, `error`) são claros por construção, para
 * funcionar sobre o grafite — aqui dariam ~2:1. Sobre o painel claro só entram os
 * `*-on-light` (regra 2b).
 */
const TONES: Record<
  OwnerInsightTone,
  { icon: ReactNode; text: string; chip: string; label: string }
> = {
  GANHO: {
    icon: <TrendUpIcon size={18} aria-hidden="true" />,
    text: 'text-success-on-light',
    chip: 'bg-success-on-light/12 text-success-on-light',
    label: 'Ganho',
  },
  ATENCAO: {
    icon: <WarningIcon size={18} aria-hidden="true" />,
    text: 'text-warning-on-light',
    chip: 'bg-warning-on-light/12 text-warning-on-light',
    label: 'Atenção',
  },
  PERDA: {
    icon: <TrendDownIcon size={18} aria-hidden="true" />,
    text: 'text-error-on-light',
    chip: 'bg-error-on-light/12 text-error-on-light',
    label: 'Perda',
  },
};

export interface InsightsCardProps {
  insights: OwnerInsight[];
  className?: string | undefined;
}

/**
 * Resumo analítico textual da visão do dono.
 *
 * É o coração da tela: o dono não deveria precisar interpretar gráfico para
 * saber onde está ganhando e onde está perdendo. Cada achado afirma o quê, a
 * causa, quanto custou e para onde ir resolver (RN-116) — e declara a
 * procedência do número (RN-121).
 */
export function InsightsCard({ insights, className }: InsightsCardProps) {
  return (
    <LightCard title="O que aconteceu no período" className={className}>
      {insights.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-8 text-center">
          Nenhum achado relevante no período selecionado.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {insights.map((insight) => {
            const tone = TONES[insight.tone];

            return (
              <li key={insight.id} className="bg-light-container rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {/* O tom nunca é o único portador: vem ícone e rótulo escrito. */}
                  <span
                    className={cn(
                      'rounded-pill text-label-md inline-flex items-center gap-1.5 px-2.5 py-1 normal-case',
                      tone.chip,
                    )}
                  >
                    {tone.icon}
                    {tone.label}
                  </span>

                  <span
                    className={cn(
                      'tabular text-label-md ml-auto font-semibold normal-case',
                      insight.impact >= 0 ? 'text-success-on-light' : 'text-error-on-light',
                    )}
                  >
                    {insight.impact >= 0 ? '+' : '−'}
                    {brlWhole.format(Math.abs(insight.impact))}
                  </span>
                </div>

                <h3 className="text-on-light mt-3 font-semibold">{insight.title}</h3>
                <p className="text-on-light-variant text-body-md mt-1.5">{insight.text}</p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {/* RN-121 — o número vem com a procedência colada nele. */}
                  <p className="text-on-light-muted text-label-md flex items-start gap-1.5 normal-case">
                    <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {insight.source}
                  </p>

                  {insight.action ? (
                    <Link
                      to={insight.action.to}
                      className="text-primary-on-light text-label-md focus-visible:ring-primary-on-light inline-flex items-center gap-1.5 rounded-md normal-case underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
                    >
                      {insight.action.label}
                      <ArrowRightIcon size={14} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LightCard>
  );
}
