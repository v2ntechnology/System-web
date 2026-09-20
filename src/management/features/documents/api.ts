import { httpRequest } from '@/services/http';

import type { DocumentList, ReadinessList, VehicleDocument } from './types';

/**
 * Fronteira entre as telas de documento e o transporte.
 *
 * ⚠️ **Sem modo simulado, como as multas.** Guia é dinheiro e prazo: uma linha
 * digitável inventada seria copiada e paga.
 */

export function fetchDocuments(kind?: string): Promise<DocumentList> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return httpRequest<DocumentList>(`/v1/vehicle-documents${query}`);
}

/** As guias de um veículo, para a ficha dele. */
export function fetchVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  return httpRequest<VehicleDocument[]>(`/v1/vehicles/${vehicleId}/documents`);
}

/**
 * A situação documental de cada veículo ativo.
 *
 * Leitura pura: a rota classifica e escreve o motivo, e não decide nada sobre a
 * saída do caminhão. Ver {@link ReadinessLevel}.
 */
export function fetchVehicleReadiness(): Promise<ReadinessList> {
  return httpRequest<ReadinessList>('/v1/vehicle-readiness');
}
