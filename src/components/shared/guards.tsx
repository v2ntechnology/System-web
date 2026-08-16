import { type ReactNode } from 'react';

import { NoAccessState, PlanLockedState } from '@/components/shared/states';
import { usePermissions, usePlan } from '@/hooks/use-session';
import { type ModuleKey, type Permission } from '@/types';

interface PermissionGuardProps {
  permission: Permission;
  children: ReactNode;
  /** Quando definido, substitui o estado padrão de "sem permissão". */
  fallback?: ReactNode;
}

/**
 * Oculta conteúdo quando o usuário não possui a permissão necessária.
 * IMPORTANTE: isto é apenas controle visual — a segurança real deve ser
 * garantida pelo backend em toda requisição.
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(permission)) {
    return <>{fallback ?? <NoAccessState />}</>;
  }
  return <>{children}</>;
}

interface PlanGuardProps {
  module: ModuleKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Bloqueia visualmente módulos não incluídos no plano do tenant. */
export function PlanGuard({ module, children, fallback }: PlanGuardProps) {
  const { isModuleEnabled } = usePlan();
  if (!isModuleEnabled(module)) {
    return <>{fallback ?? <PlanLockedState />}</>;
  }
  return <>{children}</>;
}
