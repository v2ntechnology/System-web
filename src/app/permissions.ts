import type { Permission, UserRole } from '@/types';

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'fleet.view',
  'vehicles.view',
  'vehicles.create',
  'vehicles.update',
  'drivers.view',
  'trips.view',
  'tracking.view',
  'fuel.view',
  'maintenance.manage',
  'fines.view',
  'checklists.review',
  'entries.manage',
  'triage.review',
  'alerts.view',
  'analytics.view',
  'ai.use',
  'integrations.manage',
  'settings.manage',
  'billing.manage',
  'saas.manage',
];

const OPERATIONAL_VIEW: Permission[] = [
  'dashboard.view',
  'fleet.view',
  'vehicles.view',
  'drivers.view',
  'trips.view',
  'tracking.view',
  'fuel.view',
  'fines.view',
  'alerts.view',
  'analytics.view',
];

/**
 * Mapa de perfis para capacidades. A ocultação visual NÃO é segurança real;
 * o backend deverá revalidar todas as permissões antes de qualquer operação.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  /* Dono da transportadora: a operação inteira mais contrato e cobrança. */
  OWNER: [
    ...OPERATIONAL_VIEW,
    'vehicles.create',
    'vehicles.update',
    'maintenance.manage',
    'checklists.review',
    'ai.use',
    'integrations.manage',
    'settings.manage',
    'billing.manage',
  ],
  /* Gestor analisa e libera a operação; fatura e contrato são do proprietário. */
  MANAGER: [
    ...OPERATIONAL_VIEW,
    'vehicles.create',
    'vehicles.update',
    'maintenance.manage',
    'checklists.review',
    'triage.review',
    'ai.use',
  ],
  MAINTENANCE: [
    'dashboard.view',
    'fleet.view',
    'vehicles.view',
    'maintenance.manage',
    'checklists.review',
    'alerts.view',
    'ai.use',
  ],
  /*
   * Operador lança documento e tria checklist — RF-007 mantém fora dele o custo
   * consolidado (`analytics.view`) e qualquer edição de cadastro de veículo.
   */
  OPERATOR: [
    'dashboard.view',
    'fleet.view',
    'vehicles.view',
    'drivers.view',
    'trips.view',
    'tracking.view',
    'entries.manage',
    'triage.review',
    'checklists.review',
    'alerts.view',
  ],
  DRIVER: ['dashboard.view', 'trips.view', 'checklists.review'],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Proprietário',
  MANAGER: 'Gestor',
  MAINTENANCE: 'Manutenção',
  OPERATOR: 'Operador',
  DRIVER: 'Motorista',
};

/** Perfis que passam pela hub de escolha (IA ou sistema) depois do login. */
export const HUB_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'SUPER_ADMIN'];

/**
 * Quem enxerga o atalho de troca de perfil e plano da demonstração.
 *
 * Decisão do usuário em 20/08/2026: quem trabalha no pátio não vê. Operador e
 * manutenção entram no sistema para lançar documento e cuidar de veículo, e um
 * seletor que troca o próprio perfil no meio disso só confunde.
 */
export function canUseDemoControls(role: UserRole): boolean {
  return role !== 'OPERATOR' && role !== 'MAINTENANCE';
}

/** Perfis cujo sistema é o painel de gestão (`/gestao`), e não o operacional. */
export function usesManagementPanel(role: UserRole): boolean {
  return role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

/** Rota inicial depois de autenticar, por perfil. */
export function landingForRole(role: UserRole): string {
  return usesManagementPanel(role) ? '/painel' : '/app/dashboard';
}

export function permissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
