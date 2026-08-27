import { GaugeIcon, MapPinIcon, WarningIcon } from '@/components/icons';
import type { VehiclePosition } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import { VehicleStatusChip } from '@/management/features/trucks/vehicle-status';

import { getEventHeatmap, getVehiclePositions, getVehicleTrack } from '../api';
import { FleetMap } from '../components/fleet-map';
import { TrackReplay } from '../components/track-replay';

/** RN-140 — integração parada há mais de 30 minutos vira aviso explícito. */
const STALE_SYNC_MINUTES = 30;

const isStale = (vehicle: VehiclePosition) =>
  (Date.now() - new Date(vehicle.lastSyncAt).getTime()) / 60_000 > STALE_SYNC_MINUTES;

/**
 * Janelas da rota.
 *
 * 72h e o teto do backend, e nao um numero redondo: e a unica consulta que toca
 * a serie bruta de posicoes, com 2.863 leituras por veiculo por dia.
 */
const TRACK_WINDOWS = [
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 72, label: '72h' },
] as const;

const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function LiveMapPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-positions'],
    queryFn: getVehiclePositions,
    /* Sem WebSocket ainda (FE-11), o polling é o que mantém a posição viva. */
    refetchInterval: 4000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Janela da rota, em horas.
   *
   * O backend recusa acima de 72 porque esta é a única consulta que toca a série
   * bruta de posições: são 2.863 leituras por veículo por dia, e um pedido de
   * trinta dias devolveria quase cem mil pontos para o navegador desenhar.
   */
  const [trackHours, setTrackHours] = useState(24);

  /** Onde o replay está agora. Nulo quando ninguém mexeu no controle. */
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  /**
   * O mapa de calor fica desligado por padrão.
   *
   * Ele é fundo, e ligado sempre competiria com a posição atual, que é o que a
   * tela existe para mostrar. Quem quer saber ONDE a frota freia forte liga
   * quando essa for a pergunta.
   */
  const [showHeat, setShowHeat] = useState(false);

  const heatQuery = useQuery({
    queryKey: ['event-heatmap'],
    queryFn: () => getEventHeatmap(7),
    enabled: showHeat,
    /* Sete dias de evento não mudam de minuto a minuto. */
    staleTime: 5 * 60_000,
  });

  const trackQuery = useQuery({
    queryKey: ['vehicle-track', selectedId, trackHours],
    queryFn: () => getVehicleTrack(selectedId as string, trackHours),
    /* Sem veículo selecionado não há rota a buscar. */
    enabled: Boolean(selectedId),
    /* A rota é histórico: ela não muda a cada quatro segundos como a posição. */
    staleTime: 60_000,
  });

  const positions = useMemo(() => data ?? [], [data]);
  const moving = positions.filter((vehicle) => vehicle.speedKmh > 0).length;
  const staleCount = positions.filter(isStale).length;

  const select = useCallback((vehicleId: string) => setSelectedId(vehicleId), []);

  return (
    <>
      <PageBanner
        size="inline"
        title="Mapa ao vivo"
        description="Onde cada caminhão está agora, com velocidade e horário da última sincronização."
      />

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 sm:px-6">
        <QueryState isPending={isPending} isError={isError} label="as posições">
          {staleCount > 0 ? (
            /* RN-141 — saber que o dado é velho ANTES de decidir com base nele. */
            <div className="bg-warning/10 border-warning/30 text-warning mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {staleCount === 1
                  ? '1 veículo está há mais de 30 minutos sem sincronizar — a posição dele no mapa pode estar velha.'
                  : `${staleCount} veículos estão há mais de 30 minutos sem sincronizar — as posições deles no mapa podem estar velhas.`}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_1fr]">
            {/* Lista — funciona como fonte de informação mesmo sem o mapa. */}
            <GlassCard className="flex flex-col p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-on-surface-variant text-body-md">Frota</h2>
                <span className="tabular text-on-surface-muted text-label-md normal-case">
                  {moving} em movimento de {positions.length}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {positions.map((vehicle) => {
                  const active = vehicle.vehicleId === selectedId;
                  const stale = isStale(vehicle);

                  return (
                    <li key={vehicle.vehicleId}>
                      <button
                        type="button"
                        onClick={() => select(vehicle.vehicleId)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'focus-visible:ring-secondary w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active ? 'bg-primary-strong' : 'bg-surface-lowest hover:bg-surface-high',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'tabular font-semibold',
                              active ? 'text-on-primary' : 'text-on-surface',
                            )}
                          >
                            {vehicle.plate}
                          </span>
                          {active ? null : (
                            <VehicleStatusChip status={vehicle.status} surface="dark" />
                          )}
                        </span>

                        <span
                          className={cn(
                            'text-label-md mt-1 flex items-center gap-1.5 normal-case',
                            active ? 'text-on-primary' : 'text-on-surface-muted',
                          )}
                        >
                          <MapPinIcon size={13} aria-hidden="true" />
                          {/* A MiX so geocodifica inicio e fim de trecho; a leitura solta vem sem
                              endereco. Coordenada e melhor que espaco em branco. */}
                          <span className="truncate">
                            {vehicle.place ??
                              `${vehicle.coordinates[1].toFixed(4)}, ${vehicle.coordinates[0].toFixed(4)}`}
                          </span>
                        </span>

                        <span
                          className={cn(
                            'text-label-md mt-1 flex items-center gap-3 normal-case',
                            active ? 'text-on-primary' : 'text-on-surface-muted',
                          )}
                        >
                          <span className="tabular flex items-center gap-1.5">
                            <GaugeIcon size={13} aria-hidden="true" />
                            {vehicle.speedKmh.toLocaleString('pt-BR', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            km/h
                          </span>
                          <span className={cn('tabular', stale && !active && 'text-warning')}>
                            {stale ? 'sem sinal desde ' : 'às '}
                            {time.format(new Date(vehicle.lastSyncAt))}
                          </span>
                        </span>

                        {vehicle.driverName ? (
                          <span
                            className={cn(
                              'text-label-md mt-1 block truncate normal-case',
                              active ? 'text-on-primary' : 'text-on-surface-variant',
                            )}
                          >
                            {vehicle.driverName}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowHeat((valor) => !valor)}
                  aria-pressed={showHeat}
                  className={cn(
                    'text-label-md focus-visible:ring-secondary rounded-full px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                    showHeat
                      ? 'bg-primary-strong text-on-primary'
                      : 'bg-on-surface/8 text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  Onde a frota gera evento
                </button>

                {showHeat ? (
                  <span className="text-on-surface-muted text-label-md normal-case">
                    {heatQuery.isPending
                      ? 'somando os eventos…'
                      : `${(heatQuery.data ?? []).length.toLocaleString('pt-BR')} pontos de concentração nos últimos 7 dias`}
                  </span>
                ) : null}
              </div>

              {/* O seletor só aparece com veículo escolhido: sem seleção não há
                  rota, e um controle inerte no topo do mapa é ruído. */}
              {selectedId ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-on-surface-variant text-label-md normal-case">
                    Rota percorrida
                  </span>
                  <div className="bg-on-surface/8 flex gap-1 rounded-full p-1">
                    {TRACK_WINDOWS.map((janela) => (
                      <button
                        key={janela.hours}
                        type="button"
                        onClick={() => setTrackHours(janela.hours)}
                        aria-pressed={trackHours === janela.hours}
                        className={cn(
                          'text-label-md focus-visible:ring-secondary rounded-full px-3 py-1 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                          trackHours === janela.hours
                            ? 'bg-primary-strong text-on-primary'
                            : 'text-on-surface-variant hover:text-on-surface',
                        )}
                      >
                        {janela.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-on-surface-muted text-label-md normal-case">
                    {trackQuery.isPending
                      ? 'traçando…'
                      : trackQuery.isError
                        ? 'não foi possível traçar a rota'
                        : (trackQuery.data?.length ?? 0) < 2
                          ? 'sem leituras suficientes no período'
                          : `${(trackQuery.data ?? []).length.toLocaleString('pt-BR')} pontos`}
                  </span>
                </div>
              ) : null}

              {selectedId && (trackQuery.data?.length ?? 0) >= 2 ? (
                /* `key` com veículo e janela: trocar de rota REMONTA o controle,
                   em vez de sincronizar o índice por efeito. Sem isso, o cursor
                   apareceria no ponto 300 de uma rota de 12 até o efeito rodar. */
                <TrackReplay
                  key={`${selectedId}-${trackHours}`}
                  points={trackQuery.data ?? []}
                  onIndexChange={setReplayIndex}
                />
              ) : null}

              <FleetMap
                positions={positions}
                selectedId={selectedId}
                onSelect={select}
                track={(trackQuery.data ?? []).map((ponto) => ponto.coordinates)}
                heat={showHeat ? heatQuery.data : undefined}
                playhead={
                  replayIndex != null ? (trackQuery.data?.[replayIndex]?.coordinates ?? null) : null
                }
                className="min-h-[520px] xl:min-h-[calc(100dvh-400px)]"
              />
            </div>
          </div>
        </QueryState>
      </main>
    </>
  );
}
