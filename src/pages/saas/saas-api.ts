import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { env } from '@/app/environment';
import { httpRequest, httpUpload } from '@/services/http';
import { useSaasStore, type ApprovalInput } from '@/stores/saas-store';
import { useSessionStore } from '@/stores/session-store';
import type { SaasAccessRequest, SaasAuditEntry, SaasPlatformUser, SaasTenant } from '@/mocks/saas';
import type {
  AccessRequestStatus,
  PlanType,
  PlatformRole,
  ProvisioningState,
  TelemetryState,
  TenantOrigin,
} from '@/types';

/**
 * O backoffice da plataforma inteiro, num arquivo só.
 *
 * Cobre `/v1/saas` completo mais as rotas de plataforma que moram fora daquele
 * prefixo: a fila de solicitações, a aprovação, o cadastro direto, a suspensão,
 * o plano, a marca, a equipe RookHub e a auditoria. As telas não sabem nada de
 * transporte: elas chamam estas funções.
 *
 * <h2>⚠️ O caminho de demonstração continua inteiro</h2>
 *
 * Com `VITE_ENABLE_MOCKS=true` tudo passa pelo `stores/saas-store`, que é
 * mutável em memória e some no F5. Não é resquício: é o que permite mostrar o
 * fluxo de aprovação e provisionamento sem uma API no ar, e o padrão da variável
 * é `true`. A troca fica aqui, num lugar só, e nenhuma tela precisa saber em que
 * modo está rodando.
 *
 * <h2>⚠️ Criar empresa responde 202, e não 201</h2>
 *
 * Aprovar e cadastrar direto devolvem `{ tenantId, slug, provisioningState }`
 * com o estado em `PENDING`: criar o schema e rodar as migrations do cliente
 * leva segundos demais para caber numa requisição, então o provisionamento roda
 * fora dela. Quem chamou acompanha pelo `provisioningState` da lista, e não
 * espera a resposta terminar o trabalho.
 */

/* -------------------------------------------------------------------------- */
/* Quem está agindo                                                            */
/* -------------------------------------------------------------------------- */

/**
 * O nome de quem está agindo, para a auditoria do modo de demonstração.
 *
 * ⚠️ Só serve ao mock. Contra a API, quem registra o autor é o backend, a partir
 * do token: um nome vindo da tela seria palpite, e auditoria com autor palpitado
 * não vale como auditoria.
 */
function ator(): string {
  return useSessionStore.getState().user?.name ?? 'Administração';
}

/* -------------------------------------------------------------------------- */
/* Transportadoras                                                             */
/* -------------------------------------------------------------------------- */

interface TenantDto {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  plan: string;
  status: string;
  active: boolean;
  users: number;
  vehicles: number;
  telemetryState: string;
  /** O estado do SCHEMA da empresa, e não o da telemetria. Ver `provisionamento`. */
  provisioningState: string;
  /** Formulário do site ou venda ativa. Nulo nas empresas anteriores à coluna. */
  origin: string | null;
  /** ⚠️ Sempre nulo: não existe cobrança no sistema. Ver `mrr` abaixo. */
  mrr: number | null;
  createdAt: string;
}

export interface PlatformMetrics {
  tenants: number;
  activeTenants: number;
  users: number;
  vehicles: number;
}

/* O backend só conhece os três estados que dá para provar pelo banco. Os demais
   do domínio (provisionando, falhou) dependem do provisionador, que não existe
   ainda: empresa que está no ar, por definição, já foi provisionada. */
function telemetria(estado: string): TelemetryState {
  if (estado === 'CONNECTED') return 'CONNECTED';
  if (estado === 'PENDING_CONNECTOR') return 'PENDING_CONNECTOR';
  return 'PENDING_CONTRACT';
}

