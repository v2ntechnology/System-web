import type { VehiclePosition } from '@/management/types';

import { env } from '@/app/environment';
import {
  fetchEventHeatmap,
  fetchVehiclePositions,
  fetchVehicleTrack,
  type HeatPoint,
  type TrackPoint,
} from '@/management/lib/fleet-api';
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

/** Trajeto percorrido nas últimas horas, com horário e velocidade em cada ponto. */
export function getVehicleTrack(vehicleId: string, hours = 24): Promise<TrackPoint[]> {
  return env.enableMocks ? Promise.resolve([]) : fetchVehicleTrack(vehicleId, hours);
}

/**
 * Onde a frota gera evento.
 *
 * Sem caminho de mock: um mapa de calor fictício desenharia concentração de
 * risco em esquina onde nunca aconteceu nada, e alguém mandaria mudar a rota
 * por causa disso.
 */
export function getEventHeatmap(days = 7): Promise<HeatPoint[]> {
  return env.enableMocks ? Promise.resolve([]) : fetchEventHeatmap(days);
}

export type { HeatPoint, TrackPoint };
