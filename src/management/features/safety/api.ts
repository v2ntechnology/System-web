import type { EventMedia, SafetySummary } from '@/management/types';

import { env } from '@/app/environment';
import { fetchSafetySummary } from '@/management/lib/fleet-api';
import { mockSafetySummary } from '@/management/mocks/safety';

/**
 * Fronteira única de segurança.
 *
 * ⚠️ A tela mostra só COMPORTAMENTO ao volante. O fornecedor entrega 114 tipos
 * de evento na frota real, e a maioria não é condução: pressão de óleo, troca de
 * firmware, perda de vídeo da câmera. O backend classifica por categoria de
 * risco e filtra; sem isso, "Firmware version changed" apareceria ao lado de
 * sonolência ao volante e o gestor pararia de olhar a tela em uma semana.
 */
export function getSafetySummary(): Promise<SafetySummary> {
  return env.enableMocks ? mockSafetySummary() : fetchSafetySummary();
}

/**
 * `POST /v1/safety/events/{id}/media` — URL assinada do fornecedor.
 *
 * Reusa o mesmo mock das advertências: é literalmente o mesmo evento visto de
 * outro lugar do produto, e a regra do RN-092 vale igual.
 */
export { getWarningMedia as getEventMedia } from '@/management/features/drivers/api';
export type { EventMedia };