/**
 * O estado do ambiente da empresa, como o banco o guarda.
 *
 * ⚠️ **`READY` é o único estado em que as contagens significam algo.** Empresa
 * em provisionamento ou com falha aparece na lista, e tem de aparecer, mas o
 * schema dela ainda não tem o que contar: os números saem zerados, e zero ali
 * leria como "empresa sem ninguém e sem veículo".
 *
 * O valor desconhecido cai em `PENDING`, que é o mais conservador: ele não
 * afirma que o ambiente está pronto.
 */
function provisionamento(estado: string): ProvisioningState {
  if (estado === 'READY') return 'READY';
  if (estado === 'RUNNING') return 'RUNNING';
  if (estado === 'FAILED') return 'FAILED';
  return 'PENDING';
}

function origem(valor: string | null): TenantOrigin | undefined {
  if (valor === 'ACCESS_REQUEST' || valor === 'BACKOFFICE') return valor;
  return undefined;
}

function paraTela(dto: TenantDto): SaasTenant {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    document: dto.document ?? '',
    plan: dto.plan as PlanType,
    status: dto.status as SaasTenant['status'],
    provisioningState: provisionamento(dto.provisioningState),
    telemetryState: telemetria(dto.telemetryState),
    domainState: 'REGISTERED',
    /* ⚠️ A marca de uma empresa não é legível pelo backoffice: existe
       `PUT .../branding`, que grava, e a leitura pública, que responde pelo
       `Origin` do cliente e não por id. A tela mostra o padrão até alguém
       gravar, e o formulário de marca não vem preenchido por isso. */
    branding: { colorPrimary: '#d5623a', fontFamily: 'default' },
    vehicles: dto.vehicles,
    users: dto.users,
    /* ⚠️ Nulo vira nulo. Preencher com 0 diria "esta empresa não paga nada",
       que é diferente de "ninguém mede isso ainda". */
    mrr: dto.mrr,
    ...(origem(dto.origin) ? { origin: origem(dto.origin) } : {}),
    createdAt: dto.createdAt,
    /* O Dono é criado na aprovação e vive no schema do cliente: a lista da
       plataforma não o traz, e inventar um nome aqui seria pior que o vazio. */
    ownerName: '',
    ownerEmail: '',
  } as SaasTenant;
}

export async function fetchTenants(): Promise<SaasTenant[]> {
  if (env.enableMocks) return useSaasStore.getState().tenants;
  const dto = await httpRequest<TenantDto[]>('/v1/saas/tenants');
  return dto.map(paraTela);
}

export async function fetchTenant(id: string): Promise<SaasTenant> {
  if (env.enableMocks) {
    const doStore = useSaasStore.getState().tenants.find((t) => t.id === id);
    if (!doStore) throw new Error('Transportadora não encontrada.');
    return doStore;
  }
  return paraTela(await httpRequest<TenantDto>(`/v1/saas/tenants/${id}`));
}

export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  if (env.enableMocks) {
    const { tenants } = useSaasStore.getState();
    const prontas = tenants.filter((t) => t.provisioningState === 'READY');
    return {
      tenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'active').length,
      users: prontas.reduce((soma, t) => soma + t.users, 0),
      vehicles: prontas.reduce((soma, t) => soma + t.vehicles, 0),
    };
  }
  return httpRequest<PlatformMetrics>('/v1/saas/metrics');
}

/* -------------------------------------------------------------------------- */
/* Os quatro passos do assistente                                              */
/* -------------------------------------------------------------------------- */

/** ⚠️ `gestao` ou `operacional`, e NUNCA um caminho de rota. `/app` responde 400. */
export type RoleLanding = 'gestao' | 'operacional';

export interface RoleSetup {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  landing: RoleLanding;
}

/**
 * O passo de telemetria.
 *
 * ⚠️ **Ausente significa "nenhum fornecedor ainda", e é escolha válida**, não
 * erro: a contratação do rastreamento é do cliente, e o ambiente fica `READY`
 * igual. `OUTRO` exige `providerName`, que é o nome que a tela de integrações do
 * cliente mostra enquanto não há conector.
 */
