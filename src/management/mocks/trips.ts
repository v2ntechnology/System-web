import type { Trip, TripStatus } from '@/management/types';

import { delay } from './latency';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const hoursAhead = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

/** ⚠️ Viagens fictícias. Rotas reais da região Sudeste para dar verossimilhança. */
const TRIPS: Trip[] = [
  {
    id: 'trip-8841',
    code: 'VG-8841',
    status: 'EM_TRANSITO',
    origin: 'Duque de Caxias/RJ',
    destination: 'Juiz de Fora/MG',
    distanceKm: 184,
    driverName: 'Vinícius Vila Nova',
    plate: 'RKH7E45',
    cargo: 'Bebidas — 26 t',
    startedAt: hoursAgo(3),
    dueAt: hoursAhead(2),
    progressPercent: 62,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(7) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(4), note: 'Carregado no CD da Zona A' },
      { status: 'EM_TRANSITO', at: hoursAgo(3) },
    ],
  },
  {
    id: 'trip-8839',
    code: 'VG-8839',
    status: 'EM_TRANSITO',
    origin: 'Rio de Janeiro/RJ',
    destination: 'São Paulo/SP',
    distanceKm: 429,
    driverName: 'Marina Cordeiro',
    plate: 'RKH2B88',
    cargo: 'Eletrodomésticos — 24 t',
    startedAt: hoursAgo(9),
    /* Já passou do prazo: alimenta a aba de atrasadas. */
    dueAt: hoursAgo(1),
    progressPercent: 78,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(14) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(11) },
      { status: 'EM_TRANSITO', at: hoursAgo(9), note: 'Parada não prevista em Piraí — 40 min' },
    ],
  },
  {
    id: 'trip-8836',
    code: 'VG-8836',
    status: 'EM_DESCARGA',
    origin: 'Nova Iguaçu/RJ',
    destination: 'Campos dos Goytacazes/RJ',
    distanceKm: 276,
    driverName: 'Edson Bastos',
    plate: 'RKH4F72',
    cargo: 'Materiais de construção — 28 t',
    startedAt: hoursAgo(8),
    dueAt: hoursAhead(1),
    progressPercent: 100,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(12) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(10) },
      { status: 'EM_TRANSITO', at: hoursAgo(8) },
      { status: 'EM_DESCARGA', at: hoursAgo(1), note: 'Chegou 1h antes do prazo' },
    ],
  },
  {
    id: 'trip-8834',
    code: 'VG-8834',
    status: 'EM_CARREGAMENTO',
    origin: 'Duque de Caxias/RJ',
    destination: 'Vitória/ES',
    distanceKm: 521,
    driverName: 'Patrícia Nunes',
    plate: 'RKH5J19',
    cargo: 'Papel e celulose — 27 t',
    startedAt: hoursAgo(1),
    dueAt: hoursAhead(12),
    progressPercent: 0,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(4) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(1) },
    ],
  },
  {
    id: 'trip-8830',
    code: 'VG-8830',
    status: 'CONCLUIDA',
    origin: 'Rio de Janeiro/RJ',
    destination: 'Belo Horizonte/MG',
    distanceKm: 442,
    driverName: 'Vinícius Vila Nova',
    plate: 'RKH7E45',
    cargo: 'Alimentos refrigerados — 22 t',
    startedAt: hoursAgo(34),
    dueAt: hoursAgo(10),
    finishedAt: hoursAgo(11),
    progressPercent: 100,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(38) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(36) },
      { status: 'EM_TRANSITO', at: hoursAgo(34) },
      { status: 'EM_DESCARGA', at: hoursAgo(12) },
      { status: 'CONCLUIDA', at: hoursAgo(11), note: 'Entregue 1h antes do prazo' },
    ],
  },
  {
    id: 'trip-8827',
    code: 'VG-8827',
    status: 'CONCLUIDA',
    origin: 'Nova Iguaçu/RJ',
    destination: 'Volta Redonda/RJ',
    distanceKm: 118,
    driverName: 'Marina Cordeiro',
    plate: 'RKH2B88',
    cargo: 'Aço — 29 t',
    startedAt: hoursAgo(52),
    dueAt: hoursAgo(46),
    finishedAt: hoursAgo(44),
    progressPercent: 100,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(55) },
      { status: 'EM_CARREGAMENTO', at: hoursAgo(54) },
      { status: 'EM_TRANSITO', at: hoursAgo(52) },
      {
        status: 'CONCLUIDA',
        at: hoursAgo(44),
        note: 'Entregue com 2h de atraso — fila na portaria',
      },
    ],
  },
  {
    id: 'trip-8822',
    code: 'VG-8822',
    status: 'CANCELADA',
    origin: 'Duque de Caxias/RJ',
    destination: 'Macaé/RJ',
    distanceKm: 187,
    driverName: 'Wagner Teixeira',
    plate: 'RKH8H31',
    cargo: 'Equipamentos — 18 t',
    startedAt: hoursAgo(70),
    dueAt: hoursAgo(60),
    progressPercent: 0,
    timeline: [
      { status: 'PLANEJADA', at: hoursAgo(74) },
      {
        status: 'CANCELADA',
        at: hoursAgo(70),
        note: 'Veículo bloqueado por pendência de checklist',
      },
    ],
  },
];

export const TRIP_STATUS_ORDER: TripStatus[] = [
  'PLANEJADA',
  'EM_CARREGAMENTO',
  'EM_TRANSITO',
  'EM_DESCARGA',
  'CONCLUIDA',
];

export async function mockTrips(): Promise<Trip[]> {
  await delay(520);
  return TRIPS;
}
