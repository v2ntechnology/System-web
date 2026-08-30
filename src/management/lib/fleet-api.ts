import type {
  Driver,
  DriverProfile,
  DriverRankEntry,
  ManagerOverview,
  RoadEventType,
  SafetyEvent,
  SafetySummary,
  Vehicle,
  VehicleDetail,
  VehiclePosition,
  VehicleStatus,
} from '@/management/types';
import { httpBlob, httpRequest } from '@/services/http';

/**
 * Ponte entre o backend e as telas do painel.
 *
 * O que chega do backend não é o que a tela consome: os identificadores vêm como
 * texto (os da MiX têm 19 dígitos e não cabem em `Number`), os campos sem origem
 * na telemetria vêm nulos, e o vocabulário de estado é o do banco. A conversão
 * mora aqui, em um lugar só, para nenhuma tela precisar saber disso.
 *
 * ⚠️ Nulo que chega do backend continua nulo aqui. A tentação é preencher com
 * zero para simplificar o componente; o resultado seria um custo por quilômetro
 * de R$ 0,00 na tela, que parece um dado e não é.
 */

/* -------------------------------------------------------------------------- */
/* O que o backend devolve                                                     */
/* -------------------------------------------------------------------------- */

interface VehicleDto {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  status: string;
  unit: string | null;
  driverName: string | null;
  odometerKm: number | null;
  costPerKm: number | null;
  kmToMaintenance: number | null;
  lastSyncAt: string | null;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  imageUrl: string | null;
  notes: string | null;
  type: string | null;
  internalCode: string | null;
  manualNotes: string | null;
}

interface PositionDto {
  vehicleId: string;
  plate: string;
  status: string;
  driverName: string | null;
  coordinates: [number, number];
  speedKmh: number | null;
  heading: number | null;
  lastSyncAt: string;
  place: string | null;
  type: string | null;
  odometerKm: number | null;
}

interface DriverDto {
  id: string;
  name: string;
  status: string;
  score: number | null;
  scoreDelta: number | null;
  tripsCount: number;
  kmDriven: number | null;
  criticalEvents: number;
  cnhCategory: string | null;
  cnhExpiresAt: string | null;
  currentVehiclePlate: string | null;
  unit: string | null;
}

interface DriverRankDto {
  driverId: string;
  name: string;
  score: number | null;
  kmDriven: number | null;
  position: number;
}

interface SafetyEventDto {
  id: string;
  type: string | null;
  typeLabel: string;
  severity: string | null;
  driverId: string | null;
  driverName: string | null;
  plate: string;
  at: string;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  description: string;
  value: number | null;
  valueName: string | null;
  valueUnit: string | null;
  durationSeconds: number | null;
  occurrences: number | null;
}

interface SafetySummaryDto {
  events: SafetyEventDto[];
  byType: { type: string | null; label: string; count: number; previousCount: number }[];
  fleetScore: number | null;
  eventsPer1000Km: number | null;
  eventsPer1000KmPrevious: number | null;
  totalEvents: number;
  criticalEvents: number;
  measuresCritical: boolean;
  distanceKm: number | null;
}

interface VehicleDetailDto {
  vehicleId: string;
  plate: string;
  vin: string | null;
  fuelType: string | null;
  unit: string | null;
  odometerKm: number | null;
  lastSyncAt: string | null;
  fuelEfficiency: number | null;
  availability: number | null;
  distanceKm30d: number | null;
  journeys30d: number;
  dailyDistance: { day: string; value: number | null }[];
  recentEvents: SafetyEventDto[];
}

/* -------------------------------------------------------------------------- */
/* Conversão                                                                   */
/* -------------------------------------------------------------------------- */

const VEHICLE_STATUS: Record<string, VehicleStatus> = {
  EM_VIAGEM: 'EM_VIAGEM',
  DISPONIVEL: 'DISPONIVEL',
  MANUTENCAO: 'MANUTENCAO',
  SEM_SINAL: 'SEM_SINAL',
  BLOQUEADO: 'BLOQUEADO',
};

/** Estado desconhecido vira "sem sinal", nunca "disponível": errar para o lado seguro. */
const toVehicleStatus = (value: string): VehicleStatus => VEHICLE_STATUS[value] ?? 'SEM_SINAL';

const ROAD_EVENTS: RoadEventType[] = [
  'EXCESSO_VELOCIDADE',
  'FRENAGEM_BRUSCA',
  'ACELERACAO_BRUSCA',
  'CURVA_AGRESSIVA',
  'JORNADA_EXCEDIDA',
  'DISTRACAO',
  'SONOLENCIA',
  'COLISAO_IMINENTE',
  'CINTO_SEGURANCA',
];

const toRoadEvent = (value: string | null): RoadEventType =>
  ROAD_EVENTS.includes(value as RoadEventType) ? (value as RoadEventType) : 'EXCESSO_VELOCIDADE';

const toVehicle = (dto: VehicleDto): Vehicle => ({
  id: dto.id,
  plate: dto.plate,
  brand: dto.brand,
  model: dto.model,
  year: dto.year ?? undefined,
  status: toVehicleStatus(dto.status),
  driverName: dto.driverName ?? undefined,
  odometerKm: dto.odometerKm ?? 0,
  unit: dto.unit ?? undefined,
  costPerKm: dto.costPerKm ?? undefined,
  kmToMaintenance: dto.kmToMaintenance ?? undefined,
  lastSyncAt: dto.lastSyncAt ?? undefined,
  imageUrl: dto.imageUrl ?? undefined,
  notes: dto.notes ?? undefined,
  type: dto.type ?? undefined,
  internalCode: dto.internalCode ?? undefined,
  manualNotes: dto.manualNotes ?? undefined,
});

const toPosition = (dto: PositionDto): VehiclePosition => ({
  vehicleId: dto.vehicleId,
  plate: dto.plate,
  status: toVehicleStatus(dto.status),
  driverName: dto.driverName ?? undefined,
  coordinates: dto.coordinates,
  speedKmh: dto.speedKmh ?? 0,
  heading: dto.heading ?? 0,
  lastSyncAt: dto.lastSyncAt,
  place: dto.place ?? undefined,
  type: dto.type ?? undefined,
  odometerKm: dto.odometerKm ?? undefined,
});