export interface TelemetrySetup {
  provider: 'MIX' | 'OUTRO' | 'NENHUM';
  providerName?: string;
  /** ⚠️ A credencial da conta que o CLIENTE tem na MiX, e não uma nossa. */
  mix?: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  };
}

export interface BrandingSetup {
  colorPrimary?: string;
  colorAccent?: string;
  /** Chave da lista homologada. Ver `app/fonts.ts`. */
  fontFamily?: string;
}

/**
 * O que a aprovação e o cadastro direto recebem, que é o mesmo assistente.
 *
 * ⚠️ **A diferença entre os dois é só o passo 1.** No cadastro direto o nome da
 * empresa é obrigatório, porque não há solicitação de onde tirá-lo, e o
 * `ownerEmail` também: sem ele a empresa nasceria com um Dono sem convite, e
 * ninguém entraria. Na aprovação os dois herdam o contato da solicitação.
 */
export interface TenantSetupInput {
  slug: string;
  plan: PlanType;
  ownerName?: string;
  ownerEmail?: string;
  /** O rótulo do cargo que administra a empresa, quando o cliente quer outro. */
  commandRoleName?: string;
  /** Vazio usa os seis cargos padrão do provisionamento. */
  roles?: RoleSetup[];
  telemetry?: TelemetrySetup;
  branding?: BrandingSetup;
  /** Só no cadastro direto. */
  companyName?: string;
  document?: string;
}

/** A resposta de 202 das duas rotas de criação. */
export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  provisioningState: string;
}

/**
 * Traduz o assistente para o que o store de demonstração entende.
 *
 * O store nasceu antes do contrato da API e guarda a empresa já montada. Aqui a
 * tradução é de mão única e vive num lugar só, para o assistente falar um
 * formato apenas: o da API.
 */
function paraOMock(input: TenantSetupInput, nome: string, documento: string): ApprovalInput {
  const fornecedor = input.telemetry?.provider ?? 'NENHUM';
  return {
    slug: input.slug,
    name: nome,
    document: documento,
    ownerName: input.ownerName ?? '',
    ownerEmail: input.ownerEmail ?? '',
    telemetryProvider:
      fornecedor === 'MIX' ? 'MiX Telematics' : (input.telemetry?.providerName ?? null),
    telemetryState:
      fornecedor === 'MIX'
        ? 'CONNECTED'
        : fornecedor === 'OUTRO'
          ? 'PENDING_CONNECTOR'
          : 'PENDING_CONTRACT',
    branding: {
      colorPrimary: input.branding?.colorPrimary ?? '#d5623a',
      ...(input.branding?.colorAccent ? { colorAccent: input.branding.colorAccent } : {}),
      fontFamily: input.branding?.fontFamily ?? 'default',
    },
    plan: input.plan,
  };
}

/* -------------------------------------------------------------------------- */
/* Fila de solicitações                                                        */
/* -------------------------------------------------------------------------- */

