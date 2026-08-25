import { create } from 'zustand';

import { buildDemoUser, DEMO_TENANT } from '@/mocks/session';
import { signOut } from '@/services/auth';
import { clearTokens } from '@/services/token-store';
import type { AuthUser, PlanType, Tenant, UserRole } from '@/types';

export type SessionStatus = 'authenticated' | 'unauthenticated' | 'expired';

interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  tenant: Tenant | null;
  /** Entrada simulada: monta a identidade a partir do perfil, sem servidor. */
  login: (options?: { role?: UserRole }) => void;
  /** Entrada real: a identidade vem do backend, já pronta. */
  authenticate: (session: { user: AuthUser; tenant: Tenant }) => void;
  logout: () => void;
  expireSession: () => void;
  /** Alterna o perfil da sessão simulada para demonstrar o controle de acesso. */
  setRole: (role: UserRole) => void;
  /** Alterna o plano do tenant simulado para demonstrar o gating por plano. */
  setPlan: (plan: PlanType) => void;
}

/**
 * A sessão tem duas origens possíveis. Com mocks ligados, `login` monta uma
 * identidade de demonstração e nenhum token existe. Com o backend real,
 * `authenticate` recebe a identidade que veio do servidor, e os tokens ficam no
 * `services/token-store`, nunca aqui: este store é lido por componentes e não
 * deve carregar credencial.
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
  authenticate: ({ user, tenant }) => set({ status: 'authenticated', user, tenant }),
  logout: () => {
    /* Sai da tela na hora e revoga em segundo plano: o usuário não deve esperar
       a rede para sair, e o refresh expira sozinho se a chamada falhar. */
    void signOut();
    set({ status: 'unauthenticated', user: null, tenant: null });
  },
  expireSession: () => {
    clearTokens();
    set({ status: 'expired' });
  },
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
