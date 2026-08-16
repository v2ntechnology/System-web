import { Check, Sparkles } from 'lucide-react';

import { PLAN_DEFINITIONS } from '@/app/plans';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionGuard } from '@/components/shared/guards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlan } from '@/hooks/use-session';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VEHICLES } from '@/mocks/fleet/vehicles';
import { useSessionStore } from '@/stores/session-store';
import type { PlanType } from '@/types';

const PLAN_ORDER: PlanType[] = ['starter', 'business', 'enterprise'];

const MODULE_HIGHLIGHTS: Record<PlanType, string[]> = {
  starter: [
    'Gestão de frota e veículos',
    'Motoristas e viagens',
    'Manutenções e checklists',
    'Rastreamento básico',
  ],
  business: ['Tudo do Starter', 'Analytics avançado', 'IA RookHub', 'Integrações externas'],
  enterprise: [
    'Tudo do Business',
    'Administração multiempresa',
    'Governança e auditoria',
    'Suporte dedicado',
  ],
};

function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', pct > 85 ? 'bg-destructive' : 'bg-brand-gradient')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { plan, definition } = usePlan();
  const setPlan = useSessionStore((s) => s.setPlan);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Acompanhe seu plano atual, uso e opções de upgrade."
      />

      <PermissionGuard permission="billing.manage">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Plano atual</CardTitle>
                <Badge variant="default">{definition.name}</Badge>
              </div>
              <CardDescription>{definition.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-display text-3xl font-bold">
                {formatCurrency(definition.monthlyPrice)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <UsageBar label="Veículos" used={VEHICLES.length} total={definition.vehicleLimit} />
              <UsageBar label="Usuários" used={24} total={definition.userLimit} />
              <UsageBar label="Consultas de IA" used={320} total={1000} />
              <p className="text-xs text-muted-foreground">
                Próxima cobrança simulada em 01/06/2024.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
            {PLAN_ORDER.map((planType) => {
              const def = PLAN_DEFINITIONS[planType];
              const isCurrent = plan === planType;
              return (
                <Card
                  key={planType}
                  className={cn('flex flex-col', def.highlighted && 'border-primary/50 shadow-lg')}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{def.name}</CardTitle>
                      {def.highlighted && (
                        <Badge variant="info">
                          <Sparkles className="h-3 w-3" />
                          Popular
                        </Badge>
                      )}
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(def.monthlyPrice)}
                      <span className="text-xs font-normal text-muted-foreground">/mês</span>
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <ul className="flex-1 space-y-2 text-sm">
                      {MODULE_HIGHLIGHTS[planType].map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={isCurrent ? 'outline' : def.highlighted ? 'brand' : 'default'}
                      disabled={isCurrent}
                      onClick={() => setPlan(planType)}
                    >
                      {isCurrent ? 'Plano atual' : 'Selecionar plano'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </PermissionGuard>
    </div>
  );
}
