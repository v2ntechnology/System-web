import { ArrowRightIcon, InfoIcon } from '@/components/icons';
import { GlassCard, SpectrumButton, cn } from '@/management/ui';
import { Link } from 'react-router';

export interface ReadinessStripProps {
  vehiclesReady: number;
  vehiclesBlocked: number;
  vehiclesNoSignal?: number | undefined;
  driversReady: number;
  driversUnavailable: number;
  pendingReleases: number;
  awaitingOwner: number;
  openAnomalies: number;
  source: string;
}

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'neutral' | 'warning' | undefined;
}) {
  return (
    <div className="metric-tile">
      <p className="text-on-surface-variant text-label-md normal-case">{label}</p>
      <p
        className={cn(
          'tabular font-sora mt-2 text-[24px] font-bold leading-none',
          tone === 'warning' ? 'text-warning' : 'text-on-surface',
        )}
      >
        {value}
      </p>
      <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">{hint}</p>
    </div>
  );
}

/**
 * Prontidão da operação, sobre o grafite.
 *
 * A primeira pergunta do gestor pela manhã não é "como foi o mês" — é **o que
 * pode sair agora**. Por isso o número grande é o de ativos aptos, e a fila de
 * liberações vem colada nele: cada pedido parado é um caminhão parado.
 */
export function ReadinessStrip({
  vehiclesReady,
  vehiclesBlocked,
  vehiclesNoSignal,
  driversReady,
  driversUnavailable,
  pendingReleases,
  awaitingOwner,
  openAnomalies,
  source,
}: ReadinessStripProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
      <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
        <h3 className="text-on-surface-variant text-body-md">Prontos para sair agora</h3>

        <p className="tabular font-sora text-on-surface mt-2 text-[44px] font-bold leading-none">
          {vehiclesReady}
          {/* Margem, não espaço em branco: a 44px o espaço do texto some e sai
              "34caminhões". Mesmo tratamento do `StatTile`. */}
          <span className="text-on-surface-muted text-body-lg ml-1.5 font-normal">caminhões</span>
        </p>

        <p className="text-label-md mt-3 normal-case">
          {/* "Rodaram" e não "disponíveis": quem não aparece pode estar de folga,
              dirigindo sem se identificar ou apenas sem dado coletado ainda. */}
          <span className="text-on-surface-variant">{driversReady} motoristas rodaram</span>
          {vehiclesBlocked > 0 ? (
            <span className="text-warning">
              {' · '}
              {vehiclesBlocked} {vehiclesBlocked === 1 ? 'em manutenção' : 'em manutenção'}
            </span>
          ) : null}
          {vehiclesNoSignal ? (
            <span className="text-on-surface-muted">
              {' · '}
              {vehiclesNoSignal} sem sinal
            </span>
          ) : null}
        </p>

        {/* RN-121 — o número vem com a procedência colada nele. */}
        <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
          <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {source}
        </p>
      </GlassCard>

      <GlassCard className="grid min-w-0 gap-4 p-5 sm:grid-cols-3 sm:p-6">
        <Tile
          label="Liberações na fila"
          value={String(pendingReleases)}
          hint="aguardando sua decisão"
          tone={pendingReleases > 0 ? 'warning' : 'neutral'}
        />
        <Tile
          label="Com o proprietário"
          value={String(awaitingOwner)}
          hint="graves e pareceres enviados"
        />
        <Tile
          label="Anomalias sem parecer"
          value={String(openAnomalies)}
          hint="números que subiriam sem explicação"
          tone={openAnomalies > 0 ? 'warning' : 'neutral'}
        />
        {/* "Sem registro" e não "indisponível": inclui folga, quem dirigiu sem se
            identificar e quem ainda não teve dado coletado. Chamar de
            indisponibilidade daria 120 de 132 no primeiro dia de coleta. */}
        <Tile
          label="Motoristas sem registro"
          value={String(driversUnavailable)}
          hint="folga, sem identificação ou sem dado no período"
        />

        {pendingReleases > 0 ? (
          <div className="bg-warning/10 border-warning/30 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 sm:col-span-2">
            <p className="text-on-surface text-body-md min-w-0 flex-1">
              {pendingReleases === 1
                ? '1 ativo parado esperando liberação.'
                : `${pendingReleases} ativos parados esperando liberação.`}
            </p>
            <SpectrumButton asChild size="sm">
              <Link to="/gestao/liberacoes">
                Tratar fila
                <ArrowRightIcon size={16} aria-hidden="true" />
              </Link>
            </SpectrumButton>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
