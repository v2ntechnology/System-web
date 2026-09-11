import type {
  AccessRequestStatus,
  DomainState,
  PlanType,
  PlatformRole,
  ProvisioningState,
  TelemetryState,
  TenantBranding,
  TenantStatus,
} from '@/types';

/* -------------------------------------------------------------------------- */
/* Transportadoras                                                             */
/* -------------------------------------------------------------------------- */

export interface SaasTenant {
  id: string;
  name: string;
  /** Subdomínio E nome do schema. Definido pelo time da RookHub na aprovação. */
  slug: string;
  document: string;
  plan: PlanType;
  status: TenantStatus;
  provisioningState: ProvisioningState;
  /** Só preenchido quando `provisioningState` é `FAILED`. */
  provisioningError?: string;
  telemetryState: TelemetryState;
  /** Nome do fornecedor, mesmo quando ainda não há conector para ele. */
  telemetryProvider?: string;
  domainState: DomainState;
  branding: TenantBranding;
  vehicles: number;
  users: number;
  mrr: number;
  createdAt: string;
  trialEndsAt?: string;
  /** Dono da conta. É a única credencial que a aprovação cria. */
  ownerName: string;
  ownerEmail: string;
}

export const SAAS_TENANTS: SaasTenant[] = [
  {
    id: 'tenant-servioeste',
    name: 'Servioeste',
    slug: 'servioeste',
    document: '12.345.678/0001-90',
    plan: 'business',
    status: 'active',
    provisioningState: 'READY',
    telemetryState: 'CONNECTED',
    telemetryProvider: 'MiX Telematics',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#d5623a', colorAccent: '#1f3a5f', fontFamily: 'default' },
    vehicles: 118,
    users: 24,
    mrr: 2490,
    createdAt: '2023-02-14',
    ownerName: 'Marina Alves',
    ownerEmail: 'marina.alves@servioeste.com.br',
  },
  {
    id: 'tenant-viacarga',
    name: 'ViaCarga Logística',
    slug: 'viacarga',
    document: '23.456.789/0001-11',
    plan: 'enterprise',
    status: 'active',
    provisioningState: 'READY',
    telemetryState: 'CONNECTED',
    telemetryProvider: 'MiX Telematics',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#0f6f5c', colorAccent: '#123a33', fontFamily: 'inter' },
    vehicles: 640,
    users: 112,
    mrr: 5990,
    createdAt: '2022-08-03',
    ownerName: 'Eduardo Ramos',
    ownerEmail: 'eduardo.ramos@viacarga.com.br',
  },
  {
    id: 'tenant-translog',
    name: 'TransLog Sul',
    slug: 'translog',
    document: '34.567.890/0001-22',
    plan: 'business',
    status: 'active',
    provisioningState: 'READY',
    telemetryState: 'PENDING_CONNECTOR',
    telemetryProvider: 'Sascar',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#2b4c8c', fontFamily: 'default' },
    vehicles: 92,
    users: 18,
    mrr: 2490,
    createdAt: '2023-06-21',
    ownerName: 'Sofia Nunes',
    ownerEmail: 'sofia.nunes@translog.com.br',
  },
  {
    id: 'tenant-rapidao',
    name: 'Rapidão Cargas',
    slug: 'rapidao',
    document: '45.678.901/0001-33',
    plan: 'starter',
    status: 'trial',
    provisioningState: 'READY',
    telemetryState: 'PENDING_CONTRACT',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#c2410c', fontFamily: 'default' },
    vehicles: 12,
    users: 5,
    mrr: 0,
    createdAt: '2026-08-02',
    trialEndsAt: '2026-09-16',
    ownerName: 'Caio Bertoldo',
    ownerEmail: 'caio@rapidaocargas.com.br',
  },
  {
    id: 'tenant-norte',
    name: 'Norte Expresso',
    slug: 'norte-expresso',
    document: '56.789.012/0001-44',
    plan: 'starter',
    status: 'active',
    provisioningState: 'READY',
    telemetryState: 'CONNECTED',
    telemetryProvider: 'MiX Telematics',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#166534', fontFamily: 'default' },
    vehicles: 21,
    users: 8,
    mrr: 890,
    createdAt: '2023-11-09',
    ownerName: 'Helena Costa',
    ownerEmail: 'helena.costa@norteexpresso.com.br',
  },
  {
    id: 'tenant-atlas',
    name: 'Atlas Transportadora',
    slug: 'atlas',
    document: '67.890.123/0001-55',
    plan: 'business',
    status: 'suspended',
    provisioningState: 'READY',
    telemetryState: 'CONNECTED',
    telemetryProvider: 'MiX Telematics',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#7c2d12', fontFamily: 'default' },
    vehicles: 76,
    users: 15,
    mrr: 0,
    createdAt: '2022-12-30',
    ownerName: 'Bruno Carvalho',
    ownerEmail: 'bruno.carvalho@atlas.com.br',
  },
  {
    id: 'tenant-horizonte',
    name: 'Horizonte Logística',
    slug: 'horizonte',
    document: '78.901.234/0001-66',
    plan: 'enterprise',
    status: 'active',
    provisioningState: 'READY',
    telemetryState: 'CONNECTED',
    telemetryProvider: 'MiX Telematics',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#4338ca', colorAccent: '#1e1b4b', fontFamily: 'inter' },
    vehicles: 410,
    users: 89,
    mrr: 5990,
    createdAt: '2023-01-18',
    ownerName: 'Renata Prado',
    ownerEmail: 'renata.prado@horizontelog.com.br',
  },
  {
    id: 'tenant-primecargo',
    name: 'PrimeCargo',
    slug: 'primecargo',
    document: '89.012.345/0001-77',
    plan: 'starter',
    status: 'cancelled',
    provisioningState: 'READY',
    telemetryState: 'PENDING_CONTRACT',
    domainState: 'REGISTERED',
    branding: { colorPrimary: '#525252', fontFamily: 'default' },
    vehicles: 0,
    users: 0,
    mrr: 0,
    createdAt: '2023-04-25',
    ownerName: 'Igor Menezes',
    ownerEmail: 'igor@primecargo.com.br',
  },
  /* Provisionamento em curso: a tela de aprovação acompanha por polling. */
  {
    id: 'tenant-serracargas',
    name: 'Serra Cargas',
    slug: 'serracargas',
    document: '90.123.456/0001-88',
    plan: 'business',
    status: 'trial',
    provisioningState: 'RUNNING',
    telemetryState: 'PENDING_CONNECTOR',
    telemetryProvider: 'Omnilink',
    domainState: 'PENDING',
    branding: { colorPrimary: '#0369a1', fontFamily: 'default' },
    vehicles: 0,
    users: 1,
    mrr: 0,
    createdAt: '2026-09-10',
    trialEndsAt: '2026-10-10',
    ownerName: 'Letícia Bonfim',
    ownerEmail: 'leticia@serracargas.com.br',
  },
  /* Falha externa no meio da aprovação: empresa provisionada e inacessível. */
  {
    id: 'tenant-oestelog',
    name: 'Oeste Log',
    slug: 'oestelog',
    document: '01.234.567/0001-99',
    plan: 'starter',
    status: 'trial',
    provisioningState: 'FAILED',
    provisioningError:
      'Cloudflare Pages recusou o registro do domínio oestelog.rookhub.com.br (limite de 100 domínios por projeto atingido).',
    telemetryState: 'PENDING_CONTRACT',
    domainState: 'FAILED',
    branding: { colorPrimary: '#b45309', fontFamily: 'default' },
    vehicles: 0,
    users: 1,
    mrr: 0,
    createdAt: '2026-09-09',
    ownerName: 'Ramon Teixeira',
    ownerEmail: 'ramon@oestelog.com.br',
  },
];

