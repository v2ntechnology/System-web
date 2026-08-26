import type {
  Driver,
  DriverProfile,
  DriverRankEntry,
  EventMedia,
  RankingPeriod,
  RoadEventCount,
  RoadEventType,
} from '@/management/types';

import avatarSample from '@imgs/imgFace.jpg';

import { ApiError, delay } from './latency';

/** ⚠️ Motoristas fictícios. Score coerente com a contagem de eventos críticos. */
const DRIVERS: Driver[] = [
  {
    id: 'drv-001',
    name: 'Vinícius Vila Nova',
    avatarUrl: avatarSample,
    status: 'EM_VIAGEM',
    score: 97,
    scoreDelta: 2,
    tripsCount: 38,
    kmDriven: 14_820,
    criticalEvents: 0,
    cnhCategory: 'E',
    cnhExpiresAt: '2028-04-17',
    currentVehiclePlate: 'RKH7E45',
  },
  {
    id: 'drv-002',
    name: 'Marina Cordeiro',
    status: 'EM_VIAGEM',
    score: 94,
    scoreDelta: 1,
    tripsCount: 41,
    kmDriven: 16_190,
    criticalEvents: 1,
    cnhCategory: 'E',
    cnhExpiresAt: '2027-11-02',
    currentVehiclePlate: 'RKH2B88',
  },
  {
    id: 'drv-003',
    name: 'Edson Bastos',
    status: 'EM_VIAGEM',
    score: 91,
    scoreDelta: -1,
    tripsCount: 35,
    kmDriven: 13_040,
    criticalEvents: 2,
    cnhCategory: 'E',
    cnhExpiresAt: '2026-09-28',
    currentVehiclePlate: 'RKH4F72',
  },
  {
    id: 'drv-004',
    name: 'Patrícia Nunes',
    status: 'EM_VIAGEM',
    score: 88,
    scoreDelta: 4,
    tripsCount: 29,
    kmDriven: 11_460,
    criticalEvents: 2,
    cnhCategory: 'E',
    cnhExpiresAt: '2029-01-15',
    currentVehiclePlate: 'RKH5J19',
  },
  {
    id: 'drv-005',
    name: 'Wagner Teixeira',
    status: 'DESCANSO',
    score: 85,
    scoreDelta: -3,
    tripsCount: 33,
    kmDriven: 12_770,
    criticalEvents: 4,
    cnhCategory: 'E',
    /* CNH vencendo em menos de 60 dias — a página destaca isso. */
    cnhExpiresAt: '2026-09-12',
  },
  {
    id: 'drv-006',
    name: 'Silvana Rocha',
    status: 'DISPONIVEL',
    score: 92,
    scoreDelta: 0,
    tripsCount: 26,
    kmDriven: 9_910,
    criticalEvents: 1,
    cnhCategory: 'D',
    cnhExpiresAt: '2028-07-30',
  },
  {
    id: 'drv-007',
    name: 'Cleber Moraes',
    status: 'AFASTADO',
    score: 79,
    scoreDelta: -6,
    tripsCount: 12,
    kmDriven: 4_380,
    criticalEvents: 5,
    cnhCategory: 'E',
    cnhExpiresAt: '2027-03-08',
  },
];

export async function mockDrivers(): Promise<Driver[]> {
  await delay(550);
  return DRIVERS;
}

/* -------------------------------------------------------------------------- */
/* Ficha completa e rankings                                                   */
/* -------------------------------------------------------------------------- */

const ROAD_EVENT_LABELS: Record<RoadEventType, string> = {
  EXCESSO_VELOCIDADE: 'Excesso de velocidade',
  FRENAGEM_BRUSCA: 'Frenagem brusca',
  CURVA_AGRESSIVA: 'Curva agressiva',
  JORNADA_EXCEDIDA: 'Jornada excedida',
  DISTRACAO: 'Distração ao volante',
  SONOLENCIA: 'Sinal de sonolência',
  ACELERACAO_BRUSCA: 'Aceleração brusca',
  COLISAO_IMINENTE: 'Risco de colisão',
  CINTO_SEGURANCA: 'Cinto de segurança',
};

