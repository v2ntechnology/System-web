import type { Subscription } from '@/management/types';

import { mockSubscription } from '@/management/mocks/billing';

/**
 * Fronteira única entre a tela de cobrança e o transporte de dados.
 *
 * No backend real isto vira `GET /v1/billing/subscription`, alimentado pelo
 * gateway de pagamento — e o cliente continua recebendo apenas os quatro
 * últimos dígitos do cartão. Ver `features/auth/api.ts` para a nota completa.
 */
export function getSubscription(): Promise<Subscription> {
  return mockSubscription();
}
