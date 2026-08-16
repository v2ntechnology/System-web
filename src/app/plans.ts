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