/* -------------------------------------------------------------------------- */
/* Solicitações de acesso                                                      */
/* -------------------------------------------------------------------------- */

export interface SaasAccessRequest {
  id: string;
  company: string;
  document: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  state: string;
  fleetSize: number;
  /** O que a transportadora respondeu no site. Não é decisão nossa ainda. */
  declaredProvider: string;
  message: string;
  status: AccessRequestStatus;
  createdAt: string;
  /** Preenchidos quando a solicitação já foi decidida. */
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
  tenantId?: string;
}

export const SAAS_ACCESS_REQUESTS: SaasAccessRequest[] = [
  {
    id: 'req-amazonas',
    company: 'Amazonas Transportes',
    document: '11.222.333/0001-44',
    contactName: 'Diego Farias',
    contactEmail: 'diego.farias@amazonastransportes.com.br',
    contactPhone: '(92) 99812-4410',
    city: 'Manaus',
    state: 'AM',
    fleetSize: 64,
    declaredProvider: 'MiX Telematics',
    message:
      'Operamos 64 carretas na rota Manaus–Porto Velho. Já usamos MiX e queremos consolidar custo e checklist num lugar só.',
    status: 'pending',
    createdAt: '2026-09-10T08:42:00-03:00',
  },
  {
    id: 'req-planalto',
    company: 'Planalto Distribuidora',
    document: '22.333.444/0001-55',
    contactName: 'Camila Ferraz',
    contactEmail: 'camila@planaltodist.com.br',
    contactPhone: '(61) 99230-7788',
    city: 'Brasília',
    state: 'DF',
    fleetSize: 18,
    declaredProvider: 'Sascar',
    message:
      'Frota pequena de distribuição urbana. Precisamos principalmente de multas e manutenção.',
    status: 'pending',
    createdAt: '2026-09-09T16:05:00-03:00',
  },
  {
    id: 'req-litoral',
    company: 'Litoral Express',
    document: '33.444.555/0001-66',
    contactName: 'Paulo Vergara',
    contactEmail: 'paulo@litoralexpress.com',
    contactPhone: '(48) 99145-0032',
    city: 'Itajaí',
    state: 'SC',
    fleetSize: 210,
    declaredProvider: 'Ainda não contratamos',
    message:
      'Estamos trocando de sistema e ainda não definimos o rastreador. Gostaríamos de indicação de fornecedor homologado.',
    status: 'pending',
    createdAt: '2026-09-08T11:20:00-03:00',
  },
  {
    id: 'req-serracargas',
    company: 'Serra Cargas',
    document: '90.123.456/0001-88',
    contactName: 'Letícia Bonfim',
    contactEmail: 'leticia@serracargas.com.br',
    contactPhone: '(54) 99887-2210',
    city: 'Caxias do Sul',
    state: 'RS',
    fleetSize: 37,
    declaredProvider: 'Omnilink',
    message: 'Indicação da ViaCarga. Queremos começar pelo módulo de abastecimento.',
    status: 'approved',
    createdAt: '2026-09-05T09:00:00-03:00',
    decidedAt: '2026-09-10T10:12:00-03:00',
    decidedBy: 'Vinícius Vilanova',
    tenantId: 'tenant-serracargas',
  },
  {
    id: 'req-cometa',
    company: 'Cometa Fretes ME',
    document: '44.555.666/0001-77',
    contactName: 'Jonas Prado',
    contactEmail: 'jonas@cometafretes.com',
    contactPhone: '(11) 98123-4455',
    city: 'Guarulhos',
    state: 'SP',
    fleetSize: 2,
    declaredProvider: 'Ainda não contratamos',
    message: 'Tenho dois caminhões e quero testar.',
    status: 'rejected',
    createdAt: '2026-09-02T19:44:00-03:00',
    decidedAt: '2026-09-03T08:30:00-03:00',
    decidedBy: 'Vinícius Vilanova',
    rejectionReason: 'Frota abaixo do porte mínimo atendido pelo plano Starter (10 veículos).',
  },
];

