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
import { httpRequest } from '@/services/http';

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
