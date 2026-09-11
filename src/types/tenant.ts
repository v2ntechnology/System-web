export type PlanType = 'starter' | 'business' | 'enterprise';

export type TenantStatus = 'active' | 'trial' | 'suspended' | 'cancelled';

/** Módulos que podem ser liberados por plano. Também usado para gating visual. */
export type ModuleKey =
  | 'dashboard'
  | 'fleet'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'tracking'
  | 'fuel'
  | 'maintenance'
  | 'fines'
  | 'checklists'
  | 'alerts'
  | 'analytics'
  | 'ai'
  | 'integrations'
  | 'settings'
  | 'plans'
  | 'saas';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | undefined;
  plan: PlanType;
  status: TenantStatus;
}

export interface PlanDefinition {
  type: PlanType;
  name: string;
  description: string;
  monthlyPrice: number;
  vehicleLimit: number;
  userLimit: number;
  modules: ModuleKey[];
  highlighted?: boolean | undefined;
}

export interface PlanUsage {
  vehiclesUsed: number;
  usersUsed: number;
  aiQueriesUsed: number;
  aiQueriesLimit: number;
  nextBillingDate: string;
}

/* -------------------------------------------------------------------------- */
/* Onboarding de transportadoras                                               */
/* -------------------------------------------------------------------------- */

/**
 * Estágio do provisionamento do ambiente da transportadora.
 *
 * Criar o schema e rodar as migrations leva segundos demais para caber num
 * request, então a aprovação devolve `RUNNING` e a tela acompanha até `READY`.
 * `FAILED` guarda o motivo e permite tentar de novo sem refazer o formulário.
 */
export type ProvisioningState = 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';

/**
 * Situação da telemetria do cliente.
 *
 * Só a MiX tem conector implementado. Os outros dois estados existem porque o
 * ambiente é liberado mesmo sem coleta: sem eles a tela de integrações mostraria
 * frota vazia sem explicar o porquê.
 */
export type TelemetryState = 'CONNECTED' | 'PENDING_CONNECTOR' | 'PENDING_CONTRACT';

/** Registro do domínio do cliente na Cloudflare. É ponto de falha externo. */
export type DomainState = 'REGISTERED' | 'PENDING' | 'FAILED';

/** Papéis da equipe interna da RookHub. Fixos: são nossos, não configuráveis. */
export type PlatformRole = 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT';

/** Situação de uma solicitação de acesso vinda do site institucional. */
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

/** Marca do cliente, aplicada já na tela de login pelo host. */
export interface TenantBranding {
  logoUrl?: string | undefined;
  colorPrimary: string;
  colorAccent?: string | undefined;
  /** Chave da lista homologada, nunca um arquivo enviado pelo cliente. */
  fontFamily: string;
}
