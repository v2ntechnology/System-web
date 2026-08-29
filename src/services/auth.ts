import { permissionsForRole } from '@/app/permissions';
import { env } from '@/app/environment';
import {
  BLOCKED_EMAIL,
  buildDemoUser,
  DEMO_CREDENTIALS,
  DEMO_PASSWORD,
  DEMO_TENANT,
} from '@/mocks/session';
import { ApiError, networkDelay } from '@/services/http';
import { clearAccessToken, setAccessToken } from '@/services/token-store';
import type { AuthUser, PlanType, Tenant, TenantStatus, UserRole } from '@/types';

/**
 * Fronteira única entre a tela de acesso e o transporte.
 *
 * Com `VITE_ENABLE_MOCKS=true` a credencial é validada contra as contas de
 * demonstração e nenhum token existe. Com a variável em `false`, as mesmas
 * funções falam com o `Backend-web`. A tela de login não sabe a diferença.
 */

export interface SignInInput {
  email: string;
  password: string;
}

/** Tudo que a sessão precisa. O access token fica no `token-store`, fora daqui. */
export interface AuthSession {
  user: AuthUser;
  tenant: Tenant;
}

interface UserPayload {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
}

interface TenantPayload {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  status: TenantStatus;
}

interface TokenPayload {
  accessToken: string;
  expiresInSeconds: number;
  user: UserPayload;
  tenant: TenantPayload;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * As permissões vêm do papel, não do servidor. Elas comandam menu e botão, que
 * são conveniência visual: a autorização que vale é a do backend, verificada a
 * cada requisição.
 */
function toSession(payload: { user: UserPayload; tenant: TenantPayload }): AuthSession {
  const { user, tenant } = payload;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissionsForRole(user.role),
      tenantId: user.tenantId,
      operatorSeesFinancials: user.role !== 'OPERATOR',
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
    },
  };
}

/**
 * `credentials: 'include'` é obrigatório: sem ele o navegador não envia nem
 * aceita o cookie do refresh em requisição para outra origem, e a sessão morreria
 * a cada recarregamento.
 *
 * Não usa `httpRequest` porque estas rotas rodam sem access token.
 */
async function postJson<T>(path: string, body?: unknown): Promise<T | null> {
  const init: RequestInit = { method: 'POST', credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, init);

  if (response.status === 401) {
    throw new ApiError('E-mail ou senha incorretos.', 401);
  }
  if (response.status === 400) {
    throw new ApiError('Verifique os dados informados.', 400);
  }
  if (!response.ok) {
    throw new ApiError('Não foi possível entrar. Tente novamente.', response.status);
  }
  if (response.status === 204) return null;

  return (await response.json()) as T;
}

function acceptSession(payload: TokenPayload): AuthSession {
  setAccessToken(payload.accessToken);
  return toSession(payload);
}

async function signInMocked({ email, password }: SignInInput): Promise<AuthSession> {
  await networkDelay(400, 900);
  const address = normalize(email);

  if (address === BLOCKED_EMAIL) {
    throw new ApiError('Conta bloqueada. Procure o administrador da sua empresa.', 403);
  }

  const credential = DEMO_CREDENTIALS.find((item) => item.email === address);
  if (!credential || password !== DEMO_PASSWORD) {
    throw new ApiError('E-mail ou senha incorretos.', 401);
  }

  return { user: buildDemoUser(credential.role), tenant: { ...DEMO_TENANT } };
}

export async function signIn(input: SignInInput): Promise<AuthSession> {
  if (env.enableMocks) return signInMocked(input);

  const payload = await postJson<TokenPayload>('/v1/auth/login', {
    email: normalize(input.email),
    password: input.password,
  });

  return acceptSession(payload as TokenPayload);
}

/**
 * Recupera a sessão a partir do cookie, sem pedir senha de novo.
 *
 * É o que sustenta o recarregar da página: o access token vivia em memória e se
 * perdeu, mas o cookie do refresh continua com o navegador. Devolve `null` quando
 * não há sessão a recuperar, que é o caso normal de quem ainda não entrou.
 */
export async function restoreSession(): Promise<AuthSession | null> {
  if (env.enableMocks) return null;

  try {
    const payload = await postJson<TokenPayload>('/v1/auth/refresh');
    return acceptSession(payload as TokenPayload);
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function signOut(): Promise<void> {
  clearAccessToken();
  if (env.enableMocks) return;

  /* A sessão local já caiu. Se o servidor não responder, o refresh expira
     sozinho pelo TTL do Redis, então falhar aqui não deixa nada pendurado. */
  try {
    await postJson<void>('/v1/auth/logout');
  } catch {
    /* silêncio proposital */
  }
}

/**
 * SSO simulado. Sem provedor real configurado, entra com a conta de gestor:
 * o suficiente para demonstrar o caminho alternativo da tela.
 */
export async function signInWithGoogle(): Promise<AuthSession> {
  if (!env.enableMocks) {
    throw new ApiError('Entrada pelo Google ainda não está disponível.', 501);
  }
  await networkDelay(600, 1200);
  return { user: buildDemoUser('MANAGER'), tenant: { ...DEMO_TENANT } };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await networkDelay();
  /* Resposta sempre igual: confirmar se o e-mail existe entrega a base de
     usuários a quem estiver tentando descobrir contas. */
  void email;
}
