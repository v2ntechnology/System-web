import { InfoIcon } from '@/components/icons';
import { GlassCard, cn } from '@/management/ui';
import type { ReactNode } from 'react';

import { brl, brlWhole, km, percent, signedPoints } from '@/management/lib/format';

export interface OwnerKpiStripProps {
  netResult: number;
  netMarginPercent: number;
  netMarginDeltaPoints: number;
  revenue: number;
  costPerKm: number;
  kmDriven: number;
  source: string;
  /** Conteúdo extra à direita — a fila de aprovações, na visão geral. */
  aside?: ReactNode | undefined;
}

function Tile({
  label,
  value,
  hint,
  hintTone = 'muted',
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  hintTone?: 'muted' | 'positive' | 'negative' | undefined;
}) {
  return (
    <div className="metric-tile">
      <p className="text-on-surface-variant text-label-md normal-case">{label}</p>
      <p className="tabular font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            'text-label-sm mt-1.5 normal-case',
            hintTone === 'positive'
              ? 'text-success'
              : hintTone === 'negative'
                ? 'text-error'
                : 'text-on-surface-muted',
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Faixa de indicadores estratégicos, sobre o grafite.
 *
 * O resultado do período fica sozinho num card grande porque é o único número que
 * o dono precisa ver antes de qualquer clique. Os demais servem para explicá-lo.
 *
 * Vive em `features/owner` e não no layout: os rótulos e a leitura de sinal são
 * específicos da visão estratégica.
 */
export function OwnerKpiStrip({
  netResult,
  netMarginPercent,
  netMarginDeltaPoints,
  revenue,
  costPerKm,
  kmDriven,
  source,
  aside,
}: OwnerKpiStripProps) {
  const positive = netResult >= 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
      <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
        <h3 className="text-on-surface-variant text-body-md">
          {positive ? 'Resultado do período' : 'Prejuízo do período'}
        </h3>

        <p
          className={cn(
            'tabular font-sora mt-2 text-[44px] font-bold leading-none',
            positive ? 'text-on-surface' : 'text-error',
          )}
        >
          {brlWhole.format(netResult)}
        </p>

        <p className="text-label-md mt-3 normal-case">
          <span className={cn(positive ? 'text-success' : 'text-error')}>
            {percent(netMarginPercent)} de margem líquida
          </span>
          {netMarginDeltaPoints !== 0 ? (
            <span className="text-on-surface-muted">
              {' · '}
              {signedPoints(netMarginDeltaPoints)} vs. período anterior
            </span>
          ) : null}
        </p>

        {/* RN-121 — o número vem com a procedência colada nele. */}
        <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
          <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {source}
        </p>
      </GlassCard>

      <GlassCard className="grid min-w-0 gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        <Tile label="Receita bruta" value={brlWhole.format(revenue)} hint="fretes faturados" />
        <Tile
          label="Custo por km"
          value={brl.format(costPerKm)}
          hint="todas as categorias da DRE"
        />
        <Tile label="Km rodados" value={km.format(kmDriven)} hint="telemetria consolidada" />
        {aside ? <div className="min-w-0 sm:col-span-2 xl:col-span-3">{aside}</div> : null}
      </GlassCard>
    </div>
  );
}