const toDriver = (dto: DriverDto): Driver => ({
  id: dto.id,
  name: dto.name,
  status: dto.status === 'EM_VIAGEM' ? 'EM_VIAGEM' : 'DISPONIVEL',
  score: dto.score ?? undefined,
  scoreDelta: dto.scoreDelta ?? undefined,
  tripsCount: dto.tripsCount,
  kmDriven: dto.kmDriven ?? 0,
  criticalEvents: dto.criticalEvents,
  cnhCategory: dto.cnhCategory ?? undefined,
  cnhExpiresAt: dto.cnhExpiresAt ?? undefined,
  currentVehiclePlate: dto.currentVehiclePlate ?? undefined,
  unit: dto.unit ?? undefined,
});

const toSafetyEvent = (dto: SafetyEventDto): SafetyEvent => ({
  id: dto.id,
  type: toRoadEvent(dto.type),
  /* O rótulo é o nome que o cliente deu ao evento na MiX, quando existe: ele
     reconhece "VELOCIDADE LIMITE" e não a nossa categoria genérica. */
  typeLabel: dto.description || dto.typeLabel,
  severity: dto.severity === 'CRITICO' || dto.severity === 'ATENCAO' ? dto.severity : 'LEVE',
  driverId: dto.driverId ?? '',
  driverName: dto.driverName ?? 'Sem condutor identificado',
  plate: dto.plate,
  at: dto.at,
  location: dto.location ?? formatCoordinates(dto.latitude, dto.longitude),
  description: dto.typeLabel,
  warned: false,
  value: dto.value ?? undefined,
  valueName: dto.valueName ?? undefined,
  valueUnit: dto.valueUnit ?? undefined,
  durationSeconds: dto.durationSeconds ?? undefined,
  occurrences: dto.occurrences ?? undefined,
});

/** "2026-08-26" vira "26/08". Rótulo de eixo tem espaço para cinco caracteres. */
function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return dia && mes ? `${dia}/${mes}` : iso;
}

/** Sem endereço, a coordenada é melhor que um espaço em branco. */
function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return 'Local não informado';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchVehicles(): Promise<Vehicle[]> {
  return (await httpRequest<VehicleDto[]>('/v1/vehicles')).map(toVehicle);
}

export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  return (await httpRequest<PositionDto[]>('/v1/fleet/positions')).map(toPosition);
}

export async function fetchDrivers(days = 30): Promise<Driver[]> {
  return (await httpRequest<DriverDto[]>(`/v1/drivers?days=${days}`)).map(toDriver);
}

export async function fetchDriverRanking(period: 'MES' | 'ANO'): Promise<DriverRankEntry[]> {
  const rows = await httpRequest<DriverRankDto[]>(`/v1/drivers/ranking?period=${period}&limit=10`);
  return rows.map((row) => ({
    driverId: row.driverId,
    name: row.name,
    score: row.score ?? 0,
    kmDriven: row.kmDriven ?? 0,
    position: row.position,
  }));
}

export async function fetchSafetySummary(days = 30): Promise<SafetySummary> {
  const dto = await httpRequest<SafetySummaryDto>(`/v1/safety/summary?days=${days}&limit=100`);

  return {
    events: dto.events.map(toSafetyEvent),
    /*
     * Contestação e copiloto ainda não existem no backend: a primeira é fluxo da
     * RookHub, não da telemetria, e o segundo depende do motor de risco. Lista
     * vazia é a resposta honesta enquanto isso, e a tela já trata vazio.
     */
    contests: [],
    copilot: [],
    fleetScore: dto.fleetScore ?? undefined,
    eventsPer1000Km: dto.eventsPer1000Km ?? undefined,
    eventsPer1000KmPrevious: dto.eventsPer1000KmPrevious ?? undefined,
    byType: dto.byType.map((row) => ({
      type: toRoadEvent(row.type),
      label: row.label,
      count: row.count,
      previousCount: row.previousCount,
    })),
    totalEvents: dto.totalEvents,
    criticalEvents: dto.criticalEvents,
    measuresCritical: dto.measuresCritical,
    distanceKm: dto.distanceKm ?? undefined,
  };
}

/**
 * Ficha do veículo.
 *
 * O backend entrega o que a telemetria sabe: distância, trechos, consumo e
 * eventos. Custo mensal e ordens de serviço não existem lá, então saem em zero
 * e a tela precisa dizer que ainda não há dado, em vez de desenhar um gráfico
 * de linha reta no zero como se fosse medição.
 */
export async function fetchVehicleDetail(vehicleId: string, days = 30): Promise<VehicleDetail> {
  const dto = await httpRequest<VehicleDetailDto>(`/v1/vehicles/${vehicleId}/detail?days=${days}`);

  return {
    vehicleId: dto.vehicleId,
    fuelEfficiency: dto.fuelEfficiency ?? undefined,
    availability: dto.availability ?? undefined,
    openOrders: 0,
    lastMaintenanceAt: '',
    /*
     * Vazio, e não a distância diária disfarçada de custo.
     *
     * Alimentar um gráfico rotulado "Custo por quilômetro" com quilômetros
     * rodados seria um erro que ninguém notaria: a linha teria forma plausível,
     * o eixo mostraria "R$", e o número estaria errado por três ordens de
     * grandeza. A distância vai em `dailyDistance`, com o próprio rótulo.
     */
    monthlyCost: [],
    dailyDistance: dto.dailyDistance.map((point) => ({
      day: point.day,
      km: point.value ?? 0,
    })),
    distanceKm: dto.distanceKm30d ?? undefined,
    journeys: dto.journeys30d,
    recentEvents: dto.recentEvents.map((event) => ({
      id: event.id,
      label: event.description,
      at: event.at,
      severity:
        event.severity === 'CRITICO' || event.severity === 'ATENCAO' ? event.severity : 'INFO',
    })),
  };
}

interface DriverProfileDto {
  driverId: string;
  name: string;
  unit: string | null;
  employeeNumber: string | null;
  phone: string | null;
  score: number | null;
  distanceKm: number | null;
  journeys: number;
  hoursDriven: number | null;
  avgFuelEfficiency: number | null;
  currentVehiclePlate: string | null;
  lastSeenAt: string | null;
  scoreHistory: { day: string; value: number | null }[];
  roadEvents: { type: string | null; label: string; count: number; previousCount: number }[];
}

/**
 * Ficha do motorista.
 *
 * Só o que a telemetria mede. Os campos de RH ficam ausentes, e a tela mostra
 * "não informado" neles. Nenhum valor é inventado para preencher espaço.
 */
