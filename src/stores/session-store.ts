import { create } from 'zustand';

import { env } from '@/app/environment';
import { buildDemoUser, DEMO_TENANT } from '@/mocks/session';
import { restoreSession, signOut } from '@/services/auth';
import { clearAccessToken } from '@/services/token-store';
import type { AuthUser, PlanType, Tenant, UserRole } from '@/types';

export type SessionStatus = 'restoring' | 'authenticated' | 'unauthenticated' | 'expired';

interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  tenant: Tenant | null;
  /**
   * ⚠️ Verdadeiro barra a pessoa em TODA rota da API, com 403, até ela criar uma
   * senha própria. Quem decide é o backend, que carrega a obrigação dentro do
   * token: por isso as guardas de rota levam para `/trocar-senha` em vez de
   * deixar a tela abrir e falhar em cada requisição.
   */
  mustChangePassword: boolean;
  /** Entrada simulada: monta a identidade a partir do perfil, sem servidor. */
  login: (options?: { role?: UserRole }) => void;
  /** Entrada real: a identidade vem do backend, já pronta. */
  authenticate: (session: { user: AuthUser; tenant: Tenant; mustChangePassword: boolean }) => void;
  /** Tenta recuperar a sessão pelo cookie. Roda uma vez, na abertura da página. */
  restore: () => Promise<void>;
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
 * `authenticate` recebe a identidade que veio do servidor, e o access token fica
 * no `services/token-store`, nunca aqui: este store é lido por componentes e não
 * deve carregar credencial.
 *
 * O estado inicial depende do modo. Com backend real a aplicação começa em
 * `restoring`, porque pode existir um cookie de refresh válido e mandar o usuário
 * para o login antes de conferir faria a tela piscar a cada F5.
 */
/**
 * Trava da recuperação: garante uma chamada só, mesmo que `restore` seja
 * invocado duas vezes.
 *
 * Não é zelo teórico. O StrictMode roda o efeito em dobro no desenvolvimento, e
 * como o refresh **rotaciona** o token, a primeira chamada invalidaria o cookie
 * que a segunda ainda estaria usando: o usuário seria deslogado justamente ao
 * recarregar a página, que é o que esta funcionalidade existe para evitar.
 */
let restoring: Promise<void> | null = null;

export const useSessionStore = create<SessionState>((set, get) => ({
  status: env.enableMocks ? 'unauthenticated' : 'restoring',
  user: null,
  tenant: null,
  mustChangePassword: false,
  login: (options) => {
    const role = options?.role ?? 'MANAGER';
    set({
      status: 'authenticated',
      user: buildDemoUser(role),
      tenant: { ...DEMO_TENANT },
      mustChangePassword: false,
    });
  },
  authenticate: ({ user, tenant, mustChangePassword }) =>
    set({ status: 'authenticated', user, tenant, mustChangePassword }),
  restore: () => {
    restoring ??= restoreSession().then((session) => {
      if (session) {
        set({
          status: 'authenticated',
          user: session.user,
          tenant: session.tenant,
          mustChangePassword: session.mustChangePassword,
        });
        return;
      }
      /* Não é erro: é o caso normal de quem ainda não entrou. Vai para o login
         sem passar por `expired`, que existe para sessão perdida em uso. */
      set({ status: 'unauthenticated', user: null, tenant: null, mustChangePassword: false });
    });
    return restoring;
  },
  logout: () => {
    /* Sai da tela na hora e revoga em segundo plano: o usuário não deve esperar
       a rede para sair, e o refresh expira sozinho se a chamada falhar. */
    void signOut();
    set({ status: 'unauthenticated', user: null, tenant: null, mustChangePassword: false });
  },
  expireSession: () => {
    clearAccessToken();
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
