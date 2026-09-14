import type { ModuleKey, PlanDefinition, PlanType } from '@/types';

const CORE_MODULES: ModuleKey[] = [
  'dashboard',
  'fleet',
  'vehicles',
  'drivers',
  'trips',
  'tracking',
  'fuel',
  'maintenance',
  'fines',
  'checklists',
  'alerts',
  'settings',
  'plans',
];

export const PLAN_DEFINITIONS: Record<PlanType, PlanDefinition> = {
  starter: {
    type: 'starter',
    name: 'Starter',
    description: 'Para transportadoras iniciando a digitalização da operação.',
    monthlyPrice: 890,
    vehicleLimit: 25,
    userLimit: 10,
    modules: CORE_MODULES,
  },
  business: {
    type: 'business',
    name: 'Business',
    description: 'Operações em crescimento que precisam de inteligência e analytics.',
    monthlyPrice: 2490,
    vehicleLimit: 120,
    userLimit: 40,
    modules: [...CORE_MODULES, 'analytics', 'ai', 'integrations'],
    highlighted: true,
  },
  enterprise: {
    type: 'enterprise',
    name: 'Enterprise',
    description: 'Grandes frotas com múltiplas unidades e governança avançada.',
    monthlyPrice: 5990,
    vehicleLimit: 1000,
    userLimit: 250,
    modules: [...CORE_MODULES, 'analytics', 'ai', 'integrations', 'saas'],
  },
};

/**
 * A ordem comercial dos planos. É o que define "o próximo plano que resolve".
 */
export const PLAN_ORDER: PlanType[] = ['starter', 'business', 'enterprise'];

/**
 * Nome de cada módulo em português, para o 402 conseguir dizer o que faltou.
 *
 * ⚠️ Existe por causa do `modulo` que vem no corpo do 402. Sem esta tabela a
 * oferta de upgrade diria "este recurso", que é o mesmo texto para integrações,
 * analytics e assistente, e quem lê não descobre o que precisa contratar.
 */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Painel',
  fleet: 'Frota',
  vehicles: 'Veículos',
  drivers: 'Motoristas',
  trips: 'Viagens',
  tracking: 'Rastreamento',
  fuel: 'Abastecimentos',
  maintenance: 'Manutenção',
  fines: 'Multas',
  checklists: 'Checklists',
  alerts: 'Alertas',
  analytics: 'Analytics',
  ai: 'Assistente inteligente',
  integrations: 'Integrações de telemetria',
  settings: 'Configurações',
  plans: 'Planos',
  saas: 'Backoffice da plataforma',
};

export function moduleLabel(moduleKey: string | null): string | null {
  if (!moduleKey) return null;
  return MODULE_LABELS[moduleKey as ModuleKey] ?? moduleKey;
}

/**
 * O plano mais barato que inclui o módulo, ou `null` se nenhum incluir.
 *
 * ⚠️ **Sai das `PLAN_DEFINITIONS`, e não de uma tabela paralela.** O backend
 * espelha estas definições: dizer "vem no plano Business" a partir de outra
 * fonte seria prometer o que a API não cumpre no dia em que alguém mudar um
 * lado só.
 */
export function planoQueInclui(moduleKey: string | null): PlanType | null {
  if (!moduleKey) return null;
  return (
    PLAN_ORDER.find((plan) => PLAN_DEFINITIONS[plan].modules.includes(moduleKey as ModuleKey)) ??
    null
  );
}

export const PLAN_LABELS: Record<PlanType, string> = {
  starter: 'Starter',
  business: 'Business',
  enterprise: 'Enterprise',
};

export function modulesForPlan(plan: PlanType): ModuleKey[] {
  return PLAN_DEFINITIONS[plan].modules;
}

export function isModuleEnabled(plan: PlanType, moduleKey: ModuleKey): boolean {
  return PLAN_DEFINITIONS[plan].modules.includes(moduleKey);
}