export async function fetchDriverProfile(driverId: string, days = 30): Promise<DriverProfile> {
  const dto = await httpRequest<DriverProfileDto>(`/v1/drivers/${driverId}/profile?days=${days}`);

  return {
    driverId: dto.driverId,
    phone: dto.phone ?? undefined,
    unit: dto.unit ?? undefined,
    employeeNumber: dto.employeeNumber ?? undefined,
    currentVehiclePlate: dto.currentVehiclePlate ?? undefined,
    avgFuelEfficiency: dto.avgFuelEfficiency ?? undefined,
    hoursDriven: dto.hoursDriven ?? undefined,
    distanceKm: dto.distanceKm ?? undefined,
    journeys: dto.journeys,
    /* Dia sem quilometragem suficiente não vira ponto no gráfico: uma nota
       calculada sobre dois quilômetros seria ruído desenhado como tendência. */
    scoreHistory: dto.scoreHistory
      .filter((point) => point.value != null)
      /* O eixo tem espaço para "26/08", não para "2026-08-26". */
      .map((point) => ({ month: diaCurto(point.day), score: point.value as number })),
    roadEvents: dto.roadEvents.map((row) => ({
      type: toRoadEvent(row.type),
      label: row.label,
      count: row.count,
      delta: row.count - row.previousCount,
    })),
    /* Advertência é fluxo da RookHub, não da telemetria: ainda não existe. */
    warnings: [],
  };
}

interface OperationsDto {
  periodLabel: string;
  vehiclesReady: number;
  vehiclesBlocked: number;
  vehiclesNoSignal: number;
  driversActive: number;
  driversWithoutRecord: number;
  pendingReleases: number;
  awaitingOwner: number;
  openAnomalies: number;
  metrics: {
    id: string;
    label: string;
    value: number;
    unit: string | null;
    delta: number | null;
    lowerIsBetter: boolean;
    hint: string;
  }[];
  trend: { label: string; fatigue: number; harshDriving: number; speeding: number }[];
}

/**
 * Prontidão da operação, o quadro que o gestor abre de manhã.
 *
 * Três filas saem em zero e continuam em zero: liberações, aguardando o dono e
 * anomalias. São fluxo interno da RookHub, não telemetria, e ainda não existem.
 * A tela mostra zero, que é a resposta honesta.
 */
export async function fetchOperations(days = 7): Promise<ManagerOverview> {
  const dto = await httpRequest<OperationsDto>(`/v1/fleet/operations?days=${days}`);

  return {
    periodLabel: dto.periodLabel,
    source: 'Telemetria MiX, atualizada a cada cinco minutos',
    vehiclesReady: dto.vehiclesReady,
    vehiclesBlocked: dto.vehiclesBlocked,
    vehiclesNoSignal: dto.vehiclesNoSignal,
    driversReady: dto.driversActive,
    driversUnavailable: dto.driversWithoutRecord,
    pendingReleases: dto.pendingReleases,
    awaitingOwner: dto.awaitingOwner,
    openAnomalies: dto.openAnomalies,
    metrics: dto.metrics.map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      unit: m.unit || undefined,
      delta: m.delta ?? undefined,
      lowerIsBetter: m.lowerIsBetter,
      hint: m.hint,
    })),
    trend: dto.trend.map((t) => ({
      label: diaCurto(t.label),
      fatigue: t.fatigue,
      harshDriving: t.harshDriving,
      speeding: t.speeding,
    })),
    /* Reprovação de checklist depende do módulo de checklist, que ainda não
       existe no backend. Lista vazia, e a tela já trata vazio. */
    failures: [],
  };
}

interface DriverHoursDto {
  driverId: string;
  name: string;
  currentVehiclePlate: string;
  drivingSeconds: number;
  longestStretchSeconds: number;
  longestBreakSeconds: number;
  firstStart: string;
  lastEnd: string;
  journeys: number;
  distanceKm: number | null;
  violations: string[];
}

export interface DriverHours {
  driverId: string;
  name: string;
  plate: string;
  drivingSeconds: number;
  longestStretchSeconds: number;
  longestBreakSeconds: number;
  firstStart: string;
  lastEnd: string;
  journeys: number;
  distanceKm?: number | undefined;
  violations: string[];
}

/**
 * Jornada dos motoristas nas últimas horas.
 *
 * ⚠️ Indicador de risco, não ponto eletrônico. Mede o veículo andando com aquele
 * condutor identificado; quem dirige sem se identificar não aparece.
 */
export async function fetchDriverHours(hours = 24): Promise<DriverHours[]> {
  const rows = await httpRequest<DriverHoursDto[]>(`/v1/drivers/hours?hours=${hours}`);
  return rows.map((row) => ({
    driverId: row.driverId,
    name: row.name,
    plate: row.currentVehiclePlate,
    drivingSeconds: row.drivingSeconds,
    longestStretchSeconds: row.longestStretchSeconds,
    longestBreakSeconds: row.longestBreakSeconds,
    firstStart: row.firstStart,
    lastEnd: row.lastEnd,
    journeys: row.journeys,
    distanceKm: row.distanceKm ?? undefined,
    violations: row.violations,
  }));
}

/**
 * Um ponto da rota percorrida.
 *
 * Carrega horário e velocidade além da coordenada: é o que permite refazer o dia
 * ponto a ponto. Só o par de números diz por onde passou, e não quando nem a que
 * velocidade, que é o que se quer saber ao reconstituir uma ocorrência.
 */
export interface TrackPoint {
  coordinates: [number, number];
  at: string;
  speedKmh?: number | undefined;
}

interface TrackPointDto {
  lng: number;
  lat: number;
  at: string;
  speedKmh: number | null;
}

export async function fetchVehicleTrack(vehicleId: string, hours = 24): Promise<TrackPoint[]> {
  const dto = await httpRequest<{ hours: number; points: TrackPointDto[] }>(
    `/v1/vehicles/${vehicleId}/track?hours=${hours}`,
  );
  return dto.points.map((p) => ({
    coordinates: [p.lng, p.lat] as [number, number],
    at: p.at,
    speedKmh: p.speedKmh ?? undefined,
  }));
}

/**
 * Desempenho de uma filial.
 *
 * Taxa ausente significa que a filial não rodou no período, e não que rodou
 * perfeitamente. Zero em "eventos por mil km" leria como frota exemplar.
 */
export interface UnitPerformance {
  unit: string;
  vehicles: number;
  reporting: number;
  distanceKm?: number | undefined;
  journeys: number;
  events: number;
  eventsPer1000Km?: number | undefined;
  avgFuelEfficiency?: number | undefined;
  idleHours?: number | undefined;
}

