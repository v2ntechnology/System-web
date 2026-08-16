import { create } from 'zustand';

import { buildDemoUser, DEMO_TENANT } from '@/mocks/session';
import type { AuthUser, PlanType, Tenant, UserRole } from '@/types';

export type SessionStatus = 'authenticated' | 'unauthenticated' | 'expired';

interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  tenant: Tenant | null;
  login: (options?: { role?: UserRole }) => void;
  logout: () => void;
  expireSession: () => void;
  /** Alterna o perfil da sessão simulada para demonstrar o controle de acesso. */
  setRole: (role: UserRole) => void;
  /** Alterna o plano do tenant simulado para demonstrar o gating por plano. */
  setPlan: (plan: PlanType) => void;
}

/**
 * Sessão simulada da Fase 1 (MVP). Nenhum token real é gerado ou persistido.
 * A autenticação definitiva e a validação de permissões serão feitas no backend.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'unauthenticated',
  user: null,
  tenant: null,
  login: (options) => {
    const role = options?.role ?? 'MANAGER';
    set({
      status: 'authenticated',
      user: buildDemoUser(role),
      tenant: { ...DEMO_TENANT },
    });
  },
  logout: () => set({ status: 'unauthenticated', user: null, tenant: null }),
  expireSession: () => set({ status: 'expired' }),
  setRole: (role) => {
    /*
     * Troca a identidade inteira, não só o campo `role`: cada perfil tem nome e
     * cargo próprios no mock, e manter o nome do dono num perfil de operador
     * confundiria a demonstração do controle de acesso.
     */
    if (!get().user) return;
    set({ user: buildDemoUser(role) });
  },
  setPlan: (plan) => {
    const tenant = get().tenant;
    if (!tenant) return;
    set({ tenant: { ...tenant, plan } });
  },
}));
