import type { EventMedia, SafetySummary } from '@/management/types';

import { mockSafetySummary } from '@/management/mocks/safety';

/** Fronteira única de segurança. */
export function getSafetySummary(): Promise<SafetySummary> {
  return mockSafetySummary();
}

/**
 * `POST /v1/safety/events/{id}/media` — URL assinada do fornecedor.
 *
 * Reusa o mesmo mock das advertências: é literalmente o mesmo evento visto de
 * outro lugar do produto, e a regra do RN-092 vale igual.
 */
export { getWarningMedia as getEventMedia } from '@/management/features/drivers/api';
export type { EventMedia };
