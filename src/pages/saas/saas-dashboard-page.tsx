import {
  CompanyIcon,
  IntegrationIcon,
  TrendUpIcon,
  TruckIcon,
  UsersIcon,
} from '@/components/icons';
import { Link } from 'react-router';

import { ChartCard, SimpleBarChart } from '@/components/shared/charts';
import { InfoCard } from '@/components/shared/cards';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/format';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { SAAS_TENANTS } from '@/mocks/saas';
import { type ChartPoint } from '@/types';

export default function SaasDashboardPage() {
  const total = SAAS_TENANTS.length;
  const active = SAAS_TENANTS.filter((t) => t.status === 'active').length;
  const trial = SAAS_TENANTS.filter((t) => t.status === 'trial').length;
  const suspended = SAAS_TENANTS.filter((t) => t.status === 'suspended').length;
  const mrr = SAAS_TENANTS.reduce((sum, t) => sum + t.mrr, 0);
  const users = SAAS_TENANTS.reduce((sum, t) => sum + t.users, 0);
  const vehicles = SAAS_TENANTS.reduce((sum, t) => sum + t.vehicles, 0);

  const mrrGrowth: ChartPoint[] = [
    { label: 'Jan', mrr: 18200 },
    { label: 'Fev', mrr: 19100 },
    { label: 'Mar', mrr: 20500 },
    { label: 'Abr', mrr: 21800 },
    { label: 'Mai', mrr: mrr },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard SaaS"
        description="Visão consolidada da plataforma: empresas, receita e uso."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Empresas" value={total} icon={CompanyIcon} />
        <InfoCard
          label="Receita recorrente (MRR)"
          value={formatCurrency(mrr)}
          icon={TrendUpIcon}
          accent="success"
        />
        <InfoCard
          label="Usuários ativos"
          value={formatNumber(users)}
          icon={UsersIcon}
          accent="info"
        />
        <InfoCard label="Veículos monitorados" value={formatNumber(vehicles)} icon={TruckIcon} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Empresas ativas" value={active} accent="success" />
        <InfoCard label="Em teste (trial)" value={trial} accent="info" />
        <InfoCard label="Suspensas" value={suspended} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Evolução do MRR"
          description="Receita recorrente mensal (R$)"
          className="lg:col-span-2"
        >
          <SimpleBarChart data={mrrGrowth} dataKey="mrr" label="MRR" color="var(--color-primary)" />
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Consumo de integrações</CardTitle>
            <IntegrationIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Telemetria', pct: 82 },
              { name: 'Rastreamento', pct: 74 },
              { name: 'WhatsApp', pct: 58 },
              { name: 'Multas', pct: 33 },
            ].map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">{item.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand-gradient"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Empresas recentes</CardTitle>
          <Link to="/admin-saas/empresas" className="text-xs text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {SAAS_TENANTS.slice(0, 5).map((tenant) => (
            <div
              key={tenant.id}
              className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tenant.vehicles} veículos · {tenant.users} usuários
                </p>
              </div>
              <StatusBadge descriptor={tenantStatusDescriptor(tenant.status)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