interface AccessRequestDto {
  id: string;
  companyName: string;
  document: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  fleetSize: number | null;
  message: string | null;
  status: string;
  rejectionReason: string | null;
  tenantId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function situacao(status: string): AccessRequestStatus {
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
}

function pedidoParaTela(dto: AccessRequestDto): SaasAccessRequest {
  return {
    id: dto.id,
    company: dto.companyName,
    document: dto.document ?? '',
    contactName: dto.contactName ?? '',
    contactEmail: dto.contactEmail ?? '',
    contactPhone: dto.contactPhone ?? '',
    ...(dto.fleetSize == null ? {} : { fleetSize: dto.fleetSize }),
    message: dto.message ?? '',
    status: situacao(dto.status),
    createdAt: dto.createdAt,
    ...(dto.reviewedAt ? { decidedAt: dto.reviewedAt } : {}),
    ...(dto.rejectionReason ? { rejectionReason: dto.rejectionReason } : {}),
    ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
  };
}

export type AccessRequestFilter = 'pending' | 'all';

export async function fetchAccessRequests(
  status: AccessRequestFilter = 'pending',
): Promise<SaasAccessRequest[]> {
  if (env.enableMocks) {
    const todas = useSaasStore.getState().requests;
    return status === 'all' ? todas : todas.filter((r) => r.status === 'pending');
  }
  const dto = await httpRequest<AccessRequestDto[]>(`/v1/saas/access-requests?status=${status}`);
  return dto.map(pedidoParaTela);
}

export async function approveAccessRequest(
  requestId: string,
  input: TenantSetupInput,
): Promise<ProvisioningResult> {
  if (env.enableMocks) {
    const pedido = useSaasStore.getState().requests.find((r) => r.id === requestId);
    useSaasStore
      .getState()
      .approveRequest(
        requestId,
        paraOMock(input, pedido?.company ?? input.slug, pedido?.document ?? ''),
        ator(),
      );
    return { tenantId: `tenant-${input.slug}`, slug: input.slug, provisioningState: 'PENDING' };
  }

  return httpRequest<ProvisioningResult>(`/v1/saas/access-requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** ⚠️ O motivo é nota INTERNA: fica na auditoria e não viaja no e-mail ao cliente. */
export async function rejectAccessRequest(requestId: string, reason: string): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().rejectRequest(requestId, reason, ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/access-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/* -------------------------------------------------------------------------- */
/* Escrita sobre uma empresa                                                   */
/* -------------------------------------------------------------------------- */

export async function createTenant(input: TenantSetupInput): Promise<ProvisioningResult> {
  if (env.enableMocks) {
    useSaasStore
      .getState()
      .createTenant(
        paraOMock(input, input.companyName ?? input.slug, input.document ?? ''),
        ator(),
      );
    return { tenantId: `tenant-${input.slug}`, slug: input.slug, provisioningState: 'PENDING' };
  }
  return httpRequest<ProvisioningResult>('/v1/saas/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** ⚠️ Corta o acesso de todo mundo dela na requisição seguinte. Não apaga nada. */
export async function suspendTenant(tenantId: string, reason?: string): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().setTenantStatus(tenantId, 'suspended', ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/tenants/${tenantId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
}

export async function reactivateTenant(tenantId: string): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().setTenantStatus(tenantId, 'active', ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/tenants/${tenantId}/reactivate`, { method: 'POST' });
}

export async function changeTenantPlan(tenantId: string, plan: PlanType): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().setTenantPlan(tenantId, plan, ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/tenants/${tenantId}/plan`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

/** A marca como o backend a devolve depois de gravar. */
export interface SavedBranding {
  colorPrimary: string | null;
  colorAccent: string | null;
  fontFamily: string | null;
  temLogo: boolean;
}

export async function saveTenantBranding(
  tenantId: string,
  branding: BrandingSetup,
): Promise<SavedBranding> {
  if (env.enableMocks) {
    useSaasStore.getState().setTenantBranding(tenantId, branding, ator());
    return {
      colorPrimary: branding.colorPrimary ?? null,
      colorAccent: branding.colorAccent ?? null,
      fontFamily: branding.fontFamily ?? null,
      temLogo: false,
    };
  }
  return httpRequest<SavedBranding>(`/v1/saas/tenants/${tenantId}/branding`, {
    method: 'PUT',
    body: JSON.stringify(branding),
  });
}

/** Teto do logo, em bytes. Acima disso a API responde 413. */
export const LOGO_MAX_BYTES = 256 * 1024;

/** Tipos aceitos. Qualquer outro responde 415. */
export const LOGO_MIME_TYPES = ['image/png', 'image/svg+xml'];

/**
 * Envia o logo do cliente.
 *
 * ⚠️ **Bytes crus com o `Content-Type` do arquivo, e não multipart.** Ver
 * `httpUpload`. As duas recusas previstas são 413 (acima de 256 KB) e 415 (tipo
 * fora de PNG e SVG), e quem chama mostra a frase do backend, que distingue as
 * duas.
 */
export async function uploadTenantLogo(tenantId: string, file: File): Promise<void> {
  if (env.enableMocks) return;
  await httpUpload<void>(`/v1/saas/tenants/${tenantId}/branding/logo`, file);
}

/* -------------------------------------------------------------------------- */
/* Equipe RookHub                                                              */
/* -------------------------------------------------------------------------- */

interface PlatformUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  /** Conta que ainda não trocou a senha provisória: o convite não foi aceito. */
  mustChangePassword: boolean;
  deactivatedAt: string | null;
  createdAt: string;
}

function papelDaPlataforma(role: string): PlatformRole {
  return role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'PLATFORM_SUPPORT';
}

function contaParaTela(dto: PlatformUserDto): SaasPlatformUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: papelDaPlataforma(dto.role),
    active: dto.active,
    /* A API não guarda "convite aceito": o que ela sabe é se a senha provisória
       ainda está de pé, que responde a mesma pergunta. */
    pendingInvite: dto.mustChangePassword,
    createdAt: dto.createdAt,
    /* Quem criou a conta está na auditoria, e não na linha da conta. */
    createdBy: '',
  };
}

export async function fetchPlatformUsers(): Promise<SaasPlatformUser[]> {
  if (env.enableMocks) return useSaasStore.getState().platformUsers;
  const dto = await httpRequest<PlatformUserDto[]>('/v1/saas/platform-users');
  return dto.map(contaParaTela);
}

/**
 * A conta criada, com a senha que só aparece aqui.
 *
 * ⚠️ **`temporaryPassword` volta UMA única vez, nesta resposta.** Não existe
 * rota que a leia depois, e ela não fica gravada em lugar nenhum legível: a tela
 * precisa mostrá-la e avisar que não reaparece. Esquecida, o caminho é redefinir.
 */
export interface CreatedPlatformUser {
  id: string;
  temporaryPassword: string | null;
}

export async function createPlatformUser(input: {
  name: string;
  email: string;
  role: PlatformRole;
}): Promise<CreatedPlatformUser> {
  if (env.enableMocks) {
    useSaasStore.getState().invitePlatformUser(input, ator());
    return { id: '', temporaryPassword: 'demo-1234' };
  }
  return httpRequest<CreatedPlatformUser>('/v1/saas/platform-users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Nulo em qualquer campo significa "não mexe nesse". */
export async function updatePlatformUser(
  id: string,
  changes: { name?: string; role?: PlatformRole },
): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().updatePlatformUser(id, changes, ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/platform-users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export async function setPlatformUserActive(id: string, active: boolean): Promise<void> {
  if (env.enableMocks) {
    useSaasStore.getState().setPlatformUserActive(id, active, ator());
    return;
  }
  await httpRequest<void>(`/v1/saas/platform-users/${id}/${active ? 'reactivate' : 'deactivate'}`, {
    method: 'POST',
  });
}

/** ⚠️ Derruba as sessões da pessoa, e a senha nova volta só aqui. */
export async function resetPlatformUserPassword(id: string): Promise<string> {
  if (env.enableMocks) return useSaasStore.getState().resetPlatformUserPassword(id, ator());
  const resposta = await httpRequest<{ temporaryPassword: string }>(
    `/v1/saas/platform-users/${id}/reset-password`,
    { method: 'POST' },
  );
  return resposta.temporaryPassword;
}

/* -------------------------------------------------------------------------- */
/* Auditoria                                                                   */
/* -------------------------------------------------------------------------- */

interface AuditDto {
  id: number;
  actorEmail: string | null;
  actorScope: string | null;
  action: string;
  tenantId: string | null;
  targetType: string | null;
  targetId: string | null;
  /** JSON em texto. No acesso de suporte traz o método, a rota e o status. */
  metadata: string | null;
  ip: string | null;
  createdAt: string;
}

/** A ação do acesso de suporte, que é a única aba separada da auditoria. */
export const ACAO_ACESSO_DE_SUPORTE = 'support.access';

/**
 * As ações em português.
 *
 * ⚠️ A API guarda a chave (`tenant.suspended`), e não a frase: é o que sobrevive
 * a mudança de texto e o que dá para filtrar. A tradução mora aqui, e chave
 * desconhecida aparece como ela é, em vez de virar "ação desconhecida", que
 * esconderia justamente o evento novo que ninguém mapeou ainda.
 */
const ACAO_LABEL: Record<string, string> = {
  'access_request.approved': 'Aprovou a solicitação e provisionou o ambiente',
  'access_request.rejected': 'Recusou a solicitação',
  'tenant.created': 'Cadastrou a transportadora',
  'tenant.suspended': 'Suspendeu a transportadora',
  'tenant.reactivated': 'Reativou a transportadora',
  'tenant.plan_changed': 'Alterou o plano contratado',
  'tenant.branding_updated': 'Alterou a marca do cliente',
  'tenant.logo_updated': 'Enviou o logo do cliente',
  'platform_user.created': 'Admitiu alguém na equipe',
  'platform_user.updated': 'Alterou uma conta da equipe',
  'platform_user.deactivated': 'Desligou uma conta da equipe',
  'platform_user.reactivated': 'Religou uma conta da equipe',
  'platform_user.password_reset': 'Redefiniu a senha de uma conta',
  'role.created': 'Criou um cargo',
  'role.updated': 'Alterou um cargo',
  'role.deleted': 'Apagou um cargo',
  [ACAO_ACESSO_DE_SUPORTE]: 'Leu dados do cliente em modo suporte',
};

/** O método e a rota que o acesso de suporte gravou no `metadata`. */
function rotaDoMetadata(metadata: string | null): { method?: 'GET'; route?: string } {
  if (!metadata) return {};
  try {
    const corpo: unknown = JSON.parse(metadata);
    if (!corpo || typeof corpo !== 'object') return {};
    const rota =
      (corpo as { path?: unknown; route?: unknown }).path ?? (corpo as { route?: unknown }).route;
    return typeof rota === 'string' ? { method: 'GET', route: rota } : {};
  } catch {
    /* Metadata que não é JSON não tem rota para mostrar. */
    return {};
  }
}

function auditoriaParaTela(dto: AuditDto, nomeDaEmpresa: (id: string) => string): SaasAuditEntry {
  return {
    id: String(dto.id),
    kind: dto.action === ACAO_ACESSO_DE_SUPORTE ? 'support' : 'admin',
    actor: dto.actorEmail ?? 'conta removida',
    /* ⚠️ A linha guarda o ESCOPO de quem agiu, e não o papel dele no dia. O papel
       pode ter mudado desde então, e a auditoria descreve o passado. */
    actorRole: 'PLATFORM_ADMIN',
    action: ACAO_LABEL[dto.action] ?? dto.action,
    ...(dto.tenantId ? { tenant: nomeDaEmpresa(dto.tenantId) } : {}),
    ...rotaDoMetadata(dto.metadata),
    at: dto.createdAt,
  };
}

export interface AuditFilter {
  /** Chave exata da ação. `support.access` isola os acessos de suporte. */
  action?: string;
  tenantId?: string;
  /** Teto de 200 no backend. */
  limit?: number;
}

/**
 * O rastro da plataforma.
 *
 * ⚠️ **Só `PLATFORM_ADMIN` lê**, e a resposta para o suporte é 403: quem é
 * auditado não audita a si mesmo. A tela trata esse 403 como qualquer outro,
 * mostrando que falta permissão.
 */
export async function fetchAuditLog(filtro: AuditFilter = {}): Promise<SaasAuditEntry[]> {
  if (env.enableMocks) {
    return useSaasStore
      .getState()
      .audit.filter((e) => (filtro.action === ACAO_ACESSO_DE_SUPORTE ? e.kind === 'support' : true))
      .slice(0, filtro.limit ?? 100);
  }

  const parametros = new URLSearchParams();
  if (filtro.action) parametros.set('action', filtro.action);
  if (filtro.tenantId) parametros.set('tenantId', filtro.tenantId);
  parametros.set('limit', String(filtro.limit ?? 100));

  const [linhas, empresas] = await Promise.all([
    httpRequest<AuditDto[]>(`/v1/saas/audit-log?${parametros.toString()}`),
    fetchTenants(),
  ]);

  /* ⚠️ A auditoria guarda o id da empresa, e a tela mostra o nome. Resolver aqui
     evita que cada linha da lista vire uma consulta, e empresa que já não existe
     cai no próprio id, que ainda é rastreável. */
  const nomes = new Map(empresas.map((t) => [t.id, t.name]));
  return linhas.map((linha) => auditoriaParaTela(linha, (id) => nomes.get(id) ?? id));
}

/* -------------------------------------------------------------------------- */
/* Chaves e consultas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * As chaves do react-query, num lugar só.
 *
 * Existem porque toda escrita invalida a leitura correspondente, e chave escrita
 * à mão em cada tela é o jeito clássico de a lista não atualizar depois de uma
 * ação que funcionou.
 */
export const SAAS_KEYS = {
  tenants: ['saas-tenants'] as const,
  tenant: (id: string) => ['saas-tenant', id] as const,
  metrics: ['saas-metrics'] as const,
  requests: (status: AccessRequestFilter) => ['saas-requests', status] as const,
  platformUsers: ['saas-platform-users'] as const,
  audit: (filtro: AuditFilter) => ['saas-audit', filtro] as const,
};

/**
 * As empresas que a tela deve mostrar.
 *
 * O formato devolvido é o que as telas já consumiam antes de existir API, e
 * continua igual de propósito.
 */
export function useTenants(): { tenants: SaasTenant[]; carregando: boolean; erro: unknown } {
  const consulta = useQuery({ queryKey: SAAS_KEYS.tenants, queryFn: fetchTenants });
  return { tenants: consulta.data ?? [], carregando: consulta.isPending, erro: consulta.error };
}

/**
 * A ficha de uma empresa, por id.
 *
 * ⚠️ `id` vazio é estado legítimo, e não erro: a tela de detalhe entra pelo
 * ENDEREÇO da empresa e só descobre o id depois que a lista chega. Sem o
 * `enabled` a consulta dispararia um `GET /v1/saas/tenants/` na primeira
 * renderização de toda visita direta a `/admin-saas/empresas/<slug>`.
 */
export function useTenant(id: string): UseQueryResult<SaasTenant> {
  return useQuery({
    queryKey: SAAS_KEYS.tenant(id),
    queryFn: () => fetchTenant(id),
    enabled: id !== '',
  });
}

export function usePlatformMetrics(): UseQueryResult<PlatformMetrics> {
  return useQuery({ queryKey: SAAS_KEYS.metrics, queryFn: fetchPlatformMetrics });
}

export function useAccessRequests(
  status: AccessRequestFilter,
): UseQueryResult<SaasAccessRequest[]> {
  return useQuery({
    queryKey: SAAS_KEYS.requests(status),
    queryFn: () => fetchAccessRequests(status),
  });
}

export function usePlatformUsers(): UseQueryResult<SaasPlatformUser[]> {
  return useQuery({ queryKey: SAAS_KEYS.platformUsers, queryFn: fetchPlatformUsers });
}

export function useAuditLog(filtro: AuditFilter = {}): UseQueryResult<SaasAuditEntry[]> {
  return useQuery({ queryKey: SAAS_KEYS.audit(filtro), queryFn: () => fetchAuditLog(filtro) });
}