interface UnitPerformanceDto {
  unit: string;
  vehicles: number;
  reporting: number;
  distanceKm: number | null;
  journeys: number;
  events: number;
  eventsPer1000Km: number | null;
  avgFuelEfficiency: number | null;
  idleHours: number | null;
}

/** Comparação entre filiais. A árvore de unidades vem do cadastro do fornecedor. */
export async function fetchUnitPerformance(days = 30): Promise<UnitPerformance[]> {
  const rows = await httpRequest<UnitPerformanceDto[]>(`/v1/fleet/units?days=${days}`);
  return rows.map((row) => ({
    unit: row.unit,
    vehicles: row.vehicles,
    reporting: row.reporting,
    distanceKm: row.distanceKm ?? undefined,
    journeys: row.journeys,
    events: row.events,
    eventsPer1000Km: row.eventsPer1000Km ?? undefined,
    avgFuelEfficiency: row.avgFuelEfficiency ?? undefined,
    idleHours: row.idleHours ?? undefined,
  }));
}

/** Uma célula do mapa de calor, já agregada pelo backend. */
export interface HeatPoint {
  coordinates: [number, number];
  total: number;
  critical: number;
}

/**
 * Onde a frota gera evento.
 *
 * Vem agregado em células de cerca de 110 metros, a escala de um cruzamento.
 * Mandar os doze mil eventos crus seria quase um megabyte por carregamento, e o
 * mapa de calor não precisa da coordenada exata: precisa saber onde concentrou.
 */
export async function fetchEventHeatmap(days = 7, category?: string): Promise<HeatPoint[]> {
  const query = new URLSearchParams({ days: String(days) });
  if (category) query.set('category', category);

  const rows = await httpRequest<{ lng: number; lat: number; total: number; critical: number }[]>(
    `/v1/safety/heatmap?${query.toString()}`,
  );
  return rows.map((r) => ({
    coordinates: [r.lng, r.lat] as [number, number],
    total: r.total,
    critical: r.critical,
  }));
}

/* -------------------------------------------------------------------------- */
/* Trechos e paradas                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Um trecho percorrido: da chave girada até o motor desligado.
 *
 * ⚠️ **Não é a viagem de frete.** Não tem cliente, carga nem valor, porque a
 * telemetria não sabe nada disso. Chamar de viagem na tela faria o gestor
 * procurar aqui o faturamento do mês.
 */
export interface Journey {
  id: string;
  vehicleId: string;
  plate: string;
  unit?: string | undefined;
  driverId?: string | undefined;
  /** Ausente quando ninguém se identificou ao volante. */
  driverName?: string | undefined;
  startedAt: string;
  endedAt: string;
  durationSeconds?: number | undefined;
  drivingSeconds?: number | undefined;
  idleSeconds?: number | undefined;
  distanceKm?: number | undefined;
  maxSpeedKmh?: number | undefined;
  avgSpeedKmh?: number | undefined;
  fuelUsedLitres?: number | undefined;
  fuelEfficiency?: number | undefined;
  startAddress?: string | undefined;
  endAddress?: string | undefined;
  startCoordinates?: [number, number] | undefined;
  endCoordinates?: [number, number] | undefined;
}

export interface JourneyPage {
  journeys: Journey[];
  /** Trechos abaixo do piso de distância. A tela diz o número em vez de escondê-los. */
  ignored: number;
  minKm: number;
}

interface JourneyDto {
  id: string;
  vehicleId: string;
  plate: string;
  unit: string | null;
  driverId: string | null;
  driverName: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number | null;
  drivingSeconds: number | null;
  idleSeconds: number | null;
  distanceKm: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  fuelUsedLitres: number | null;
  fuelEfficiency: number | null;
  startAddress: string | null;
  endAddress: string | null;
  startCoordinates: [number, number] | null;
  endCoordinates: [number, number] | null;
}

export interface JourneyFilters {
  days?: number | undefined;
  minKm?: number | undefined;
  search?: string | undefined;
  vehicleId?: string | undefined;
}

export async function fetchJourneys(filters: JourneyFilters = {}): Promise<JourneyPage> {
  const query = new URLSearchParams({
    days: String(filters.days ?? 7),
    minKm: String(filters.minKm ?? 0.5),
  });
  if (filters.search) query.set('search', filters.search);
  if (filters.vehicleId) query.set('vehicleId', filters.vehicleId);

  const page = await httpRequest<{ journeys: JourneyDto[]; ignored: number; minKm: number }>(
    `/v1/fleet/journeys?${query.toString()}`,
  );

  return {
    ignored: page.ignored,
    minKm: page.minKm,
    journeys: page.journeys.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      plate: row.plate,
      unit: row.unit ?? undefined,
      driverId: row.driverId ?? undefined,
      driverName: row.driverName ?? undefined,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: row.durationSeconds ?? undefined,
      drivingSeconds: row.drivingSeconds ?? undefined,
      idleSeconds: row.idleSeconds ?? undefined,
      distanceKm: row.distanceKm ?? undefined,
      maxSpeedKmh: row.maxSpeedKmh ?? undefined,
      avgSpeedKmh: row.avgSpeedKmh ?? undefined,
      fuelUsedLitres: row.fuelUsedLitres ?? undefined,
      fuelEfficiency: row.fuelEfficiency ?? undefined,
      startAddress: row.startAddress ?? undefined,
      endAddress: row.endAddress ?? undefined,
      startCoordinates: row.startCoordinates ?? undefined,
      endCoordinates: row.endCoordinates ?? undefined,
    })),
  };
}

/**
 * Um lugar onde a frota para com frequência.
 *
 * ⚠️ `address` é o endereço mais frequente do agrupamento, e não um cadastro. O
 * sistema não sabe se ali é a base, um cliente ou um posto: quem olha reconhece.
 */
export interface FrequentStop {
  coordinates: [number, number];
  address?: string | undefined;
  stops: number;
  vehicles: number;
  totalHours: number;
  avgMinutes?: number | undefined;
  longestHours: number;
  lastAt?: string | undefined;
}

export async function fetchFrequentStops(days = 30, minMinutes = 20): Promise<FrequentStop[]> {
  const rows = await httpRequest<
    {
      lat: number;
      lng: number;
      address: string | null;
      stops: number;
      vehicles: number;
      totalHours: number;
      avgMinutes: number | null;
      longestHours: number;
      lastAt: string | null;
    }[]
  >(`/v1/fleet/stops?days=${days}&minMinutes=${minMinutes}`);

  return rows.map((row) => ({
    coordinates: [row.lng, row.lat] as [number, number],
    address: row.address ?? undefined,
    stops: row.stops,
    vehicles: row.vehicles,
    totalHours: row.totalHours,
    avgMinutes: row.avgMinutes ?? undefined,
    longestHours: row.longestHours,
    lastAt: row.lastAt ?? undefined,
  }));
}

