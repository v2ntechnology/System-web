/**
 * Perfis do produto. Os quatro primeiros são os papéis operacionais da
 * transportadora; `SUPER_ADMIN` administra a plataforma e `DRIVER` só existe no
 * aplicativo do motorista — não tem painel.
 *
 * Proprietário e gestor entram pelo painel de gestão (`/gestao`); operador e
 * manutenção, direto no painel operacional (`/app`).
 */
export type UserRole = 'OWNER' | 'MANAGER' | 'OPERATOR' | 'MAINTENANCE' | 'SUPER_ADMIN' | 'DRIVER';

export type Permission =
  | 'dashboard.view'
  | 'fleet.view'
  | 'vehicles.view'
  | 'vehicles.create'
  | 'vehicles.update'
  | 'drivers.view'
  | 'trips.view'
  | 'tracking.view'
  | 'fuel.view'
  | 'maintenance.manage'
  | 'fines.view'
  | 'checklists.review'
  | 'entries.manage'
  | 'triage.review'
  | 'alerts.view'
  | 'analytics.view'
  | 'ai.use'
  | 'integrations.manage'
  | 'settings.manage'
  | 'billing.manage'
  | 'saas.manage';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | undefined;
  jobTitle?: string | undefined;
  permissions: Permission[];
  tenantId: string;
  /**
   * RF-007 — se o operador enxerga valor financeiro consolidado. Os demais
   * perfis não dependem deste campo: proprietário, gestor e super admin sempre
   * veem; manutenção e motorista, nunca.
   */
  operatorSeesFinancials: boolean;
}
