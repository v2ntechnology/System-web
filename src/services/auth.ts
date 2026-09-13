import { permissionsForRole } from '@/app/permissions';
import { env } from '@/app/environment';
import { SLUG_PLATAFORMA, slugDoEndereco } from '@/app/tenant-host';
import {
  BLOCKED_EMAIL,
  buildDemoUser,
  DEMO_CREDENTIALS,
  DEMO_PASSWORD,
  DEMO_TENANT,
} from '@/mocks/session';
import { ApiError, httpRequest, motivoDoErro, networkDelay } from '@/services/http';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/services/token-store';
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

/**
 * De qual dos dois mundos é a sessão.
 *
 * `platform` é a equipe RookHub, que entra pela porta `app.` e não pertence a
 * transportadora nenhuma. `tenant` é qualquer conta de cliente.
 */
export type SessionScope = 'platform' | 'tenant';

/** Tudo que a sessão precisa. O access token fica no `token-store`, fora daqui. */
export interface AuthSession {
  user: AuthUser;
  /**
   * ⚠️ **Nulo na sessão de plataforma**, porque a equipe RookHub não pertence a
   * empresa nenhuma. Quem lê precisa tratar a ausência: é o que impede o painel
   * de uma transportadora abrir com uma empresa que não existe.
   */
  tenant: Tenant | null;
  /** Quem decide qual mundo abrir. Ver `landingForSession`. */
  scope: SessionScope;
  /**
   * ⚠️ Verdadeiro barra TODA outra rota da API até a senha ser trocada, com 403.
   *
   * A obrigação viaja dentro do token, então não adianta a tela ignorá-la: quem
   * entrar assim vê erro em cada tela que abrir. É o caminho de quem recebeu
   * credencial provisória, que o bootstrap ou um administrador criou.
   */
  mustChangePassword: boolean;
}

interface UserPayload {
  id: string;
  /** ⚠️ Nulo na sessão de plataforma, pelo mesmo motivo de `tenant`. */
  tenantId: string | null;
  name: string;
  email: string;
  /**
   * ⚠️ **Pode vir `PLATFORM_ADMIN` ou `PLATFORM_SUPPORT`**, que NÃO estão em
   * `UserRole`, desde a Fase 5 do onboarding (13/09/2026). Por isso o tipo é
   * `string` aqui: o `papelDeTela` abaixo traduz. Declarar `UserRole` seria uma
   * promessa que o servidor não faz.
   */
  role: string;
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
  /**
   * `platform` ou `tenant`, desde a Fase 5 do onboarding (13/09/2026). Diz de
   * qual mundo é a sessão sem depender do papel, que era como isto se deduzia
   * antes.
   */
  scope?: 'platform' | 'tenant';
  /** Obriga a criar uma senha própria antes de usar o sistema. */
  mustChangePassword?: boolean;
  user: UserPayload;
  /**
   * ⚠️ **Nulo na sessão de plataforma**, porque a equipe RookHub não pertence a
   * transportadora nenhuma.
   */
  tenant: TenantPayload | null;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * As permissões vêm do papel, não do servidor. Elas comandam menu e botão, que
 * são conveniência visual: a autorização que vale é a do backend, verificada a
 * cada requisição.
 */
/**
 * O papel da API traduzido para o que o painel entende.
 *
 * ⚠️ **Isto NÃO decide mais qual painel abrir**, desde que a sessão passou a
 * carregar o escopo (13/09/2026): quem escolhe o mundo é `scope`, e o que sobra
 * aqui é resolver as permissões de tela de quem administra a plataforma.
 *
 * ⚠️ **Os dois papéis da equipe entram como `SUPER_ADMIN`, e isto é tradução de
 * modelo, não disfarce.** `SUPER_ADMIN` sempre significou "administra a
 * plataforma" neste painel, e é o que o backoffice já usa para liberar o
 * `/admin-saas`. A Fase 5 apenas moveu essas contas para o lugar certo, fora de
 * qualquer transportadora.
 *
 * ⚠️ **Ampliar `UserRole` foi tentado e recusado:** ele é a chave de três
 * `Record` e de um segundo tipo `Role` no módulo de gestão, então a mudança
 * cascateia por arquivos que a Fase 9 vai reorganizar de todo jeito. Traduzir
 * num ponto só custa estas linhas.
 *
 * ⚠️ **Isto não decide acesso.** Quem autoriza é a API, que exige escopo
 * `platform` nas rotas de backoffice e não olha este valor.
 */
function papelDeTela(role: string): UserRole {
  if (role === 'PLATFORM_ADMIN' || role === 'PLATFORM_SUPPORT') return 'SUPER_ADMIN';
  return role as UserRole;
}

function toSession(payload: {
  user: UserPayload;
  tenant: TenantPayload | null;
  scope?: SessionScope;
  mustChangePassword?: boolean;
}): AuthSession {
  const { user, tenant } = payload;
  return {
    mustChangePassword: payload.mustChangePassword ?? false,
    /* Sem empresa não há outro mundo possível, então a ausência do campo não
       deixa a sessão sem escopo. */
    scope: payload.scope ?? (tenant ? 'tenant' : 'platform'),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: papelDeTela(user.role),
      permissions: permissionsForRole(papelDeTela(user.role)),
      tenantId: user.tenantId ?? '',
      operatorSeesFinancials: user.role !== 'OPERATOR',
    },
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
        }
      : null,
  };
}

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

  return {
    user: buildDemoUser(credential.role),
    tenant: { ...DEMO_TENANT },
    scope: 'tenant',
    mustChangePassword: false,
  };
}