/* -------------------------------------------------------------------------- */
/* Equipe interna da RookHub                                                   */
/* -------------------------------------------------------------------------- */

export interface SaasPlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  active: boolean;
  /** Convite aceito ainda não: o primeiro acesso troca a senha. */
  pendingInvite: boolean;
  lastLoginAt?: string;
  createdAt: string;
  createdBy: string;
}

export const SAAS_PLATFORM_USERS: SaasPlatformUser[] = [
  {
    id: 'pu-vinicius',
    name: 'Vinícius Vilanova',
    email: 'vinicius@rookhub.com.br',
    role: 'PLATFORM_ADMIN',
    active: true,
    pendingInvite: false,
    lastLoginAt: '2026-09-11T08:15:00-03:00',
    createdAt: '2026-01-04',
    createdBy: 'Bootstrap',
  },
  {
    id: 'pu-tatiana',
    name: 'Tatiana Reis',
    email: 'tatiana@rookhub.com.br',
    role: 'PLATFORM_ADMIN',
    active: true,
    pendingInvite: false,
    lastLoginAt: '2026-09-10T17:40:00-03:00',
    createdAt: '2026-02-11',
    createdBy: 'Vinícius Vilanova',
  },
  {
    id: 'pu-rafael',
    name: 'Rafael Lins',
    email: 'rafael@rookhub.com.br',
    role: 'PLATFORM_SUPPORT',
    active: true,
    pendingInvite: false,
    lastLoginAt: '2026-09-11T09:02:00-03:00',
    createdAt: '2026-03-19',
    createdBy: 'Vinícius Vilanova',
  },
  {
    id: 'pu-juliana',
    name: 'Juliana Antunes',
    email: 'juliana@rookhub.com.br',
    role: 'PLATFORM_SUPPORT',
    active: true,
    pendingInvite: true,
    createdAt: '2026-09-09',
    createdBy: 'Tatiana Reis',
  },
  {
    id: 'pu-marcos',
    name: 'Marcos Vieira',
    email: 'marcos@rookhub.com.br',
    role: 'PLATFORM_SUPPORT',
    active: false,
    pendingInvite: false,
    lastLoginAt: '2026-07-28T14:11:00-03:00',
    createdAt: '2026-02-02',
    createdBy: 'Vinícius Vilanova',
  },
];

