import { TruckIcon, UsersIcon } from '@/components/icons';

import { PLAN_DEFINITIONS } from '@/app/plans';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/format';
import { SAAS_TENANTS } from '@/mocks/saas';
import type { PlanType } from '@/types';

const ORDER: PlanType[] = ['starter', 'business', 'enterprise'];

export default function SaasPlansPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Configuração comercial dos planos oferecidos na plataforma."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((planType) => {
          const def = PLAN_DEFINITIONS[planType];
          const subscribers = SAAS_TENANTS.filter((t) => t.plan === planType).length;
          return (
            <Card key={planType} className={def.highlighted ? 'border-primary/50' : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{def.name}</CardTitle>
                  <Badge variant="muted">{subscribers} empresas</Badge>
                </div>
                <CardDescription>{def.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-display text-2xl font-bold">
                  {formatCurrency(def.monthlyPrice)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TruckIcon className="h-4 w-4" />
                    {formatNumber(def.vehicleLimit)} veículos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="h-4 w-4" />
                    {formatNumber(def.userLimit)} usuários
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {def.modules.slice(0, 8).map((module) => (
                    <Badge key={module} variant="outline" className="text-[11px]">
                      {module}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
