import type { VehiclePosition } from '@/management/types';

import { delay } from './latency';

/**
 * ⚠️ Posições fictícias, ancoradas em trechos reais da região do Rio de Janeiro
 * para o mapa fazer sentido visualmente.
 *
 * As coordenadas vêm em `[longitude, latitude]` — ordem do GeoJSON, que é o
 * inverso do "latitude, longitude" que a gente fala. Trocar isso joga o veículo
 * para o meio do oceano Índico, e é o erro mais comum com dados geográficos.
 */
const BASE: Omit<VehiclePosition, 'lastSyncAt'>[] = [
  {
    vehicleId: 'veh-002',
    plate: 'RKH7E45',
    status: 'EM_VIAGEM',
    driverName: 'Vinícius Vila Nova',
    coordinates: [-43.2096, -22.9035],
    speedKmh: 78,
    heading: 42,
    place: 'BR-040, km 12 — Duque de Caxias/RJ',
  },
  {
    vehicleId: 'veh-003',
    plate: 'RKH2B88',
    status: 'EM_VIAGEM',
    driverName: 'Marina Cordeiro',
    coordinates: [-43.4512, -22.7621],
    speedKmh: 84,
    heading: 310,
    place: 'BR-116, km 198 — Japeri/RJ',
  },
  {
    vehicleId: 'veh-005',
    plate: 'RKH4F72',
    status: 'EM_VIAGEM',
    driverName: 'Edson Bastos',
    coordinates: [-43.0891, -22.8412],
    speedKmh: 62,
    heading: 128,
    place: 'Av. Brasil — São João de Meriti/RJ',
  },
  {
    vehicleId: 'veh-007',
    plate: 'RKH5J19',
    status: 'EM_VIAGEM',
    driverName: 'Patrícia Nunes',
    coordinates: [-43.1029, -22.9711],
    speedKmh: 91,
    heading: 75,
    place: 'Ponte Rio–Niterói — Rio de Janeiro/RJ',
  },
  {
    vehicleId: 'veh-001',
    plate: 'RKH1D23',
    status: 'MANUTENCAO',
    coordinates: [-43.3184, -22.8896],
    speedKmh: 0,
    heading: 0,
    place: 'Oficina Central — Nova Iguaçu/RJ',
  },
  {
    vehicleId: 'veh-004',
    plate: 'RKH9C10',
    status: 'DISPONIVEL',
    coordinates: [-43.2712, -22.8503],
    speedKmh: 0,
    heading: 0,
    place: 'Pátio da Zona A — Duque de Caxias/RJ',
  },
  {
    vehicleId: 'veh-008',
    plate: 'RKH3K57',
    status: 'DISPONIVEL',
    coordinates: [-43.2698, -22.8489],
    speedKmh: 0,
    heading: 0,
    place: 'Pátio da Zona A — Duque de Caxias/RJ',
  },
  {
    vehicleId: 'veh-006',
    plate: 'RKH8H31',
    status: 'BLOQUEADO',
    coordinates: [-43.2205, -22.9268],
    speedKmh: 0,
    heading: 0,
    place: 'Pátio do Caju — Rio de Janeiro/RJ',
  },
];

/** Deslocamento acumulado por veículo entre chamadas, para simular movimento. */
const drift = new Map<string, [number, number]>();

/** Converte graus de rumo em passo de longitude/latitude. */
function step(heading: number, speedKmh: number): [number, number] {
  /* ~0,00001 grau por km/h — o suficiente para o movimento ser visível na demo. */
  const scale = speedKmh * 0.000012;
  const radians = (heading * Math.PI) / 180;
  return [Math.sin(radians) * scale, Math.cos(radians) * scale];
}

export async function mockVehiclePositions(): Promise<VehiclePosition[]> {
  await delay(250);

  return BASE.map((vehicle) => {
    const previous = drift.get(vehicle.vehicleId) ?? [0, 0];
    const [dx, dy] = step(vehicle.heading, vehicle.speedKmh);
    const next: [number, number] = [previous[0] + dx, previous[1] + dy];
    drift.set(vehicle.vehicleId, next);

    return {
      ...vehicle,
      coordinates: [vehicle.coordinates[0] + next[0], vehicle.coordinates[1] + next[1]],
      /* O bloqueado está com a integração parada — alimenta o aviso do RN-141. */
      lastSyncAt: new Date(
        Date.now() - (vehicle.status === 'BLOQUEADO' ? 515 : 2) * 60_000,
      ).toISOString(),
    };
  });
}
