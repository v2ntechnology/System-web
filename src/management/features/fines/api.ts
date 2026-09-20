import { httpRequest } from '@/services/http';

import type { Fine, FineFilters, FineList, NewFine } from './types';

/**
 * Fronteira única entre as telas de multa e o transporte.
 *
 * ⚠️ **Não existe modo simulado aqui, de propósito.** Multa é dinheiro e prazo:
 * um número de demonstração ao lado de um real empresta credibilidade ao
 * conjunto, que é o motivo pelo qual `/app/analytics` precisou passar a avisar
 * que é maquete. Backend fora mostra erro, e não dado inventado.
 */

function query(filters: FineFilters): string {
  const p = new URLSearchParams();
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.stage) p.set('stage', filters.stage);
  if (filters.search) p.set('search', filters.search);
  if (filters.registered !== undefined) p.set('registered', String(filters.registered));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function fetchFines(filters: FineFilters = {}): Promise<FineList> {
  return httpRequest<FineList>(`/v1/fines${query(filters)}`);
}

/** Uma infração inteira, para a tela de detalhe. */
export function fetchFine(id: string): Promise<Fine> {
  return httpRequest<Fine>(`/v1/fines/${id}`);
}

/**
 * Cadastra uma infração à mão.
 *
 * ⚠️ Exige `vehicles.manage`, e não a permissão de ver multa: digitar uma
 * infração cria dado que entra no custo da frota. Quem só acompanha não
 * deveria poder inventar uma.
 */
export function createFine(fine: NewFine): Promise<{ id: string }> {
  return httpRequest<{ id: string }>('/v1/fines', {
    method: 'POST',
    body: JSON.stringify(fine),
  });
}

/**
 * Apaga uma infração digitada.
 *
 * ⚠️ **A que veio da Smartec não se apaga**, e o backend responde 409 nesse
 * caso: apagar não resolveria nada, porque a próxima coleta a traria de volta, e
 * no meio tempo a tela diria que a frota tem menos multa do que tem.
 */
export function deleteFine(id: string): Promise<void> {
  return httpRequest<void>(`/v1/fines/${id}`, { method: 'DELETE' });
}

/** As infrações de um veículo, para a ficha dele. */
export function fetchVehicleFines(vehicleId: string): Promise<Fine[]> {
  return httpRequest<Fine[]>(`/v1/vehicles/${vehicleId}/fines`);
}

/**
 * Pede uma coleta na Smartec.
 *
 * ⚠️ **Responde 202 e o trabalho segue fora.** São duas chamadas por veículo
 * com pendência, seguradas em 20 por minuto, então a coleta passa de cinco
 * minutos: não cabe numa requisição, e a Cloudflare corta em 100 segundos. A
 * tela pede e recarrega depois, em vez de esperar.
 *
 * ⚠️ Exige `integrations.manage`, que hoje é só do **dono**. Quem não tem a
 * permissão não deve ver o botão, porque um 403 na cara de quem só queria ver
 * multa é ruído.
 */
export function requestFineSync(): Promise<{ status: string }> {
  return httpRequest<{ status: string }>('/v1/fines/sync', { method: 'POST' });
}