function roadEvents(counts: Partial<Record<RoadEventType, [number, number]>>): RoadEventCount[] {
  return (Object.keys(ROAD_EVENT_LABELS) as RoadEventType[]).map((type) => {
    const [count, delta] = counts[type] ?? [0, 0];
    return { type, label: ROAD_EVENT_LABELS[type], count, delta };
  });
}

const PROFILES: Record<string, Omit<DriverProfile, 'driverId'>> = {
  'drv-001': {
    birthDate: '1991-03-14',
    cpfMasked: '***.482.117-**',
    phone: '(21) 98812-4470',
    city: 'Duque de Caxias',
    state: 'RJ',
    cnhNumber: '04829173366',
    cnhCategory: 'E',
    cnhExpiresAt: '2028-04-17',
    cnhEar: true,
    cnhPoints: 0,
    hiredAt: '2019-02-04',
    role: 'Motorista carreteiro',
    monthlySalary: 6_480,
    contractType: 'CLT · integral',
    avgFuelEfficiency: 2.8,
    onTimeDeliveryRate: 98.4,
    hoursDriven: 168,
    scoreHistory: [
      { month: 'mar', score: 92 },
      { month: 'abr', score: 93 },
      { month: 'mai', score: 94 },
      { month: 'jun', score: 95 },
      { month: 'jul', score: 95 },
      { month: 'ago', score: 97 },
    ],
    roadEvents: roadEvents({ EXCESSO_VELOCIDADE: [1, -2], FRENAGEM_BRUSCA: [1, 0] }),
    warnings: [],
  },
  'drv-005': {
    birthDate: '1983-11-02',
    cpfMasked: '***.719.044-**',
    phone: '(21) 99604-1182',
    city: 'Nova Iguaçu',
    state: 'RJ',
    cnhNumber: '03918277451',
    cnhCategory: 'E',
    cnhExpiresAt: '2026-09-12',
    cnhEar: true,
    cnhPoints: 17,
    hiredAt: '2014-08-19',
    role: 'Motorista carreteiro',
    monthlySalary: 7_120,
    contractType: 'CLT · integral',
    avgFuelEfficiency: 2.3,
    onTimeDeliveryRate: 91.2,
    hoursDriven: 182,
    scoreHistory: [
      { month: 'mar', score: 91 },
      { month: 'abr', score: 90 },
      { month: 'mai', score: 88 },
      { month: 'jun', score: 87 },
      { month: 'jul', score: 88 },
      { month: 'ago', score: 85 },
    ],
    roadEvents: roadEvents({
      EXCESSO_VELOCIDADE: [9, 3],
      FRENAGEM_BRUSCA: [6, 2],
      CURVA_AGRESSIVA: [3, 1],
      JORNADA_EXCEDIDA: [2, 1],
      SONOLENCIA: [1, 1],
    }),
    warnings: [
      {
        id: 'warn-001',
        title: 'Excesso de velocidade reincidente',
        description:
          'Registrado a 96 km/h em trecho sinalizado para 80 km/h, por 4 minutos contínuos. Terceira ocorrência no mês.',
        severity: 'GRAVE',
        at: '2026-07-29T14:22:00-03:00',
        issuedBy: 'Rafael Antunes · Gestor',
        location: 'BR-101, km 214 — Magé/RJ',
        vehiclePlate: 'RKH8H31',
        media: {
          provider: 'Hik-Connect',
          durationSeconds: 32,
          recordedAt: '2026-07-29T14:22:00-03:00',
        },
      },
      {
        id: 'warn-002',
        title: 'Sinal de sonolência detectado',
        description:
          'Câmera de cabine identificou fechamento de olhos por mais de 2 segundos. Motorista foi orientado a parar no posto seguinte.',
        severity: 'GRAVE',
        at: '2026-07-16T03:48:00-03:00',
        issuedBy: 'Camila Prado · Operadora',
        location: 'BR-116, km 302 — Além Paraíba/MG',
        vehiclePlate: 'RKH8H31',
        contested: true,
        media: {
          provider: 'Hik-Connect',
          durationSeconds: 18,
          recordedAt: '2026-07-16T03:48:00-03:00',
        },
      },
      {
        id: 'warn-003',
        title: 'Jornada acima do limite legal',
        description:
          'Condução contínua de 5h40 sem pausa, acima do limite de 5h30 previsto na Lei do Motorista.',
        severity: 'MEDIA',
        at: '2026-06-28T19:05:00-03:00',
        issuedBy: 'Rafael Antunes · Gestor',
        vehiclePlate: 'RKH5J19',
      },
    ],
  },
};

