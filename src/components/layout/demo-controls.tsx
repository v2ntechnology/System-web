import { FlaskConical } from 'lucide-react';

import { PLAN_LABELS } from '@/app/plans';
import { ROLE_LABELS } from '@/app/permissions';
import {
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/hooks/use-session';
import { useSessionStore } from '@/stores/session-store';
import type { PlanType, UserRole } from '@/types';

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
const PLANS = Object.keys(PLAN_LABELS) as PlanType[];

/**
 * Controle exclusivo da demonstração (Fase 1): permite alternar perfil e plano
 * para evidenciar o controle de permissões e o gating por plano. Não existirá
 * em produção — o perfil virá da sessão real autenticada no backend.
 */
export function DemoMenu() {
  const { user, tenant } = useSession();
  const setRole = useSessionStore((s) => s.setRole);
  const setPlan = useSessionStore((s) => s.setPlan);

  if (!user || !tenant) return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FlaskConical />
        Modo demonstração
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Perfil de acesso
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={user.role} onValueChange={(v) => setRole(v as UserRole)}>
            {ROLES.map((role) => (
              <DropdownMenuRadioItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Plano do cliente
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={tenant.plan} onValueChange={(v) => setPlan(v as PlanType)}>
            {PLANS.map((plan) => (
              <DropdownMenuRadioItem key={plan} value={plan}>
                {PLAN_LABELS[plan]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
