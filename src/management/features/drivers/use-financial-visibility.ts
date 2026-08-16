import { useSession } from '@/management/features/auth/store';

/**
 * RF-007 — quem pode ver valor financeiro.
 *
 * ⚠️ Isto é só o estado da interface. O backend é que decide de verdade: se o
 * papel não pode ver salário, o campo **não vem no payload** (BE-14). Esconder
 * no cliente não é controle de acesso — é cortesia visual.
 *
 * A tela mostra o campo bloqueado em vez de sumir com ele: o usuário precisa
 * saber que o dado existe e que falta permissão, senão vira chamado de suporte.
 */
export function useFinancialVisibility() {
  const session = useSession();
  if (!session) return false;

  const { role, operatorSeesFinancials } = session.user;
  if (role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN') return true;
  if (role === 'OPERATOR') return operatorSeesFinancials;
  return false;
}