/** Ficha padrão derivada do motorista — evita mock por pessoa da equipe inteira. */
function fallbackProfile(driver: Driver): Omit<DriverProfile, 'driverId'> {
  /* Motorista vindo da telemetria pode nao ter nota: rodou pouco no periodo.
     A ficha de demonstracao precisa de um numero para derivar os graficos. */
  const nota = driver.score ?? 100;
  const variacao = driver.scoreDelta ?? 0;

  return {
    birthDate: '1988-06-21',
    cpfMasked: '***.000.000-**',
    phone: '(21) 90000-0000',
    city: 'Rio de Janeiro',
    state: 'RJ',
    cnhNumber: '00000000000',
    /* Motorista vindo da telemetria não traz CNH: os dois campos são do RH. */
    cnhCategory: driver.cnhCategory ?? 'E',
    cnhExpiresAt: driver.cnhExpiresAt ?? '2027-12-31',
    cnhEar: true,
    cnhPoints: Math.max(0, Math.round((100 - nota) / 3)),
    hiredAt: '2021-05-10',
    role: 'Motorista carreteiro',
    monthlySalary: 5_900,
    contractType: 'CLT · integral',
    avgFuelEfficiency: Math.round((nota / 34) * 10) / 10,
    onTimeDeliveryRate: Math.round((nota * 0.99 + 5) * 10) / 10,
    hoursDriven: 160,
    scoreHistory: ['mar', 'abr', 'mai', 'jun', 'jul', 'ago'].map((month, index) => ({
      month,
      score: Math.max(60, nota - variacao * (5 - index)),
    })),
    roadEvents: roadEvents({
      EXCESSO_VELOCIDADE: [driver.criticalEvents, 0],
      FRENAGEM_BRUSCA: [Math.max(0, driver.criticalEvents - 1), 0],
    }),
    warnings: [],
  };
}

export async function mockDriverProfile(driverId: string): Promise<DriverProfile> {
  await delay(400);
  const driver = DRIVERS.find((item) => item.id === driverId);
  const profile = PROFILES[driverId] ?? (driver ? fallbackProfile(driver) : undefined);
  if (!profile) throw new ApiError(404, 'Motorista não encontrado');
  return { driverId, ...profile };
}

/**
 * Ranking por período.
 *
 * No mês vale o score corrente; no ano, a média ponderada pelos km rodados —
 * são recortes diferentes e podem produzir pódios diferentes, que é justamente
 * o motivo de existir o alternador.
 */
export async function mockDriverRanking(period: RankingPeriod): Promise<DriverRankEntry[]> {
  await delay(380);

  const scored = DRIVERS.map((driver) => ({
    driverId: driver.id,
    name: driver.name,
    avatarUrl: driver.avatarUrl,
    kmDriven: period === 'ANO' ? driver.kmDriven * 11 : driver.kmDriven,
    score:
      period === 'MES'
        ? (driver.score ?? 0)
        : Math.round(
            ((driver.score ?? 0) - (driver.scoreDelta ?? 0) * 1.5 + driver.kmDriven / 4000) * 10,
          ) / 10,
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/** Substituto do pedido de URL assinada ao fornecedor (RN-092 / RNF-022). */
export async function mockWarningMedia(warningId: string): Promise<EventMedia> {
  await delay(700);
  const warning = Object.values(PROFILES)
    .flatMap((profile) => profile.warnings)
    .find((item) => item.id === warningId);

  if (!warning?.media) throw new ApiError(404, 'Mídia não disponível para este evento');

  return {
    ...warning.media,
    signedUrl: `https://media.hik-connect.example/clip/${warningId}?sig=mock`,
    /* RNF-022 — 15 minutos é o teto. */
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}
