import {
  BlockedIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  PlayIcon,
  ShieldAlertIcon,
  VideoIcon,
} from '@/components/icons';
import type { ContestStatus, SafetyEvent, SafetySeverity } from '@/management/types';
import { GlassCard, LightCard, StatusChip, cn, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';

import { getSafetySummary } from '../api';
import { EventVideoDialog } from '../components/event-video-dialog';

const TABS = [
  { id: 'EVENTOS', label: 'Eventos' },
  { id: 'CONTESTACOES', label: 'Contestações' },
  { id: 'COPILOTO', label: 'Copiloto' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * A frase de comparação embaixo da nota.
 *
 * Compara taxa por mil quilômetros, e não contagem bruta de eventos: uma frota
 * que rodou o dobro no mês gera o dobro de eventos sem ter piorado nada. Sem a
 * normalização, todo mês de pico viraria alarme falso.
 */
function rateHint(atual: number | undefined, anterior: number | undefined): string {
  if (atual == null) return 'sem quilometragem no período';
  const taxa = atual.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (anterior == null || anterior === 0) return `${taxa} eventos por mil km`;

  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  if (variacao === 0) return `${taxa} por mil km, estável`;
  return `${taxa} por mil km, ${variacao > 0 ? '+' : ''}${variacao}% vs. período anterior`;
}

/**
 * O nome da grandeza vem do fornecedor, em inglês.
 *
 * Traduzido por tabela, e não por serviço: são poucos nomes e eles vêm do
 * catálogo da MiX, não de texto livre do cliente. O que não estiver aqui passa
 * como veio, que é melhor que sumir.
 */
const GRANDEZA: Record<string, string> = {
  deceleration: 'Desaceleração',
  acceleration: 'Aceleração',
  'engine rpm': 'Rotação do motor',
  'road speed': 'Velocidade',
  speed: 'Velocidade',
  duration: 'Duração',
  'engine speed': 'Rotação do motor',
  distance: 'Distância',
  'fuel used': 'Combustível',
};

/**
 * O que foi medido no evento, pronto para ler.
 *
 * Vazio quando o fornecedor não disse o que o número significa. Mostrar "Valor:
 * 2100" sem o nome e a unidade é pior que não mostrar: o usuário completa a
 * lacuna sozinho, e geralmente erra.
 */
function medida(event: SafetyEvent): string | null {
  if (event.value == null || !event.valueName) return null;
  const grandeza = GRANDEZA[event.valueName.toLowerCase()] ?? event.valueName;
  const numero = event.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${grandeza}: ${numero}${event.valueUnit ? ` ${event.valueUnit}` : ''}`;
}

const SEVERITY: Record<SafetySeverity, { label: string; tone: StatusTone }> = {
  CRITICO: { label: 'Crítico', tone: 'critical' },
  ATENCAO: { label: 'Atenção', tone: 'attention' },
  LEVE: { label: 'Leve', tone: 'neutral' },
};

const CONTEST_STATUS: Record<ContestStatus, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Aguardando decisão', tone: 'attention' },
  ACEITA: { label: 'Aceita — falso positivo', tone: 'positive' },
  RECUSADA: { label: 'Recusada', tone: 'critical' },
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function SafetyPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['safety'],
    queryFn: getSafetySummary,
  });

  const [tab, setTab] = useState<TabId>('EVENTOS');
  const [openEvent, setOpenEvent] = useState<SafetyEvent | null>(null);

  const critical = data?.events.filter((e) => e.severity === 'CRITICO').length ?? 0;
  const pending = data?.contests.filter((c) => c.status === 'PENDENTE').length ?? 0;

  return (
    <>
      <PageBanner
        size="inline"
        title="Segurança"
        description="Eventos na estrada, contestações dos motoristas e as câmeras que merecem atenção agora."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Resumo de segurança</h2>

        <QueryState isPending={isPending} isError={isError} label="os dados de segurança">
          {data ? (
            <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
              {[
                { label: 'Eventos no período', value: data.events.length },
                {
                  label: 'Críticos',
                  value: critical,
                  alert: critical > 0,
                  /* Zero aqui pode significar "ninguém dormiu ao volante" ou
                     "esta frota não tem câmera". São conclusões opostas, e sem
                     a distinção o gestor lê a segunda como a primeira. */
                  hint:
                    data.measuresCritical === false
                      ? 'nenhum equipamento desta frota gera este evento'
                      : 'sonolência, distração e colisão',
                },
                { label: 'Contestações abertas', value: pending, alert: pending > 0 },
                {
                  /*
                   * A nota é relativa à própria frota, então a comparação útil
                   * não é contra um alvo absoluto: é a taxa de eventos por mil
                   * quilômetros contra o período anterior. É ela que responde
                   * "melhoramos ou pioramos".
                   */
                  label: 'Score médio da frota',
                  value: data.fleetScore ?? '–',
                  hint: rateHint(data.eventsPer1000Km, data.eventsPer1000KmPrevious),
                },
              ].map((metric) => (
                <div key={metric.label} className="bg-surface-lowest min-w-0 rounded-lg p-4">
                  <p className="text-on-surface-variant text-label-md normal-case">
                    {metric.label}
                  </p>
                  <p
                    className={cn(
                      'tabular font-sora mt-2 text-[32px] font-bold leading-none',
                      metric.alert ? 'text-error' : 'text-on-surface',
                    )}
                  >
                    {metric.value}
                  </p>
                  {metric.hint ? (
                    <p className="text-success text-label-md mt-2 normal-case">{metric.hint}</p>
                  ) : null}
                </div>
              ))}
            </GlassCard>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((option) => ({
            ...option,
            count:
              option.id === 'EVENTOS'
                ? data?.events.length
                : option.id === 'CONTESTACOES'
                  ? pending
                  : data?.copilot.length,
          }))}
          value={tab}
          onValueChange={setTab}
          label="Seções de segurança"
        >
          <QueryState isPending={isPending} isError={isError} label="os dados de segurança">
            {data ? (
              <div className="pb-4">
                {/* ---------------------------------------------------------
                 * Eventos
                 * ------------------------------------------------------- */}
                {tab === 'EVENTOS' ? (
                  <LightCard title="Eventos na estrada">
                    <ul className="flex flex-col gap-3">
                      {data.events.map((event) => {
                        const severity = SEVERITY[event.severity];
                        return (
                          <li key={event.id} className="bg-surface-lowest rounded-lg p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-on-surface flex items-center gap-2 font-medium">
                                  <ShieldAlertIcon
                                    size={16}
                                    aria-hidden="true"
                                    className={
                                      event.severity === 'CRITICO' ? 'text-error' : 'text-warning'
                                    }
                                  />
                                  {event.typeLabel}
                                </p>
                                <p className="text-on-surface-variant text-body-md mt-1">
                                  {event.description}
                                  {/* O número medido só entra acompanhado do que
                                      ele mede e da unidade. "2100" sozinho não
                                      diz se são rotações, km/h ou segundos. */}
                                  {medida(event) ? (
                                    <span className="text-on-surface tabular">
                                      {' '}
                                      · {medida(event)}
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <StatusChip tone={severity.tone}>{severity.label}</StatusChip>
                            </div>

                            <div className="border-outline-variant mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                              <span className="text-on-surface-muted text-label-md normal-case">
                                {event.driverName}
                              </span>
                              <span className="tabular text-on-surface-muted text-label-md normal-case">
                                {event.plate}
                              </span>
                              <span className="text-on-surface-muted text-label-md normal-case">
                                {dateTime.format(new Date(event.at))}
                              </span>
                              <span className="text-on-surface-muted text-label-md normal-case">
                                {event.location}
                              </span>
                              {event.warned ? (
                                <StatusChip tone="attention">Advertência aplicada</StatusChip>
                              ) : null}

                              {event.media ? (
                                <button
                                  type="button"
                                  onClick={() => setOpenEvent(event)}
                                  className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-on-surface/5 px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2"
                                >
                                  <PlayIcon size={16} aria-hidden="true" />
                                  Ver vídeo ({event.media.durationSeconds}s)
                                </button>
                              ) : (
                                <span className="text-on-surface-muted text-label-md ml-auto normal-case">
                                  Sem câmera
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </LightCard>
                ) : tab === 'CONTESTACOES' ? (
                  /* -------------------------------------------------------
                   * Contestações (RF-029)
                   * ----------------------------------------------------- */
                  <LightCard
                    title="Contestações"
                    action={
                      pending > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {pending} aguardando
                        </StatusChip>
                      ) : null
                    }
                  >
                    <p className="text-on-light-variant text-body-md mb-4">
                      Quando o motorista contesta um evento, a decisão é do gestor — e fica no log
                      de auditoria com o motivo. Evento aceito vira falso positivo e sai do score.
                    </p>

                    <ul className="flex flex-col gap-3">
                      {data.contests.map((contest) => {
                        const status = CONTEST_STATUS[contest.status];
                        return (
                          <li key={contest.id} className="bg-surface-lowest rounded-lg p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-on-surface font-medium">{contest.eventLabel}</p>
                                <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                  {contest.driverName} ·{' '}
                                  <span className="tabular">{contest.plate}</span> ·{' '}
                                  {dateTime.format(new Date(contest.at))}
                                </p>
                              </div>
                              <StatusChip tone={status.tone}>{status.label}</StatusChip>
                            </div>

                            <blockquote className="border-outline-variant text-on-surface-variant text-body-md mt-3 border-l-2 pl-3 italic">
                              {contest.reason}
                            </blockquote>

                            {contest.decision ? (
                              <div className="border-outline-variant mt-3 border-t pt-3">
                                <p className="text-on-surface-muted text-label-md normal-case">
                                  {contest.decision.by} ·{' '}
                                  {dateTime.format(new Date(contest.decision.at))}
                                </p>
                                <p className="text-on-surface-variant text-body-md mt-1">
                                  {contest.decision.note}
                                </p>
                              </div>
                            ) : (
                              <div className="border-outline-variant mt-3 flex flex-wrap gap-2 border-t pt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toast.success('Contestação aceita', {
                                      description:
                                        'O evento vira falso positivo e sai do score. A decisão exige motivo e vai para o log de auditoria.',
                                    })
                                  }
                                  className="border-success/40 text-success text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                                >
                                  <CheckCircleIcon size={14} aria-hidden="true" />
                                  Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toast.info('Contestação recusada', {
                                      description:
                                        'A advertência é mantida. O motivo da recusa fica registrado.',
                                    })
                                  }
                                  className="border-error/40 text-error text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                                >
                                  <BlockedIcon size={14} aria-hidden="true" />
                                  Recusar
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </LightCard>
                ) : (
                  /* -------------------------------------------------------
                   * Copiloto do operador (RN-080 / DAT-04)
                   * ----------------------------------------------------- */
                  <LightCard title="Copiloto do operador">
                    <p className="text-on-light-variant text-body-md mb-2">
                      As câmeras com maior probabilidade de evento nas próximas horas, para o
                      operador priorizar quem olhar primeiro.
                    </p>
                    <p className="text-on-light-muted text-label-md mb-5 flex items-start gap-1.5 normal-case">
                      <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A ordem
                      vem de telemetria, jornada, horário e histórico — nunca de análise de imagem.
                      O RookHub não processa vídeo; a decisão continua sendo humana.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.copilot.map((camera) => (
                        <li
                          key={camera.vehicleId}
                          className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="tabular text-on-surface font-semibold">
                                {camera.plate}
                              </p>
                              <p className="text-on-surface-muted text-label-md mt-0.5 truncate normal-case">
                                {camera.driverName}
                              </p>
                            </div>
                            <VideoIcon
                              size={20}
                              className="text-on-surface-muted shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          <div className="mt-4">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className="text-on-surface-variant text-label-md normal-case">
                                Prioridade
                              </span>
                              <span className="tabular text-on-surface font-semibold">
                                {camera.riskScore}
                              </span>
                            </div>
                            <div
                              role="img"
                              aria-label={`Prioridade ${camera.riskScore} de 100`}
                              className="bg-surface-high rounded-pill h-1.5 overflow-hidden"
                            >
                              <div
                                className={cn(
                                  'rounded-pill h-full',
                                  camera.riskScore >= 75
                                    ? 'bg-error'
                                    : camera.riskScore >= 50
                                      ? 'bg-warning'
                                      : 'bg-secondary',
                                )}
                                style={{ width: `${camera.riskScore}%` }}
                              />
                            </div>
                          </div>

                          <ul className="mt-4 flex flex-col gap-1.5">
                            {camera.signals.map((signal) => (
                              <li
                                key={signal.label}
                                className="text-on-surface-variant text-label-md flex items-start gap-1.5 normal-case"
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'rounded-pill mt-1.5 size-1.5 shrink-0',
                                    signal.weight === 'ALTO' ? 'bg-error' : 'bg-warning',
                                  )}
                                />
                                {signal.label}
                                <span className="sr-only">
                                  — peso {signal.weight === 'ALTO' ? 'alto' : 'médio'}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <p className="border-outline-variant text-on-surface-muted text-label-md mt-auto flex items-center gap-1.5 border-t pt-3 normal-case">
                            <ClockIcon size={13} aria-hidden="true" />
                            {camera.hoursDriving.toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                            })}
                            h ao volante
                          </p>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>

      <EventVideoDialog
        event={openEvent}
        open={openEvent !== null}
        onOpenChange={(next) => (next ? undefined : setOpenEvent(null))}
      />
    </>
  );
}
