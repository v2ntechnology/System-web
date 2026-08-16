import type { AssistantAnswer } from '@/management/types';

import { mockAsk } from '@/management/mocks/assistant';

export { ASSISTANT_SUGGESTIONS } from '@/management/mocks/assistant';

/**
 * Fronteira única do assistente.
 *
 * No backend real isto vira `POST /v1/assistant/ask`, e o gate de autorização
 * (entitlement do tenant + papel + `operator_sees_financials`) roda LÁ, antes de
 * a função determinística ser executada — nunca no cliente (RN-118/RN-119).
 */
export function ask(question: string): Promise<AssistantAnswer> {
  return mockAsk(question);
}
