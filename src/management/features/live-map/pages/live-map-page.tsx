import {
  CloseIcon,
  GaugeIcon,
  MapPinIcon,
  RadarIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
} from '@/components/icons';
import type { VehiclePosition, VehicleStatus } from '@/management/types';
import { cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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

/**
 * Quanto tempo o aviso de veículos mudos fica na tela.
 *
 * Decisão do usuário em 30/08/2026: o aviso era uma faixa fixa acima do mapa,
 * ocupando uma linha inteira o tempo todo e empurrando o território para baixo.
 * Virou aviso flutuante que aparece, informa e sai.
 */
const AVISO_MS = 8000;

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

/**
 * A legenda das cores do mapa.
 *
 * ⚠️ Os literais são os mesmos de `STATUS_COLOR` em `fleet-map.tsx`, e precisam
 * continuar iguais: a legenda existe para explicar o crachá, e uma legenda que
 * mente é pior que legenda nenhuma. Mexeu num, confira o outro.
 */
const LEGENDA = [
  { cor: '#38BDF8', label: 'Em viagem' },
  { cor: '#34D399', label: 'Disponível' },
  { cor: '#FBBF24', label: 'Atenção' },
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

/** Cartão flutuante sobre o mapa. O fundo é escuro porque o mapa é escuro. */
const SOBRE_O_MAPA =
  'pointer-events-auto rounded-xl border border-white/10 bg-[#121216]/92 text-white backdrop-blur-sm';

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
  const [trajetoAberto, setTrajetoAberto] = useState(false);

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

  /*
   * ⚠️ Trocar de veículo fecha o trajeto, e isso é feito AQUI e não num efeito.
   *
   * O trajeto é de uma placa só: aberto, ele mostraria a rota da anterior
   * enquanto a nova carrega. Sincronizar isso com `useEffect` é erro de lint
   * neste projeto, e a regra tem razão (renderiza duas vezes por clique). O
   * lugar certo é o handler, que é quem sabe que houve uma troca.
   */
  const select = useCallback(
    (vehicleId: string) => {
      setSelectedId(vehicleId);
      if (vehicleId !== selectedId) setTrajetoAberto(false);
    },
    [selectedId],
  );

  const limparSelecao = useCallback(() => {
    setSelectedId(null);
    setTrajetoAberto(false);
  }, []);

  const trackPoints = trackQuery.data ?? [];

  /**
   * O aviso de veículos mudos, flutuante.
   *
   * ⚠️ A guarda pelo número anterior é o que torna isto usável. A tela
   * repergunta a cada dez segundos, e sem ela o mesmo aviso reapareceria seis
   * vezes por minuto até virar ruído que se aprende a ignorar. Ele volta quando
   * a CONTAGEM muda, que é quando há de fato algo novo a dizer.
   */
  const avisado = useRef<number | null>(null);
  useEffect(() => {
    if (staleCount === 0) {
      avisado.current = 0;
      return;
    }
    if (avisado.current === staleCount) return;
    avisado.current = staleCount;

    toast.warning(
      staleCount === 1
        ? '1 veículo há mais de 30 minutos sem sincronizar'
        : `${staleCount} veículos há mais de 30 minutos sem sincronizar`,
      {
        description: 'Confirme as posições antes de tomar uma decisão.',
        duration: AVISO_MS,
        /* Um id fixo troca o conteúdo do aviso que já está na tela em vez de
           empilhar um segundo: a contagem pode mudar duas vezes seguidas. */
        id: 'mapa-sem-sincronizar',
      },
    );
  }, [staleCount]);

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
           *
           * ⚠️ A TERCEIRA coluna só existe com um veículo escolhido (pedido do
           * usuário em 30/08/2026). Os detalhes moravam dentro da lista, entre
           * os filtros e as placas, e empurravam a lista inteira para baixo toda
           * vez que alguém clicava: a placa recém-escolhida saía do campo de
           * visão no instante em que era escolhida. Sem seleção a coluna não
           * ocupa espaço, e o mapa recebe a largura de volta.
           */}
          <section
            className={cn(
              'grid gap-5 2xl:h-[clamp(32rem,calc(100dvh-22rem),52rem)]',
              selectedVehicle
                ? '2xl:grid-cols-[320px_300px_minmax(0,1fr)]'
                : '2xl:grid-cols-[360px_minmax(0,1fr)]',
            )}
          >
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

            {/* A ficha do escolhido: coluna própria, ao lado da lista. */}
            {selectedVehicle ? (
              <aside
                aria-label={`Detalhes de ${selectedVehicle.plate}`}
                className="border-outline-variant bg-surface-container flex min-h-0 flex-col overflow-y-auto rounded-2xl border p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tabular text-on-surface text-lg font-semibold">
                      {selectedVehicle.plate}
                    </p>
                    <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                      {selectedVehicle.driverName ?? 'Motorista não vinculado'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={limparSelecao}
                    className="acao-neutra -mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                    aria-label="Fechar detalhes"
                    title="Fechar detalhes"
                  >
                    <CloseIcon size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4">
                  <VehicleStatusChip status={selectedVehicle.status} surface="dark" />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
                      Velocidade
                    </dt>
                    <dd className="text-on-surface mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
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
                        'tabular text-on-surface mt-1.5 text-sm font-semibold',
                        isStale(selectedVehicle) && 'text-warning',
                      )}
                    >
                      {time.format(new Date(selectedVehicle.lastSyncAt))}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <p className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
                    Posição
                  </p>
                  <p className="text-on-surface-variant text-body-md mt-1.5 flex items-start gap-1.5">
                    <MapPinIcon size={14} className="mt-1 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{locationLabel(selectedVehicle)}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setTrajetoAberto((aberto) => !aberto)}
                  aria-pressed={trajetoAberto}
                  className={cn(
                    'text-label-md mt-auto flex items-center gap-2 rounded-xl border px-3.5 py-3 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
                    trajetoAberto
                      ? 'border-primary-strong bg-primary-strong text-on-primary'
                      : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  <RouteIcon size={16} aria-hidden="true" />
                  {trajetoAberto ? 'Ocultar trajeto' : 'Ver trajeto no mapa'}
                </button>
              </aside>
            ) : null}

            {/* Empilhado, o mapa vem primeiro: é o que a tela existe para
                mostrar. Lado a lado, ele vai para a direita. */}
            <div className="order-first flex min-w-0 flex-col 2xl:order-none">
              <div className="border-outline-variant relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-[#0B0B0E]">
                <FleetMap
                  positions={positions}
                  selectedId={selectedId}
                  onSelect={select}
                  /*
                   * ⚠️ A rota só desce para o mapa com o painel aberto, e isso
                   * não é economia: é o `FleetMap` que enquadra o trajeto
                   * inteiro ao recebê-lo. Mandando sempre, escolher uma placa
                   * afastaria a câmera para caber o dia todo, desfazendo o foco
                   * no veículo que acabou de ser pedido.
                   */
                  track={trajetoAberto ? trackPoints.map((point) => point.coordinates) : undefined}
                  heat={showHeat ? heatQuery.data : undefined}
                  hoveredId={hoveredId}
                  playhead={
                    trajetoAberto && replayIndex != null
                      ? (trackPoints[replayIndex]?.coordinates ?? null)
                      : null
                  }
                  className="h-full min-h-[560px]"
                />

                {/* Legenda no topo (pedido do usuário em 30/08/2026): ela
                    explica o crachá, então mora onde o olho entra no mapa. Fica
                    à esquerda porque a direita é dos controles de zoom do
                    MapLibre. */}
                <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-3 p-4 sm:p-5">
                  <div
                    className={cn(
                      SOBRE_O_MAPA,
                      'flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-xs text-white/75',
                    )}
                  >
                    {LEGENDA.map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: item.cor }}
                          aria-hidden="true"
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Controles do canto inferior esquerdo. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-4 sm:p-5">
                  {trajetoAberto && selectedVehicle ? (
                    <section
                      aria-label={`Trajeto de ${selectedVehicle.plate}`}
                      className={cn(SOBRE_O_MAPA, 'w-full max-w-xl p-3.5')}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            Trajeto de {selectedVehicle.plate}
                          </p>
                          <p className="mt-1 text-[11px] text-white/60">
                            {trackQuery.isPending
                              ? 'Traçando rota'
                              : trackQuery.isError
                                ? 'Não foi possível carregar a rota'
                                : trackPoints.length < 2
                                  ? 'Sem leituras suficientes no período'
                                  : `${trackPoints.length.toLocaleString('pt-BR')} pontos para consultar`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 rounded-full bg-white/10 p-1">
                            {TRACK_WINDOWS.map((window) => (
                              <button
                                key={window.hours}
                                type="button"
                                onClick={() => setTrackHours(window.hours)}
                                aria-pressed={trackHours === window.hours}
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                                  trackHours === window.hours
                                    ? 'bg-primary-strong text-on-primary'
                                    : 'text-white/70 hover:text-white',
                                )}
                              >
                                {window.label}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setTrajetoAberto(false)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            aria-label="Fechar o trajeto"
                            title="Fechar o trajeto"
                          >
                            <CloseIcon size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {trackPoints.length >= 2 ? (
                        <TrackReplay
                          key={`${selectedId}-${trackHours}`}
                          points={trackPoints}
                          onIndexChange={setReplayIndex}
                          className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
                        />
                      ) : null}
                    </section>
                  ) : null}

                  <div className="flex flex-wrap items-end gap-3">
                    {selectedVehicle && !trajetoAberto ? (
                      <button
                        type="button"
                        onClick={() => setTrajetoAberto(true)}
                        className={cn(
                          SOBRE_O_MAPA,
                          'flex size-11 items-center justify-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                        )}
                        aria-label={`Ver o trajeto de ${selectedVehicle.plate}`}
                        title={`Trajeto de ${selectedVehicle.plate}`}
                      >
                        <RouteIcon size={18} aria-hidden="true" />
                      </button>
                    ) : null}

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
                  </div>
                </div>
              </div>
            </div>
          </section>
        </QueryState>
      </main>
    </>
  );
}
