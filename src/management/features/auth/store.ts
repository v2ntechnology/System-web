import { useMemo } from 'react';

import { modulesForPlan } from '@/app/plans';
import type { Module, Session } from '@/management/types';
import { useSessionStore } from '@/stores/session-store';
import type { ModuleKey } from '@/types';

/**
 * Ponte entre a sessão do System-web e o formato que o painel de gestão espera.
 *
 * O painel veio do monorepo com store próprio (`zustand` + `persist`). Manter os
 * dois significaria duas verdades sobre quem está logado — o topo mostrando um
 * usuário e a sidebar outro. Aqui o `session-store` do System-web é a única
 * fonte; este módulo só reprojeta o formato para as telas portadas.
 */

/**
 * Entitlement do painel a partir do plano do tenant.
 *
 * O painel raciocina em módulos contratados (`FLEET`, `SAFETY`…); o System-web,
 * em módulos de plano (`fleet`, `analytics`…). O mapa mantém o gate de plano
 * funcionando nas telas portadas sem duplicar a tabela de planos.
 */
const MODULE_BY_PLAN_KEY: Record<Module, ModuleKey> = {
  FLEET: 'fleet',
  TRIPS: 'trips',
  CHECKLIST: 'checklists',
  COSTS: 'fuel',
  MAINTENANCE: 'maintenance',
  SAFETY: 'analytics',
  ASSISTANT: 'ai',
};

const ALL_MODULES = Object.keys(MODULE_BY_PLAN_KEY) as Module[];

export function useSession(): Session | null {
  const user = useSessionStore((state) => state.user);
  const tenant = useSessionStore((state) => state.tenant);
  const status = useSessionStore((state) => state.status);

  return useMemo(() => {
    if (status !== 'authenticated' || !user || !tenant) return null;

    const planModules = modulesForPlan(tenant.plan);
    const modules = ALL_MODULES.filter((module) =>
      planModules.includes(MODULE_BY_PLAN_KEY[module]),
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        operatorSeesFinancials: user.operatorSeesFinancials,
        mfaEnabled: false,
      },
      tenant: { id: tenant.id, name: tenant.name, modules },
      /* Fase 1 sem backend: não há token real para guardar (ver README). */
      accessToken: '',
      expiresAt: '',
    };
  }, [status, user, tenant]);
}
