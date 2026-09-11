import { permissionsForRole } from '@/app/permissions';
import type { AuthUser, Tenant, UserRole } from '@/types';

export const DEMO_TENANT: Tenant = {
  id: 'tenant-servioeste',
  name: 'Servioeste',
  slug: 'servioeste',
  plan: 'business',
  status: 'active',
};

export const SECONDARY_TENANT: Tenant = {
  id: 'tenant-viacarga',
  name: 'ViaCarga Logística',
  slug: 'viacarga',
  plan: 'enterprise',
  status: 'active',
};

/** Identidade de demonstração de cada perfil, usada pelo login mockado. */
const DEMO_IDENTITY: Record<
  UserRole,
  { id: string; name: string; email: string; jobTitle: string }
> = {
  OWNER: {
    id: 'user-marina',
    name: 'Marina Alves',
    email: 'marina.alves@servioeste.com.br',
    jobTitle: 'Proprietária',
  },
  MANAGER: {
    id: 'user-felipe',
    name: 'Felipe Vinícius',
    email: 'felipe.vinicius@teste.com.br',
    jobTitle: 'Gestor de operações',
  },
  OPERATOR: {
    id: 'user-paula',
    name: 'Paula Fernandes',
    email: 'paula.fernandes@servioeste.com.br',
    jobTitle: 'Operadora de pátio',
  },
  MAINTENANCE: {
    id: 'user-roberto',
    name: 'Roberto Dias',
    email: 'roberto.dias@servioeste.com.br',
    jobTitle: 'Encarregado de manutenção',
  },
  SUPER_ADMIN: {
    id: 'user-admin',
    name: 'Admin RookHub',
    email: 'admin@rookhub.com.br',
    jobTitle: 'Administração da plataforma',
  },
  DRIVER: {
    id: 'user-jonas',
    name: 'Jonas Prado',
    email: 'jonas.prado@servioeste.com.br',
    jobTitle: 'Motorista',
  },
};

/**
 * Contas de demonstração da Fase 1.
 *
 * O e-mail identifica o perfil, então entrar como `operador@rookhub.com.br`
 * mostra a plataforma pelos olhos do operador. Senha única e pública de
 * propósito: não há backend, e a validação só existe para exercitar a tela.
 *
 * São os quatro perfis do cliente mais o `SUPER_ADMIN`, que administra a
 * plataforma e não uma transportadora: a casa dele é o `/admin-saas`.
 *
 * ⚠️ O super admin ficou de fora desta lista até 11/09/2026, porque o caminho
 * documentado para ele era o seletor de perfil do "Modo demonstração". Esse
 * caminho não existe mais na prática: o seletor vive na topbar do `/app`, o
 * `canUseDemoControls` o esconde de operador e manutenção, e o `RoleAreaRoute`
 * manda dono e gestor de volta para o `/painel` antes de chegarem lá. Sobrava um
 * nó: era preciso já ser super admin para ver o menu que tornaria alguém super
 * admin. Com a conta abaixo o backoffice volta a ser alcançável.
 */
export const DEMO_PASSWORD = 'rookhub123';

export const DEMO_CREDENTIALS: { email: string; role: UserRole }[] = [
  { email: 'dono@rookhub.com.br', role: 'OWNER' },
  { email: 'gestor@rookhub.com.br', role: 'MANAGER' },
  { email: 'operador@rookhub.com.br', role: 'OPERATOR' },
  { email: 'manutencao@rookhub.com.br', role: 'MAINTENANCE' },
  { email: 'superadmin@rookhub.com.br', role: 'SUPER_ADMIN' },
];

/** Conta bloqueada — exercita o caminho de erro da tela de login. */
export const BLOCKED_EMAIL = 'bloqueado@rookhub.com.br';

export function buildDemoUser(role: UserRole = 'MANAGER'): AuthUser {
  const identity = DEMO_IDENTITY[role];
  return {
    ...identity,
    role,
    permissions: permissionsForRole(role),
    tenantId: DEMO_TENANT.id,
    /* Demonstração: a operadora vê valores; o gate real virá do backend. */
    operatorSeesFinancials: role !== 'OPERATOR',
  };
}