/* -------------------------------------------------------------------------- */
/* Assinaturas                                                                 */
/* -------------------------------------------------------------------------- */

export interface SaasSubscription {
  id: string;
  tenantId: string;
  tenant: string;
  plan: PlanType;
  status: TenantStatus;
  mrr: number;
  renewsAt: string;
  seats: number;
  vehicles: number;
}

export const SAAS_SUBSCRIPTIONS: SaasSubscription[] = SAAS_TENANTS.filter(
  (t) => t.provisioningState === 'READY',
).map((t) => ({
  id: `sub-${t.id}`,
  tenantId: t.id,
  tenant: t.name,
  plan: t.plan,
  status: t.status,
  mrr: t.mrr,
  renewsAt: t.trialEndsAt ?? '2026-10-01',
  seats: t.users,
  vehicles: t.vehicles,
}));

/* -------------------------------------------------------------------------- */
/* Auditoria                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Duas trilhas na mesma tabela.
 *
 * `admin` é o que o TI Topo fez no backoffice. `support` é o acesso de leitura
 * do TI Operacional aos dados de um cliente, a exceção consciente à regra de
 * tenancy, e por isso a que precisa aparecer separada e completa.
 */
export type AuditKind = 'admin' | 'support';

export interface SaasAuditEntry {
  id: string;
  kind: AuditKind;
  actor: string;
  actorRole: PlatformRole;
  action: string;
  tenant?: string;
  /** Só nos acessos de suporte: a rota exata que foi lida. */
  route?: string;
  method?: 'GET';
  at: string;
}

