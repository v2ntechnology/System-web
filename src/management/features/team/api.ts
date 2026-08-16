import type { TeamSummary } from '@/management/types';

import { mockTeam } from '@/management/mocks/team';

/**
 * Fronteira única entre a tela de equipe e o transporte de dados.
 *
 * No backend real vira `GET /v1/team`, uma consulta que junta motoristas e
 * usuários do tenant. Ver `features/auth/api.ts` para a nota completa.
 */
export function getTeam(): Promise<TeamSummary> {
  return mockTeam();
}
