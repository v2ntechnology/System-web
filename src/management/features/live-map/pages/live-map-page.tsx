import {
  GaugeIcon,
  MapPinIcon,
  RadarIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { VehiclePosition, VehicleStatus } from '@/management/types';
import { cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import { VehicleStatusChip } from '@/management/features/trucks/vehicle-status';

import { getEventHeatmap, getVehiclePositions, getVehicleTrack } from '../api';
import { FleetMap } from '../components/fleet-map';
import { TrackReplay } from '../components/track-replay';

/**
 * De quanto em quanto tempo a tela repergunta a posição.
 *
 * Dez segundos, decisão do usuário em 30/08/2026. Sai daqui e não de dois
 * lugares: o intervalo aparece escrito na tela, e com o número repetido a
 * legenda passaria a mentir na primeira vez que alguém mexesse no outro.
 */
const REFETCH_MS = 10_000;

const STALE_SYNC_MINUTES = 30;

const isStale = (vehicle: VehiclePosition) =>
  (Date.now() - new Date(vehicle.lastSyncAt).getTime()) / 60_000 > STALE_SYNC_MINUTES;

const SITUACOES: { id: VehicleStatus | 'TODOS'; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'EM_VIAGEM', label: 'Em viagem' },
  { id: 'DISPONIVEL', label: 'Disponíveis' },
  { id: 'MANUTENCAO', label: 'Manutenção' },
  { id: 'SEM_SINAL', label: 'Sem sinal' },
];

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

function locationLabel(vehicle: VehiclePosition) {
  return (
    vehicle.place ?? `${vehicle.coordinates[1].toFixed(4)}, ${vehicle.coordinates[0].toFixed(4)}`
  );
}

function CommandMetric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const tones = {
    primary: 'bg-primary-strong/12 text-primary-strong',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    muted: 'bg-on-surface/8 text-on-surface-variant',
  } as const;

  return (
    <div className="border-outline-variant bg-surface-container min-w-0 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-on-surface-variant text-label-md normal-case">{label}</p>
          <p className="tabular text-on-surface mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {value}
          </p>
        </div>
        <span className={cn('flex size-9 items-center justify-center rounded-lg', tones[tone])}>
          {icon}
        </span>
      </div>
      <p className="text-on-surface-muted text-label-md mt-3 normal-case">{hint}</p>
    </div>
  );
}

