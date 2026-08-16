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
