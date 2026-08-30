import type { PlanType, TenantStatus } from '@/types';

export interface SaasTenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  status: TenantStatus;
  vehicles: number;
  users: number;
  mrr: number;
  createdAt: string;
}

export const SAAS_TENANTS: SaasTenant[] = [
  {
    id: 'tenant-servioeste',
    name: 'Servioeste',
    slug: 'servioeste',
    plan: 'business',
    status: 'active',
    vehicles: 118,
    users: 24,
    mrr: 2490,
    createdAt: '2023-02-14',
  },
  {
    id: 'tenant-viacarga',
    name: 'ViaCarga Logística',
    slug: 'viacarga',
    plan: 'enterprise',
    status: 'active',
    vehicles: 640,
    users: 112,
    mrr: 5990,
    createdAt: '2022-08-03',
  },
  {
    id: 'tenant-translog',
    name: 'TransLog Sul',
    slug: 'translog',
    plan: 'business',
    status: 'active',
    vehicles: 92,
    users: 18,
    mrr: 2490,
    createdAt: '2023-06-21',
  },
  {
    id: 'tenant-rapidão',
    name: 'Rapidão Cargas',
    slug: 'rapidao',
    plan: 'starter',
    status: 'trial',
    vehicles: 12,
    users: 5,
    mrr: 0,
    createdAt: '2024-05-02',
  },
  {
    id: 'tenant-norte',
    name: 'Norte Expresso',
    slug: 'norte-expresso',
    plan: 'starter',
    status: 'active',
    vehicles: 21,
    users: 8,
    mrr: 890,
    createdAt: '2023-11-09',
  },
  {
    id: 'tenant-atlas',
    name: 'Atlas Transportadora',
    slug: 'atlas',
    plan: 'business',
    status: 'suspended',
    vehicles: 76,
    users: 15,
    mrr: 0,
    createdAt: '2022-12-30',
  },
  {
    id: 'tenant-horizonte',
    name: 'Horizonte Logística',
    slug: 'horizonte',
    plan: 'enterprise',
    status: 'active',
    vehicles: 410,
    users: 89,
    mrr: 5990,
    createdAt: '2023-01-18',
  },
  {
    id: 'tenant-primecargo',
    name: 'PrimeCargo',
    slug: 'primecargo',
    plan: 'starter',
    status: 'cancelled',
    vehicles: 0,
    users: 0,
    mrr: 0,
    createdAt: '2023-04-25',
  },
];

export interface SaasUser {
  id: string;
  name: string;
  email: string;
  tenant: string;
  role: string;
  active: boolean;
}

export const SAAS_USERS: SaasUser[] = [
  {
    id: 'u1',
    name: 'Thiago Santos',
    email: 'thiago@servioeste.com.br',
    tenant: 'Servioeste',
    role: 'Gestor de frota',
    active: true,
  },
  {
    id: 'u2',
    name: 'Marina Alves',
    email: 'marina@servioeste.com.br',
    tenant: 'Servioeste',
    role: 'Administrador',
    active: true,
  },
  {
    id: 'u3',
    name: 'Eduardo Ramos',
    email: 'eduardo@viacarga.com.br',
    tenant: 'ViaCarga Logística',
    role: 'Administrador',
    active: true,
  },
  {
    id: 'u4',
    name: 'Sofia Nunes',
    email: 'sofia@translog.com.br',
    tenant: 'TransLog Sul',
    role: 'Operador',
    active: true,
  },
  {
    id: 'u5',
    name: 'Bruno Carvalho',
    email: 'bruno@atlas.com.br',
    tenant: 'Atlas Transportadora',
    role: 'Administrador',
    active: false,
  },
  {
    id: 'u6',
    name: 'Helena Costa',
    email: 'helena@horizonte.com.br',
    tenant: 'Horizonte Logística',
    role: 'Gestor de manutenção',
    active: true,
  },
];

export interface SaasSubscription {
  id: string;
  tenant: string;
  plan: PlanType;
  status: TenantStatus;
  mrr: number;
  renewsAt: string;
}

export const SAAS_SUBSCRIPTIONS: SaasSubscription[] = SAAS_TENANTS.map((t) => ({
  id: `sub-${t.id}`,
  tenant: t.name,
  plan: t.plan,
  status: t.status,
  mrr: t.mrr,
  renewsAt: '2024-06-01',
}));

export const SAAS_AUDIT: { id: string; actor: string; action: string; date: string }[] = [
  {
    id: 'a1',
    actor: 'Sistema',
    action: 'Rapidão Cargas iniciou período de trial',
    date: '2024-05-02T09:12:00-03:00',
  },
  {
    id: 'a2',
    actor: 'Marina Alves',
    action: 'Upgrade do plano Starter para Business (Servioeste)',
    date: '2024-04-28T14:30:00-03:00',
  },
  {
    id: 'a3',
    actor: 'Sistema',
    action: 'Atlas Transportadora suspensa por inadimplência',
    date: '2024-04-20T02:00:00-03:00',
  },
  {
    id: 'a4',
    actor: 'Eduardo Ramos',
    action: 'Adicionou 40 veículos (ViaCarga)',
    date: '2024-04-15T11:05:00-03:00',
  },
  {
    id: 'a5',
    actor: 'Sistema',
    action: 'PrimeCargo cancelou a assinatura',
    date: '2024-04-10T18:45:00-03:00',
  },
];

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: 'Ativa',
  trial: 'Em teste',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
};