export async function signIn(input: SignInInput): Promise<AuthSession> {
  if (env.enableMocks) return signInMocked(input);

  /* ⚠️ O `tenantSlug` é REDUNDANTE no navegador, e vai junto de propósito.
     Quem manda é o `Origin`, que o navegador define e que página nenhuma
     consegue forjar: a API compara os dois e responde 403 se divergirem. Mandar
     o slug aqui serve a um caso só, e é valioso: `localhost` puro, sem
     subdomínio, onde o `Origin` não carrega empresa nenhuma e a API cairia na
     empresa padrão configurada. Com isto, quem usa o espelho local escolhe a
     empresa pelo `VITE_TENANT_SLUG` em vez de depender do padrão do servidor. */
  const slug = slugDoEndereco();

  const payload = await postJson<TokenPayload>('/v1/auth/login', {
    email: normalize(input.email),
    password: input.password,
    ...(slug && slug !== SLUG_PLATAFORMA ? { tenantSlug: slug } : {}),
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
  return {
    user: buildDemoUser('MANAGER'),
    tenant: { ...DEMO_TENANT },
    scope: 'tenant',
    mustChangePassword: false,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await networkDelay();
  /* Resposta sempre igual: confirmar se o e-mail existe entrega a base de
     usuários a quem estiver tentando descobrir contas. */
  void email;
}

/* -------------------------------------------------------------------------- */
/* Convite                                                                     */
/* -------------------------------------------------------------------------- */

/** O que o convite diz antes de ser aceito. Sem nada sensível, e sem sessão. */
export interface InviteSummary {
  empresa: string;
  email: string;
  nome: string;
  cargo: string;
}

const CONVITE_SIMULADO: InviteSummary = {
  empresa: DEMO_TENANT.name,
  email: 'novo.gestor@servioeste.com.br',
  nome: 'Novo Gestor',
  cargo: 'Gestor',
};

/**
 * O convite que o token descreve.
 *
 * ⚠️ **A empresa vem do ENDEREÇO, e não do token.** A tabela de convites mora no
 * schema do cliente, e é o `Origin` que diz à API em qual procurar: o link
 * precisa abrir em `<empresa>.rookhub.com.br`. Aberto no endereço da
 * plataforma, a resposta é 404 com a frase que explica isso, e a tela a mostra
 * como está.
 *
 * ⚠️ **404 é uma resposta só para quatro casos** (inexistente, expirado,
 * revogado e já aceito), de propósito: distinguir diria a quem tem um token
 * velho que ele existiu. Por isso aqui não há tradução de status, e a tela
 * mostra uma mensagem única pedindo novo convite.
 */
export async function fetchInvite(token: string): Promise<InviteSummary> {
  if (env.enableMocks) {
    await networkDelay();
    return { ...CONVITE_SIMULADO };
  }
  return httpRequest<InviteSummary>(`/v1/public/invites/${encodeURIComponent(token)}`);
}

/**
 * Aceita o convite e já entra.
 *
 * O aceite devolve a sessão pronta, então mandar a pessoa para o login em
 * seguida seria pedir a senha que ela acabou de criar.
 *
 * `credentials: 'include'` porque a resposta traz o cookie de refresh: sem ele,
 * a sessão morreria no primeiro recarregamento.
 */
export async function acceptInvite(token: string, password: string): Promise<AuthSession> {
  if (env.enableMocks) {
    await networkDelay(400, 900);
    return {
      user: buildDemoUser('MANAGER'),
      tenant: { ...DEMO_TENANT },
      scope: 'tenant',
      mustChangePassword: false,
    };
  }

  const payload = await httpRequest<TokenPayload>(
    `/v1/public/invites/${encodeURIComponent(token)}/accept`,
    { method: 'POST', credentials: 'include', body: JSON.stringify({ password }) },
  );

  return acceptSession(payload);
}

/* -------------------------------------------------------------------------- */
/* Troca de senha                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Troca a própria senha e devolve a sessão nova.
 *
 * ⚠️ **O token novo tem de substituir o antigo, e não é conveniência.** A
 * obrigação de trocar viaja dentro do token, e o antigo continua carregando ela:
 * mantê-lo deixaria a pessoa barrada por até uma hora, com o sistema exigindo a
 * troca da senha que ela acabou de trocar. Por isso o `acceptSession` roda aqui.
 *
 * ⚠️ A API derruba as outras sessões da pessoa, inclusive o refresh anterior.
 * `credentials: 'include'` é o que traz o cookie novo no lugar do revogado.
 *
 * Os erros que valem tratar na tela: 401 é senha atual errada, 400 é senha nova
 * igual à atual ou curta demais. Os dois chegam com a frase do servidor.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AuthSession> {
  if (env.enableMocks) {
    await networkDelay(400, 900);
    return {
      user: buildDemoUser('MANAGER'),
      tenant: { ...DEMO_TENANT },
      scope: 'tenant',
      mustChangePassword: false,
    };
  }

  /*
   * ⚠️ NÃO passa pelo `httpRequest`, e isto não é preferência.
   *
   * Lá o 401 significa "a sessão acabou": ele marca a sessão como expirada e
   * joga a pessoa na tela de sessão perdida. Aqui o 401 significa "a senha
   * atual que você digitou está errada", e tratá-lo daquele jeito derrubava a
   * sessão de quem só errou a digitação, no meio da troca obrigatória, sem
   * dizer o motivo. Medido contra a API em 13/09/2026.
   */
  const response = await fetch(`${env.apiBaseUrl}/v1/auth/password`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiError(await motivoDoErro(response), response.status);
  }

  return acceptSession((await response.json()) as TokenPayload);
}