export function LiveMapPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-positions'],
    queryFn: getVehiclePositions,
    refetchInterval: REFETCH_MS,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackHours, setTrackHours] = useState(24);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<VehicleStatus | 'TODOS'>('TODOS');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showHeat, setShowHeat] = useState(false);

  const heatQuery = useQuery({
    queryKey: ['event-heatmap'],
    queryFn: () => getEventHeatmap(7),
    enabled: showHeat,
    staleTime: 5 * 60_000,
  });

  const trackQuery = useQuery({
    queryKey: ['vehicle-track', selectedId, trackHours],
    queryFn: () => getVehicleTrack(selectedId as string, trackHours),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
  });

  const positions = useMemo(() => data ?? [], [data]);
  const moving = positions.filter((vehicle) => vehicle.speedKmh > 5).length;
  const staleCount = positions.filter(isStale).length;

  const visibleVehicles = useMemo(() => {
    const term = busca.trim().toLowerCase();

    return positions.filter((vehicle) => {
      if (situacao !== 'TODOS' && vehicle.status !== situacao) return false;
      if (!term) return true;

      return (
        vehicle.plate.toLowerCase().includes(term) ||
        (vehicle.driverName ?? '').toLowerCase().includes(term)
      );
    });
  }, [positions, busca, situacao]);

  const countByStatus = useMemo(() => {
    const counts = new Map<VehicleStatus, number>();
    for (const vehicle of positions) {
      counts.set(vehicle.status, (counts.get(vehicle.status) ?? 0) + 1);
    }
    return counts;
  }, [positions]);

  const selectedVehicle = useMemo(
    () => positions.find((vehicle) => vehicle.vehicleId === selectedId) ?? null,
    [positions, selectedId],
  );

  const select = useCallback((vehicleId: string) => setSelectedId(vehicleId), []);
  const readyCount = countByStatus.get('DISPONIVEL') ?? 0;
  const attentionCount =
    (countByStatus.get('MANUTENCAO') ?? 0) + (countByStatus.get('BLOQUEADO') ?? 0);
  const withoutSignalCount = countByStatus.get('SEM_SINAL') ?? 0;
  const trackPoints = trackQuery.data ?? [];

  return (
    <>
      <PageBanner
        size="inline"
        title="Mapa ao vivo"
        description="Uma central de comando para acompanhar a frota e agir antes que a operação pare."
      />

      <main className="w-full px-4 pb-24 sm:px-6 xl:px-10">
        <QueryState isPending={isPending} isError={isError} label="as posições">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-primary-strong text-label-md inline-flex items-center gap-2 normal-case">
                <RadarIcon size={16} aria-hidden="true" />
                Central de comando
              </span>
              <p className="text-on-surface-variant text-body-md mt-2 max-w-2xl">
                Priorize o que está em movimento, encontre uma placa e abra os detalhes sem perder a
                visão do território.
              </p>
            </div>

            <span className="border-outline-variant bg-surface-container text-on-surface-variant text-label-md inline-flex items-center gap-2 rounded-full border px-3 py-2 normal-case">
              <span className="bg-success size-2 rounded-full" aria-hidden="true" />
              Atualização automática a cada {REFETCH_MS / 1000} segundos
            </span>
          </div>

          {staleCount > 0 ? (
            <div className="bg-warning/10 border-warning/30 text-warning mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3">
              <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {staleCount === 1
                  ? '1 veículo está há mais de 30 minutos sem sincronizar. Confirme a posição antes de tomar uma decisão.'
                  : `${staleCount} veículos estão há mais de 30 minutos sem sincronizar. Confirme as posições antes de tomar uma decisão.`}
              </p>
            </div>
          ) : null}

          {/*
           * ⚠️ A lista à ESQUERDA e o mapa à direita, e as duas colunas com a
           * MESMA altura.
           *
           * A leitura vai do painel para o território: quem opera procura uma
           * placa na lista e confirma onde ela está, e não o contrário. Com a
           * lista à direita o olho atravessava o mapa inteiro a cada consulta.
           *
           * A altura é da LINHA do grid, e não de cada peça: `items-stretch`
           * (padrão do grid) mais `h-full` nos dois filhos. Antes o mapa tinha
           * altura própria e a lista tinha `max-h-[620px]`, então uma sobrava
           * enquanto a outra faltava, e a diferença mudava com a largura da
           * tela.
           */}
          <section className="grid gap-5 2xl:h-[clamp(32rem,calc(100dvh-26rem),52rem)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-outline-variant bg-surface-container flex min-h-0 flex-col rounded-2xl border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-on-surface text-body-md font-semibold">
                    Monitoramento da frota
                  </p>
                  <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                    {visibleVehicles.length} de {positions.length} veículos
                  </p>
                </div>
                <span className="bg-primary-strong/12 text-primary-strong flex size-9 items-center justify-center rounded-lg">
                  <TruckIcon size={18} aria-hidden="true" />
                </span>
              </div>

              <label className="border-outline-variant bg-surface-lowest mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5">
                <SearchIcon
                  size={17}
                  className="text-on-surface-muted shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">Buscar por placa ou motorista</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Placa ou motorista"
                  className="text-on-surface placeholder:text-on-surface-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>

              <div
                role="group"
                aria-label="Filtrar por situação"
                className="mt-3 flex flex-wrap gap-1.5"
              >
                {SITUACOES.map((option) => {
                  const total =
                    option.id === 'TODOS' ? positions.length : (countByStatus.get(option.id) ?? 0);
                  if (total === 0 && option.id !== 'TODOS') return null;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSituacao(option.id)}
                      aria-pressed={situacao === option.id}
                      className={cn(
                        'text-label-md rounded-full px-2.5 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
                        situacao === option.id
                          ? 'bg-primary-strong text-on-primary'
                          : 'bg-on-surface/8 text-on-surface-variant hover:text-on-surface',
                      )}
                    >
                      {option.label} <span className="tabular opacity-70">{total}</span>
                    </button>
                  );
                })}
              </div>

              {selectedVehicle ? (
                <section className="border-primary-strong/25 bg-primary-strong/7 mt-4 rounded-xl border p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-on-surface text-body-md font-semibold">
                        {selectedVehicle.plate}
                      </p>
                      <p className="text-on-surface-muted text-label-md mt-0.5 truncate normal-case">
                        {selectedVehicle.driverName ?? 'Motorista não vinculado'}
                      </p>
                    </div>
                    <VehicleStatusChip status={selectedVehicle.status} surface="dark" />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
                        Velocidade
                      </dt>
                      <dd className="text-on-surface mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
                        <GaugeIcon size={14} aria-hidden="true" />
                        {selectedVehicle.speedKmh.toLocaleString('pt-BR', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        km/h
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
                        Último sinal
                      </dt>
                      <dd
                        className={cn(
                          'tabular text-on-surface mt-1 text-sm font-semibold',
                          isStale(selectedVehicle) && 'text-warning',
                        )}
                      >
                        {time.format(new Date(selectedVehicle.lastSyncAt))}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-on-surface-variant text-label-md mt-4 flex items-start gap-1.5 normal-case">
                    <MapPinIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{locationLabel(selectedVehicle)}</span>
                  </p>
                </section>
              ) : null}

              <ul
                className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
                aria-label="Veículos encontrados"
              >
                {visibleVehicles.map((vehicle) => {
                  const active = vehicle.vehicleId === selectedId;
                  const stale = isStale(vehicle);

                  return (
                    <li key={vehicle.vehicleId}>
                      <button
                        type="button"
                        onClick={() => select(vehicle.vehicleId)}
                        onMouseEnter={() => setHoveredId(vehicle.vehicleId)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(vehicle.vehicleId)}
                        onBlur={() => setHoveredId(null)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'border-outline-variant w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
                          active
                            ? 'border-primary-strong bg-primary-strong text-on-primary'
                            : 'bg-surface-lowest hover:border-primary-strong/45 hover:bg-surface-high',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'tabular text-sm font-semibold',
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
                            'mt-2 flex items-center gap-1.5 text-xs',
                            active ? 'text-on-primary/80' : 'text-on-surface-muted',
                          )}
                        >
                          <MapPinIcon size={13} aria-hidden="true" />
                          <span className="truncate">{locationLabel(vehicle)}</span>
                        </span>

                        <span
                          className={cn(
                            'mt-2 flex items-center justify-between gap-3 text-xs',
                            active ? 'text-on-primary/80' : 'text-on-surface-muted',
                          )}
                        >
                          <span className="tabular inline-flex items-center gap-1.5">
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Empilhado, o mapa vem primeiro: é o que a tela existe para
                mostrar. Lado a lado, ele vai para a direita. */}
            <div className="order-first flex min-w-0 flex-col 2xl:order-none">
              <div className="border-outline-variant relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-[#0B0B0E]">
                <FleetMap
                  positions={positions}
                  selectedId={selectedId}
                  onSelect={select}
                  track={trackPoints.map((point) => point.coordinates)}
                  heat={showHeat ? heatQuery.data : undefined}
                  hoveredId={hoveredId}
                  playhead={
                    replayIndex != null ? (trackPoints[replayIndex]?.coordinates ?? null) : null
                  }
                  className="h-full min-h-[560px]"
                />

                <div className="pointer-events-none absolute inset-y-0 left-0 flex max-w-[19rem] flex-col items-start gap-3 p-4 sm:p-5">
                  <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#121216]/92 px-3.5 py-3 text-white backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      Visão territorial
                    </p>
                    <p className="mt-1 text-sm font-semibold">Frota em campo</p>
                    <p className="mt-1 text-xs text-white/60">
                      {positions.length} veículos monitorados em tempo real
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHeat((value) => !value)}
                    aria-pressed={showHeat}
                    className={cn(
                      'pointer-events-auto rounded-xl border px-3.5 py-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                      showHeat
                        ? 'border-primary-strong bg-primary-strong text-on-primary'
                        : 'border-white/10 bg-[#121216]/92 text-white hover:bg-white/10',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <RadarIcon size={15} aria-hidden="true" />
                      Eventos na rota
                    </span>
                    <span
                      className={cn(
                        'mt-1 block text-[11px]',
                        showHeat ? 'opacity-80' : 'text-white/55',
                      )}
                    >
                      {showHeat
                        ? heatQuery.isPending
                          ? 'Carregando concentrações'
                          : `${(heatQuery.data ?? []).length.toLocaleString('pt-BR')} pontos nos últimos 7 dias`
                        : 'Ative o mapa de calor'}
                    </span>
                  </button>

                  {/* Empurra os dois cartões para o topo da coluna. */}
                  <div className="flex-1" aria-hidden="true" />
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                  <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-[#121216]/92 px-3.5 py-2.5 text-xs text-white/75 backdrop-blur-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#38BDF8]" /> Em viagem
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#34D399]" /> Disponível
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#FBBF24]" /> Atenção
                    </span>
                  </div>

                  {selectedVehicle ? (
                    <div className="pointer-events-auto hidden rounded-xl border border-white/10 bg-[#121216]/92 px-3.5 py-2.5 text-right text-white backdrop-blur-sm sm:block">
                      <p className="text-[11px] text-white/55">Veículo selecionado</p>
                      <p className="mt-0.5 text-sm font-semibold">{selectedVehicle.plate}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* O trajeto saiu de dentro da coluna do mapa: com as duas colunas de
              altura casada, qualquer coisa embaixo do mapa esticaria a linha e
              desfaria o casamento. Em largura total ele ainda ganha espaço para
              o replay. */}
          {selectedVehicle ? (
            <section
              aria-label={`Rota de ${selectedVehicle.plate}`}
              className="border-outline-variant bg-surface-container mt-4 rounded-2xl border p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="bg-primary-strong/12 text-primary-strong flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <RouteIcon size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-on-surface text-body-md font-semibold">
                      Trajeto de {selectedVehicle.plate}
                    </p>
                    <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                      {trackQuery.isPending
                        ? 'Traçando rota'
                        : trackQuery.isError
                          ? 'Não foi possível carregar a rota'
                          : trackPoints.length < 2
                            ? 'Sem leituras suficientes no período'
                            : `${trackPoints.length.toLocaleString('pt-BR')} pontos para consultar`}
                    </p>
                  </div>
                </div>

                <div className="bg-on-surface/8 flex gap-1 rounded-full p-1">
                  {TRACK_WINDOWS.map((window) => (
                    <button
                      key={window.hours}
                      type="button"
                      onClick={() => setTrackHours(window.hours)}
                      aria-pressed={trackHours === window.hours}
                      className={cn(
                        'text-label-md rounded-full px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
                        trackHours === window.hours
                          ? 'bg-primary-strong text-on-primary'
                          : 'text-on-surface-variant hover:text-on-surface',
                      )}
                    >
                      {window.label}
                    </button>
                  ))}
                </div>
              </div>

              {trackPoints.length >= 2 ? (
                <TrackReplay
                  key={`${selectedId}-${trackHours}`}
                  points={trackPoints}
                  onIndexChange={setReplayIndex}
                  className="border-outline-variant bg-surface-lowest mt-4 rounded-xl border p-3"
                />
              ) : null}
            </section>
          ) : (
            <p className="text-on-surface-muted text-label-md mt-4 px-1 normal-case">
              Selecione um caminhão no mapa ou na lista para consultar o trajeto e o replay.
            </p>
          )}

          {/*
           * ⚠️ Os números vêm DEPOIS do mapa, e não antes.
           *
           * Numa tela de notebook, que é o hardware do gestor (RNF-006), os
           * quatro cartões empilhavam em duas linhas e empurravam o mapa para
           * fora da primeira dobra: quem abria a central de comando via cartão,
           * não território. O mapa é a primeira informação útil desta tela, e o
           * resumo é o que se olha depois de já ter visto onde a frota está.
           */}
          <section
            aria-label="Resumo da frota"
            className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4"
          >
            <CommandMetric
              label="Em movimento"
              value={moving}
              hint={`${countByStatus.get('EM_VIAGEM') ?? 0} em viagem`}
              icon={<TruckIcon size={18} aria-hidden="true" />}
              tone="primary"
            />
            <CommandMetric
              label="Prontos para operar"
              value={readyCount}
              hint="Veículos disponíveis agora"
              icon={<RadarIcon size={18} aria-hidden="true" />}
              tone="success"
            />
            <CommandMetric
              label="Pedem atenção"
              value={attentionCount}
              hint="Manutenção ou bloqueio"
              icon={<WarningIcon size={18} aria-hidden="true" />}
              tone="warning"
            />
            <CommandMetric
              label="Sem sinal"
              value={withoutSignalCount}
              hint="Rastreadores a conferir"
              icon={<MapPinIcon size={18} aria-hidden="true" />}
              tone="muted"
            />
          </section>
        </QueryState>
      </main>
    </>
  );
}