/* -------------------------------------------------------------------------- */
/* Cadastro editável do veículo                                                */
/* -------------------------------------------------------------------------- */

/**
 * O que a operação possui do veículo.
 *
 * ⚠️ **Não existe criar veículo.** A frota vem do fornecedor de telemetria: um
 * caminhão aparece aqui quando o rastreador dele existe. Uma placa criada à mão
 * nunca reportaria posição e ficaria para sempre como "sem sinal" no mapa, ao
 * lado de caminhões de verdade que perderam sinal.
 *
 * O que dá para editar é o que a telemetria não sabe.
 */
export interface VehicleRegistry {
  vehicleId: string;
  plate: string;
  internalCode?: string | undefined;
  manualNotes?: string | undefined;
  nextMaintenanceKm?: number | undefined;
  nextMaintenanceDate?: string | undefined;
  /** Quilômetros até a revisão. Negativo significa vencida. */
  kmToMaintenance?: number | undefined;

  /**
   * De onde o veículo veio.
   *
   * ⚠️ `ROOKHUB` significa cadastrado a mão, e portanto SEM RASTREADOR: ele
   * nunca vai reportar posição. A tela precisa dizer "sem rastreador" e não
   * "sem sinal", porque a primeira é uma escolha de cadastro e a segunda é um
   * problema para alguém investigar.
   */
  origin: 'TELEMETRIA' | 'ROOKHUB';
  /**
   * O veículo faz parte da frota.
   *
   * ⚠️ Não confundir com `outOfService`. Fora de serviço é o caminhão parado
   * agora, com motivo, e ele volta. Inativo é o que saiu da frota: vendido,
   * devolvido, fim de contrato.
   */
  active: boolean;
  inactiveSource?: 'TELEMETRIA' | 'OPERACAO' | undefined;

  /* Identificação */
  renavam?: string | undefined;
  /** Chassi. A MiX tem o campo e entrega vazio nos 40 ativos desta frota. */
  vin?: string | undefined;
  fleetNumber?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  /** Ano de FABRICAÇÃO, o primeiro número do "2023/2024" do documento. */
  year?: number | undefined;
  modelYear?: number | undefined;
  color?: string | undefined;

  /* Ficha técnica */
  bodyClass?: string | undefined;
  bodyType?: string | undefined;
  axles?: number | undefined;
  fuelType?: string | undefined;
  tareWeightKg?: number | undefined;
  payloadKg?: number | undefined;
  cargoVolumeM3?: number | undefined;
  tankCapacityL?: number | undefined;
  referenceKmpl?: number | undefined;

  /* Documentação */
  licensingDueDate?: string | undefined;
  rntrc?: string | undefined;
  tachographDueDate?: string | undefined;

  /* Propriedade */
  ownership?: string | undefined;
  ownerName?: string | undefined;
  ownerDocument?: string | undefined;
  acquiredAt?: string | undefined;
  acquisitionKind?: string | undefined;
  outOfService: boolean;
  outOfServiceReason?: string | undefined;
  outOfServiceSince?: string | undefined;
  updatedAt?: string | undefined;
  updatedByName?: string | undefined;
}