export const SAAS_AUDIT: SaasAuditEntry[] = [
  {
    id: 'a1',
    kind: 'admin',
    actor: 'Vinícius Vilanova',
    actorRole: 'PLATFORM_ADMIN',
    action: 'Aprovou a solicitação de Serra Cargas e provisionou o ambiente',
    tenant: 'Serra Cargas',
    at: '2026-09-10T10:12:00-03:00',
  },
  {
    id: 'a2',
    kind: 'support',
    actor: 'Rafael Lins',
    actorRole: 'PLATFORM_SUPPORT',
    action: 'Leitura de dados operacionais',
    tenant: 'Servioeste',
    route: '/v1/fleet/vehicles',
    method: 'GET',
    at: '2026-09-11T09:05:00-03:00',
  },
  {
    id: 'a3',
    kind: 'support',
    actor: 'Rafael Lins',
    actorRole: 'PLATFORM_SUPPORT',
    action: 'Leitura de diagnóstico da integração MiX',
    tenant: 'Servioeste',
    route: '/v1/diagnostics/mix/status',
    method: 'GET',
    at: '2026-09-11T09:06:00-03:00',
  },
  {
    id: 'a4',
    kind: 'admin',
    actor: 'Tatiana Reis',
    actorRole: 'PLATFORM_ADMIN',
    action: 'Convidou Juliana Antunes como TI Operacional',
    at: '2026-09-09T14:22:00-03:00',
  },
  {
    id: 'a5',
    kind: 'admin',
    actor: 'Vinícius Vilanova',
    actorRole: 'PLATFORM_ADMIN',
    action: 'Suspendeu Atlas Transportadora por inadimplência',
    tenant: 'Atlas Transportadora',
    at: '2026-09-08T02:00:00-03:00',
  },
  {
    id: 'a6',
    kind: 'support',
    actor: 'Juliana Antunes',
    actorRole: 'PLATFORM_SUPPORT',
    action: 'Leitura de viagens do período',
    tenant: 'ViaCarga Logística',
    route: '/v1/trips?from=2026-09-01',
    method: 'GET',
    at: '2026-09-07T11:33:00-03:00',
  },
  {
    id: 'a7',
    kind: 'admin',
    actor: 'Tatiana Reis',
    actorRole: 'PLATFORM_ADMIN',
    action: 'Alterou o plano de Norte Expresso de Starter para Business',
    tenant: 'Norte Expresso',
    at: '2026-09-05T15:48:00-03:00',
  },
  {
    id: 'a8',
    kind: 'admin',
    actor: 'Vinícius Vilanova',
    actorRole: 'PLATFORM_ADMIN',
    action: 'Recusou a solicitação de Cometa Fretes ME',
    at: '2026-09-03T08:30:00-03:00',
  },
  {
    id: 'a9',
    kind: 'support',
    actor: 'Rafael Lins',
    actorRole: 'PLATFORM_SUPPORT',
    action: 'Leitura de abastecimentos',
    tenant: 'TransLog Sul',
    route: '/v1/fuel/entries',
    method: 'GET',
    at: '2026-09-02T10:15:00-03:00',
  },
];

/* -------------------------------------------------------------------------- */
/* Cargos semeados em cada transportadora nova                                 */
/* -------------------------------------------------------------------------- */

export interface SeededRole {
  key: string;
  name: string;
  description: string;
  landing: 'gestao' | 'operacional';
  /** Cargo de sistema: semeado por nós, indelével. Só o Dono tem. */
  system: boolean;
  members: number;
}

