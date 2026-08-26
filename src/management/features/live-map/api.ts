import type { VehiclePosition } from '@/management/types';

import { env } from '@/app/environment';
import { fetchVehiclePositions, fetchVehicleTrack } from '@/management/lib/fleet-api';
import { mockVehiclePositions } from '@/management/mocks/live-map';

/**
 * Fronteira única do mapa ao vivo.
 *
 * A posição vem de `vehicle_last_positions`, uma linha por veículo mantida pela
 * coleta. O mapa nunca varre a série bruta: são 2.863 leituras por veículo por
 * dia, e buscar a última de cada um numa tabela de milhões de linhas é o tipo de
 * consulta que derruba o painel justamente na tela que mais recarrega.
 *
 * O polling de quatro segundos continua porque não há WebSocket ainda (FE-11).
 * Ele não fala com a MiX: bate no nosso banco, que a coleta atualiza a cada
 * ciclo. Polling contra a MiX estouraria o teto de 20 requisições por minuto.
 */
export function getVehiclePositions(): Promise<VehiclePosition[]> {
  return env.enableMocks ? mockVehiclePositions() : fetchVehiclePositions();
}

/** Trajeto percorrido nas últimas horas, em [longitude, latitude]. */
export function getVehicleTrack(vehicleId: string, hours = 24): Promise<[number, number][]> {
  return env.enableMocks ? Promise.resolve([]) : fetchVehicleTrack(vehicleId, hours);
}