interface VehicleRegistryDto {
  vehicleId: string;
  plate: string;
  internalCode: string | null;
  manualNotes: string | null;
  nextMaintenanceKm: number | null;
  nextMaintenanceDate: string | null;
  kmToMaintenance: number | null;
  origin: 'TELEMETRIA' | 'ROOKHUB';
  active: boolean;
  inactiveSource: 'TELEMETRIA' | 'OPERACAO' | null;
  renavam: string | null;
  vin: string | null;
  fleetNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  modelYear: number | null;
  color: string | null;
  bodyClass: string | null;
  bodyType: string | null;
  axles: number | null;
  fuelType: string | null;
  tareWeightKg: number | null;
  payloadKg: number | null;
  cargoVolumeM3: number | null;
  tankCapacityL: number | null;
  referenceKmpl: number | null;
  licensingDueDate: string | null;
  rntrc: string | null;
  tachographDueDate: string | null;
  ownership: string | null;
  ownerName: string | null;
  ownerDocument: string | null;
  acquiredAt: string | null;
  acquisitionKind: string | null;
  outOfService: boolean;
  outOfServiceReason: string | null;
  outOfServiceSince: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

const toRegistry = (dto: VehicleRegistryDto): VehicleRegistry => ({
  vehicleId: dto.vehicleId,
  plate: dto.plate,
  internalCode: dto.internalCode ?? undefined,
  manualNotes: dto.manualNotes ?? undefined,
  nextMaintenanceKm: dto.nextMaintenanceKm ?? undefined,
  nextMaintenanceDate: dto.nextMaintenanceDate ?? undefined,
  kmToMaintenance: dto.kmToMaintenance ?? undefined,
  origin: dto.origin,
  active: dto.active,
  inactiveSource: dto.inactiveSource ?? undefined,
  renavam: dto.renavam ?? undefined,
  vin: dto.vin ?? undefined,
  fleetNumber: dto.fleetNumber ?? undefined,
  manufacturer: dto.manufacturer ?? undefined,
  model: dto.model ?? undefined,
  year: dto.year ?? undefined,
  modelYear: dto.modelYear ?? undefined,
  color: dto.color ?? undefined,
  bodyClass: dto.bodyClass ?? undefined,
  bodyType: dto.bodyType ?? undefined,
  axles: dto.axles ?? undefined,
  fuelType: dto.fuelType ?? undefined,
  tareWeightKg: dto.tareWeightKg ?? undefined,
  payloadKg: dto.payloadKg ?? undefined,
  cargoVolumeM3: dto.cargoVolumeM3 ?? undefined,
  tankCapacityL: dto.tankCapacityL ?? undefined,
  referenceKmpl: dto.referenceKmpl ?? undefined,
  licensingDueDate: dto.licensingDueDate ?? undefined,
  rntrc: dto.rntrc ?? undefined,
  tachographDueDate: dto.tachographDueDate ?? undefined,
  ownership: dto.ownership ?? undefined,
  ownerName: dto.ownerName ?? undefined,
  ownerDocument: dto.ownerDocument ?? undefined,
  acquiredAt: dto.acquiredAt ?? undefined,
  acquisitionKind: dto.acquisitionKind ?? undefined,
  outOfService: dto.outOfService,
  outOfServiceReason: dto.outOfServiceReason ?? undefined,
  outOfServiceSince: dto.outOfServiceSince ?? undefined,
  updatedAt: dto.updatedAt ?? undefined,
  updatedByName: dto.updatedByName ?? undefined,
});

export async function fetchVehicleRegistry(vehicleId: string): Promise<VehicleRegistry> {
  const dto = await httpRequest<VehicleRegistryDto>(`/v1/vehicles/${vehicleId}/registry`);
  return toRegistry(dto);
}

/**
 * Só os campos presentes são enviados.
 *
 * ⚠️ O backend distingue TRÊS estados: campo ausente preserva, campo com valor
 * grava, campo `null` apaga. Mandar o formulário inteiro a cada salvamento
 * apagaria o que o usuário nem abriu.
 */
export interface VehicleRegistryPatch {
  renavam?: string | null;
  vin?: string | null;
  fleetNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  year?: number | null;
  modelYear?: number | null;
  color?: string | null;
  bodyClass?: string | null;
  bodyType?: string | null;
  axles?: number | null;
  fuelType?: string | null;
  tareWeightKg?: number | null;
  payloadKg?: number | null;
  cargoVolumeM3?: number | null;
  tankCapacityL?: number | null;
  referenceKmpl?: number | null;
  licensingDueDate?: string | null;
  rntrc?: string | null;
  tachographDueDate?: string | null;
  ownership?: string | null;
  ownerName?: string | null;
  ownerDocument?: string | null;
  acquiredAt?: string | null;
  acquisitionKind?: string | null;
  internalCode?: string | null;
  manualNotes?: string | null;
  nextMaintenanceKm?: number | null;
  nextMaintenanceDate?: string | null;
  outOfService?: boolean;
  outOfServiceReason?: string | null;
}

export async function saveVehicleRegistry(
  vehicleId: string,
  patch: VehicleRegistryPatch,
): Promise<VehicleRegistry> {
  const dto = await httpRequest<VehicleRegistryDto>(`/v1/vehicles/${vehicleId}/registry`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return toRegistry(dto);
}

/**
 * Cadastra um caminhão que a telemetria não conhece.
 *
 * ⚠️ O veículo nasce marcado como cadastrado aqui, e nunca vai reportar
 * posição, porque não tem rastreador. A tela mostra "sem rastreador" no lugar
 * de "sem sinal": a primeira é uma escolha de cadastro e não pede nada de
 * ninguém, a segunda é um problema que leva alguém a ligar para a filial.
 *
 * A placa é a chave de reconciliação com o fornecedor. Se este caminhão
 * ganhar rastreador depois, a sincronização casa pela placa e passa a
 * alimentar este registro em vez de criar um segundo.
 */
export async function createVehicle(
  plate: string,
  patch: VehicleRegistryPatch,
): Promise<VehicleRegistry> {
  const dto = await httpRequest<VehicleRegistryDto>(`/v1/vehicles`, {
    method: 'POST',
    body: JSON.stringify({ plate, ...patch }),
  });
  return toRegistry(dto);
}

/**
 * Liga ou desliga um veículo sem abrir o formulário.
 *
 * ⚠️ Não é o mesmo que tirar de serviço. Fora de serviço é o caminhão parado
 * agora, com motivo, e ele volta; inativo é o que saiu da frota. Rota separada
 * da edição porque salvar a ficha congela o veículo para a sincronização, e
 * ligar e desligar é operação do dia a dia.
 */
export async function setVehicleActive(
  vehicleId: string,
  active: boolean,
): Promise<VehicleRegistry> {
  const dto = await httpRequest<VehicleRegistryDto>(`/v1/vehicles/${vehicleId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
  return toRegistry(dto);
}

/**
 * Apaga um veículo que não deixou rastro.
 *
 * ⚠️ Não é o mesmo que tirar de serviço, e a tela precisa deixar isso claro.
 * Fora de serviço é para o caminhão que existe e está parado: o histórico dele
 * continua respondendo por quilômetro rodado e por evento. Excluir é para o
 * registro fantasma, e nesta frota ele apareceu: o cliente recadastrou um
 * caminhão transferido com duas letras da placa trocadas, e a plataforma passou
 * a enxergar 41 caminhões onde existem 40.
 *
 * O backend **recusa com 409** quando existe viagem, evento ou posição, e a
 * mensagem dele diz o que prende. É essa mensagem que deve chegar à tela.
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  await httpRequest<void>(`/v1/vehicles/${vehicleId}`, { method: 'DELETE' });
}

/* -------------------------------------------------------------------------- */
/* Lista da tela de cadastro                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Uma linha da tela de cadastro de frota.
 *
 * ⚠️ Vem de `/v1/vehicles/registry`, que NÃO filtra nada. A rota `/v1/vehicles`,
 * usada pelo painel e pelo mapa, agrega e esconde o que não interessa ao
 * operador. Esta tela existe para mostrar o que está errado, então recebe tudo:
 * foi assim que os dois ativos com o número de frota gravado no lugar da placa
 * apareceram.
 */
export interface VehicleListEntry {
  id: string;
  plate: string;
  /** O número pintado na porta, como o fornecedor entrega. */
  fleetNumber: string | null;
  /** O mesmo número, quando alguém corrigiu na tela. */
  internalCode: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  /** A empresa, já consolidada. O subgrupo do fornecedor não chega aqui. */
  companyName: string | null;
  /**
   * O que o fornecedor diz do rastreador.
   *
   * ⚠️ Chega cru, e não traduzido para ativo/inativo. `Unavailable` quase
   * sempre significa "este é o registro velho de uma transferência", e não
   * "caminhão parado": nesta frota são 13 placas que existem em duas empresas
   * ao mesmo tempo, sempre com a nova disponível e a velha indisponível.
   */
  supplierState: string | null;
  /** Decisão da operação daqui, diferente do estado do fornecedor. */
  outOfService: boolean;
  outOfServiceReason: string | null;
  odometerKm: number | null;
  /** Última posição conhecida. Nulo quando não houve sinal na janela coletada. */
  lastSeenAt: string | null;
  /** A classificação que o pátio usa: cavalo, truck, toco, VUC. */
  bodyClass: string | null;
  /**
   * O veículo faz parte da frota.
   *
   * ⚠️ Diferente de `outOfService`, que é parada temporária com motivo.
   * Inativo é o caminhão que saiu da frota e não volta.
   */
  active: boolean;
  inactiveSource: 'TELEMETRIA' | 'OPERACAO' | null;
  /** ROOKHUB não tem rastreador: é "sem rastreador", e não "sem sinal". */
  origin: 'TELEMETRIA' | 'ROOKHUB';
  /** Uma pessoa já salvou esta ficha, e a sincronização respeita o que ela escreveu. */
  reviewed: boolean;
}

export async function fetchVehicleRegistryList(): Promise<VehicleListEntry[]> {
  return httpRequest<VehicleListEntry[]>('/v1/vehicles/registry');
}

/* -------------------------------------------------------------------------- */
/* Desempenho por veículo                                                      */
/* -------------------------------------------------------------------------- */

/**
 * O que cada caminhão fez no período.
 *
 * ⚠️ **Não é rentabilidade.** Receita por caminhão depende de frete, e custo por
 * caminhão depende de abastecimento e manutenção: nenhum dos três existe no
 * sistema. O que dá para comparar é o que o veículo fez, e isso já responde a
 * pergunta que o dono faz, que é qual ativo está saindo caro.
 *
 * Taxa e consumo vêm ausentes quando o veículo praticamente não rodou. Zero em
 * "eventos por mil km" leria como caminhão exemplar quando significa que ele não
 * saiu do pátio.
 */
export interface VehiclePerformance {
  vehicleId: string;
  plate: string;
  model: string;
  unit?: string | undefined;
  type?: string | undefined;
  distanceKm?: number | undefined;
  journeys: number;
  daysUsed: number;
  drivingHours?: number | undefined;
  idleHours?: number | undefined;
  fuelEfficiency?: number | undefined;
  events: number;
  eventsPer1000Km?: number | undefined;
}

interface VehiclePerformanceDto {
  vehicleId: string;
  plate: string;
  model: string;
  unit: string | null;
  type: string | null;
  distanceKm: number | null;
  journeys: number;
  daysUsed: number;
  drivingHours: number | null;
  idleHours: number | null;
  fuelEfficiency: number | null;
  events: number;
  eventsPer1000Km: number | null;
}

export async function fetchVehiclePerformance(days = 30): Promise<VehiclePerformance[]> {
  const rows = await httpRequest<VehiclePerformanceDto[]>(`/v1/vehicles/performance?days=${days}`);
  return rows.map((row) => ({
    vehicleId: row.vehicleId,
    plate: row.plate,
    model: row.model,
    unit: row.unit ?? undefined,
    type: row.type ?? undefined,
    distanceKm: row.distanceKm ?? undefined,
    journeys: row.journeys,
    daysUsed: row.daysUsed,
    drivingHours: row.drivingHours ?? undefined,
    idleHours: row.idleHours ?? undefined,
    fuelEfficiency: row.fuelEfficiency ?? undefined,
    events: row.events,
    eventsPer1000Km: row.eventsPer1000Km ?? undefined,
  }));
}

/* -------------------------------------------------------------------------- */
/* Equipe                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Uma pessoa do time.
 *
 * ⚠️ São DUAS origens diferentes na mesma lista. Motorista vem da telemetria, e
 * é de lá que saem nome, filial e o que a pessoa rodou. Usuário de painel vem do
 * nosso banco: é quem tem senha e entra no sistema.
 *
 * Os dois conjuntos quase não se cruzam, e por isso a contagem é separada: um
 * total único de "funcionários" não corresponderia a nenhuma folha.
 */
export interface TeamMember {
  kind: 'MOTORISTA' | 'PAINEL';
  id: string;
  name: string;
  unit?: string | undefined;
  email?: string | undefined;
  role?: string | undefined;
  active: boolean;
  distanceKm?: number | undefined;
  journeys?: number | undefined;
  criticalEvents?: number | undefined;
  currentVehiclePlate?: string | undefined;
  lastSeenAt?: string | undefined;
}

export interface TeamOverview {
  headcount: number;
  drivers: number;
  staff: number;
  driversActive: number;
  /** Sem trecho no período. NÃO é indisponibilidade: ver a nota do backend. */
  driversWithoutRecord: number;
  staffInactive: number;
  people: TeamMember[];
}

interface TeamMemberDto {
  kind: string;
  id: string;
  name: string;
  unit: string | null;
  email: string | null;
  role: string | null;
  active: boolean;
  score: number | null;
  distanceKm: number | null;
  journeys: number | null;
  criticalEvents: number | null;
  currentVehiclePlate: string | null;
  lastSeenAt: string | null;
}

export async function fetchTeam(days = 30): Promise<TeamOverview> {
  const dto = await httpRequest<{
    headcount: number;
    drivers: number;
    staff: number;
    driversActive: number;
    driversWithoutRecord: number;
    staffInactive: number;
    people: TeamMemberDto[];
  }>(`/v1/team?days=${days}`);

  return {
    headcount: dto.headcount,
    drivers: dto.drivers,
    staff: dto.staff,
    driversActive: dto.driversActive,
    driversWithoutRecord: dto.driversWithoutRecord,
    staffInactive: dto.staffInactive,
    people: dto.people.map((row) => ({
      kind: row.kind === 'PAINEL' ? 'PAINEL' : 'MOTORISTA',
      id: row.id,
      name: row.name,
      unit: row.unit ?? undefined,
      email: row.email ?? undefined,
      role: row.role ?? undefined,
      active: row.active,
      distanceKm: row.distanceKm ?? undefined,
      journeys: row.journeys ?? undefined,
      criticalEvents: row.criticalEvents ?? undefined,
      currentVehiclePlate: row.currentVehiclePlate ?? undefined,
      lastSeenAt: row.lastSeenAt ?? undefined,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Cadastro de motorista                                                       */
/* -------------------------------------------------------------------------- */

/**
 * O motorista que a operação cadastra.
 *
 * ⚠️ Existe criação de motorista, e não existe de veículo. Não é incoerência:
 * um caminhão só existe para a plataforma porque tem rastreador, e uma placa
 * digitada à mão nunca reportaria posição. Uma pessoa é contratada antes de
 * qualquer equipamento, e o CPF e a CNH dela nunca vieram da telemetria.
 */

/**
 * Uma empresa do cliente.
 *
 * ⚠️ Empresa, e não filial. A SERVIOESTE tem 5 empresas e 15 subgrupos no
 * fornecedor, e os subgrupos são de três tipos que não descrevem operação
 * nenhuma: o nome da cidade, o "Default Site" onde a MiX joga o que ninguém
 * classificou, e o "DESLIGADOS / INATIVOS" que é o arquivo morto do cliente.
 * Quatro filiais se chamam "Default Site" e cinco se chamam "DESLIGADOS /
 * INATIVOS", indistinguíveis num seletor.
 *
 * Decisão do usuário em 30/08/2026: a tela mostra a empresa, e quem está em
 * qualquer subgrupo dela conta como sendo dela.
 */
export interface FleetCompany {
  id: string;
  name: string;
}

export interface NewDriverInput {
  name: string;
  document: string;
  phone: string | null;
  email: string | null;
  license: string | null;
  cnhCategory: string;
  cnhExpiresAt: string;
  hiredAt: string | null;
  companyId: string | null;
  employeeNumber: string | null;
  manualNotes: string | null;
  active: boolean;
  /**
   * Data URL da foto, já reduzida a um quadrado pequeno pelo navegador.
   *
   * Nula quando ninguém escolheu foto. ⚠️ Na edição, nula significa "não mexi",
   * e não "remova": o formulário abre sem carregar os bytes da foto atual.
   */
  photo: string | null;
}

export interface DriverRegistry {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  license: string | null;
  cnhCategory: string | null;
  cnhExpiresAt: string | null;
  hiredAt: string | null;
  companyId: string | null;
  companyName: string | null;
  employeeNumber: string | null;
  manualNotes: string | null;
  active: boolean;
  inactiveSource: 'TELEMETRIA' | 'OPERACAO' | null;
  createdByOperation: boolean;
}

/**
 * Empresas do cliente. Vazio numa empresa que ainda não sincronizou.
 *
 * O caminho continua `/v1/fleet/sites` porque o app do motorista consome a mesma
 * rota. O que mudou foi o conteúdo, não o endereço.
 */
export async function fetchFleetCompanies(): Promise<FleetCompany[]> {
  return httpRequest<FleetCompany[]>('/v1/fleet/sites');
}

export async function createDriver(input: NewDriverInput): Promise<DriverRegistry> {
  return httpRequest<DriverRegistry>('/v1/drivers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** A ficha gravada, para abrir a edição com os campos preenchidos. */
export async function fetchDriverRegistryEntry(id: string): Promise<DriverRegistry> {
  return httpRequest<DriverRegistry>(`/v1/drivers/${id}/registry`);
}

/**
 * Salva a ficha inteira de um motorista que já existe.
 *
 * ⚠️ Gravar aqui congela este motorista para a sincronização: a partir do
 * primeiro salvamento, a telemetria não sobrescreve mais nome, telefone,
 * matrícula, empresa nem foto dele. É o que torna a correção duradoura, e é o
 * ponto do produto: o cadastro do fornecedor é ponto de partida, não fonte de
 * verdade.
 */
export async function updateDriver(id: string, input: NewDriverInput): Promise<DriverRegistry> {
  return httpRequest<DriverRegistry>(`/v1/drivers/${id}/registry`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Liga ou desliga um motorista sem abrir o formulário.
 *
 * Rota separada da edição porque salvar a ficha exige nome e CPF válidos, e a
 * maior parte de quem veio da telemetria ainda não tem CPF. Exigir a ficha
 * inteira travaria justamente a ação que a importação deixa pendente em 47
 * pessoas.
 */
export async function setDriverActive(id: string, active: boolean): Promise<DriverRegistry> {
  return httpRequest<DriverRegistry>(`/v1/drivers/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

/**
 * Apaga um motorista que não deixou rastro.
 *
 * ⚠️ Não é o mesmo que inativar, e a tela precisa deixar isso claro. Inativar é
 * para quem saiu da empresa: o histórico dele continua respondendo por
 * quilômetro rodado e por evento de segurança. Excluir é para o cadastro que
 * nunca deveria ter existido, e o backend **recusa com 409** quando existe
 * viagem, evento, posição ou caminhão apontando para a pessoa. A mensagem do
 * erro diz o que prende, e é ela que deve chegar à tela.
 */
export async function deleteDriver(id: string): Promise<void> {
  await httpRequest<void>(`/v1/drivers/${id}`, { method: 'DELETE' });
}

/* -------------------------------------------------------------------------- */
/* Lista da tela de cadastro                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Uma linha da tela de cadastro de motoristas.
 *
 * ⚠️ Vem de `/v1/drivers/registry`, que NÃO filtra nada. A rota `/v1/drivers`,
 * usada pelo ranking e pela operação, esconde conta de sistema e inativo de
 * propósito. Esta tela existe para mostrar o que está sujo, então recebe tudo.
 */
export interface DriverListEntry {
  id: string;
  name: string;
  document: string | null;
  cnhCategory: string | null;
  cnhExpiresAt: string | null;
  /** A empresa, já consolidada. O subgrupo do fornecedor não chega aqui. */
  companyName: string | null;
  employeeNumber: string | null;
  phone: string | null;
  origin: 'ROOKHUB' | 'TELEMETRIA';
  /** Atividade medida, e só ela. */
  situation: 'ATIVO' | 'PARADO' | 'NAO_E_PESSOA';
  /**
   * A filial no fornecedor tem nome de arquivo morto (DESLIGADOS, INATIVOS).
   *
   * ⚠️ Separado da situação de propósito: quem está marcado assim e mesmo
   * assim rodou é o caso que precisa de alguém olhando, e juntar as duas
   * informações apagaria exatamente esse caso.
   */
  markedInactive: boolean;
  lastJourneyAt: string | null;
  distance30d: number | null;
  currentVehiclePlate: string | null;
  active: boolean;
  /**
   * Quem apagou a chave: `TELEMETRIA` para quem já chegou desligado do
   * fornecedor, `OPERACAO` para quem alguém inativou na tela. Nulo enquanto
   * está ativo. A tela usa para não acusar uma pessoa de uma decisão que foi da
   * importação.
   */
  inactiveSource: 'TELEMETRIA' | 'OPERACAO' | null;
  /**
   * Uma pessoa já salvou esta ficha, e a partir daí a telemetria não escreve
   * mais neste motorista. É o placar do trabalho que a tela existe para fazer.
   */
  reviewed: boolean;
  hasPhoto: boolean;
}

export async function fetchDriverRegistry(): Promise<DriverListEntry[]> {
  return httpRequest<DriverListEntry[]>('/v1/drivers/registry');
}

/**
 * A foto do motorista, como URL de objeto para um `<img>`.
 *
 * Quem chama é dono da URL e precisa revogá-la ao desmontar. Ver `httpBlob`.
 */
export async function fetchDriverPhoto(driverId: string): Promise<string> {
  return httpBlob(`/v1/drivers/${driverId}/photo`);
}
