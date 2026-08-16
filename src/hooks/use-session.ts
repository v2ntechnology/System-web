import { useCallback } from 'react';

import { isModuleEnabled, PLAN_DEFINITIONS } from '@/app/plans';
import { useSessionStore } from '@/stores/session-store';
import type { ModuleKey, Permission, PlanType } from '@/types';

export function useSession() {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);
  const tenant = useSessionStore((s) => s.tenant);
  return { status, user, tenant, isAuthenticated: status === 'authenticated' };
}

export function usePermissions() {
  const permissions = useSessionStore((s) => s.user?.permissions ?? []);

  const hasPermission = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (required: Permission[]) => required.some((p) => permissions.includes(p)),
    [permissions],
  );

  return { permissions, hasPermission, hasAnyPermission };
}

export function usePlan() {
  const plan: PlanType = useSessionStore((s) => s.tenant?.plan ?? 'starter');

  const isEnabled = useCallback((moduleKey: ModuleKey) => isModuleEnabled(plan, moduleKey), [plan]);

  return {
    plan,
    definition: PLAN_DEFINITIONS[plan],
    isModuleEnabled: isEnabled,
  };
}