export const SEEDED_ROLES: SeededRole[] = [
  {
    key: 'dono',
    name: 'Dono',
    description: 'Todas as permissões, mais gestão de equipe e de cargos. Não pode ser apagado.',
    landing: 'gestao',
    system: true,
    members: 1,
  },
  {
    key: 'gestor',
    name: 'Gestor',
    description: 'Opera e libera a frota. Editável e apagável pelo Dono.',
    landing: 'gestao',
    system: false,
    members: 3,
  },
  {
    key: 'diretor',
    name: 'Diretor',
    description: 'Visão gerencial completa, sem gestão de equipe.',
    landing: 'gestao',
    system: false,
    members: 2,
  },
  {
    key: 'operador',
    name: 'Operador',
    description: 'Rotina de pátio. Não enxerga custo consolidado.',
    landing: 'operacional',
    system: false,
    members: 9,
  },
  {
    key: 'manutencao',
    name: 'Manutenção',
    description: 'Oficina, checklists e ordens de serviço.',
    landing: 'operacional',
    system: false,
    members: 4,
  },
  {
    key: 'motorista',
    name: 'Motorista',
    description: 'Somente o aplicativo do motorista.',
    landing: 'operacional',
    system: false,
    members: 5,
  },
];

/* -------------------------------------------------------------------------- */
/* Rótulos                                                                     */
/* -------------------------------------------------------------------------- */

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: 'Ativa',
  trial: 'Em teste',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
};

export const PROVISIONING_LABEL: Record<ProvisioningState, string> = {
  PENDING: 'Na fila',
  RUNNING: 'Provisionando',
  READY: 'Pronto',
  FAILED: 'Falhou',
};

export const TELEMETRY_LABEL: Record<TelemetryState, string> = {
  CONNECTED: 'Conectada',
  PENDING_CONNECTOR: 'Sem conector',
  PENDING_CONTRACT: 'Sem contrato',
};

export const TELEMETRY_HINT: Record<TelemetryState, string> = {
  CONNECTED: 'Coleta ativa pelo conector MiX.',
  PENDING_CONNECTOR: 'Fornecedor contratado pelo cliente, mas ainda sem conector implementado.',
  PENDING_CONTRACT: 'O cliente ainda não contratou rastreamento. A conta no fornecedor é dele.',
};

export const DOMAIN_LABEL: Record<DomainState, string> = {
  REGISTERED: 'Registrado',
  PENDING: 'Registrando',
  FAILED: 'Falhou',
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  PLATFORM_ADMIN: 'TI Nível Topo',
  PLATFORM_SUPPORT: 'TI Nível Operacional',
};

export const PLATFORM_ROLE_DESCRIPTION: Record<PlatformRole, string> = {
  PLATFORM_ADMIN:
    'Controle global. Único que cria e desliga contas: as da plataforma e o Dono de cada transportadora.',
  PLATFORM_SUPPORT:
    'Suporte e manutenção. Leitura dos dados de qualquer cliente, sempre auditada. Nenhuma escrita.',
};

export const ACCESS_REQUEST_LABEL: Record<AccessRequestStatus, string> = {
  pending: 'Aguardando',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

/** Fontes homologadas. Chave, nunca arquivo: upload livre traria licenciamento
 *  de terceiro para dentro da nossa hospedagem. */
export const APPROVED_FONTS: { value: string; label: string }[] = [
  { value: 'default', label: 'Padrão RookHub (Plus Jakarta Sans)' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'source-sans', label: 'Source Sans 3' },
  { value: 'ibm-plex', label: 'IBM Plex Sans' },
];

/** Fornecedores de telemetria conhecidos. Só a MiX tem conector implementado. */
export const TELEMETRY_PROVIDERS: { value: string; label: string; hasConnector: boolean }[] = [
  { value: 'mix', label: 'MiX Telematics', hasConnector: true },
  { value: 'sascar', label: 'Sascar', hasConnector: false },
  { value: 'omnilink', label: 'Omnilink', hasConnector: false },
  { value: 'autotrac', label: 'Autotrac', hasConnector: false },
  { value: 'ituran', label: 'Ituran', hasConnector: false },
];
