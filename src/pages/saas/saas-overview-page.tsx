import {
  ArrowRightIcon,
  CompanyIcon,
  InboxIcon,
  SatelliteIcon,
  TrendUpIcon,
  TruckIcon,
} from '@/components/icons';
import { Link } from 'react-router';

import { ChartCard, SimpleBarChart } from '@/components/shared/charts';
import { InfoCard } from '@/components/shared/cards';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  provisioningDescriptor,
  telemetryDescriptor,
  tenantStatusDescriptor,
} from '@/lib/status-maps';
import { useSaasStore } from '@/stores/saas-store';
import { TELEMETRY_LABEL } from '@/mocks/saas';
import type { ChartPoint, TelemetryState } from '@/types';

import { Callout, ProvisioningTimeline } from './saas-ui';

/**
 * Painel de entrada do Super Admin.
 *
 * A pergunta que ele responde não é "quanto faturamos", e sim **o que está
 * travado**: solicitação esperando decisão e ambiente que não terminou de subir.
 * Receita e uso vêm depois, porque não exigem ação de ninguém hoje.
 */
export default function SaasOverviewPage() {
  const tenants = useSaasStore((s) => s.tenants);
  const requests = useSaasStore((s) => s.requests);

  const ready = tenants.filter((t) => t.provisioningState === 'READY');
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const provisioning = tenants.filter((t) => t.provisioningState !== 'READY');

  const active = ready.filter((t) => t.status === 'active').length;
  const trial = ready.filter((t) => t.status === 'trial').length;
  const suspended = ready.filter((t) => t.status === 'suspended').length;

  const mrr = ready.reduce((sum, t) => sum + t.mrr, 0);
  const users = ready.reduce((sum, t) => sum + t.users, 0);
  const vehicles = ready.reduce((sum, t) => sum + t.vehicles, 0);

  const mrrGrowth: ChartPoint[] = [
    { label: 'Mai', mrr: 15200 },
    { label: 'Jun', mrr: 16100 },
    { label: 'Jul', mrr: 17900 },
    { label: 'Ago', mrr: 18400 },
    { label: 'Set', mrr },
  ];

  const telemetryCount = (state: TelemetryState) =>
    ready.filter((t) => t.telemetryState === state).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral da plataforma"
        description="Empresas atendidas, entradas em andamento e receita recorrente."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-saas/solicitacoes">
              <InboxIcon className="h-4 w-4" />
              Ver solicitações
            </Link>
          </Button>
        }
      />

      {pendingRequests.length > 0 && (
        <Callout
          tone="warning"
          icon={InboxIcon}
          title={`${pendingRequests.length} ${pendingRequests.length === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} decisão`}
          action={
            <Button asChild size="sm">
              <Link to="/admin-saas/solicitacoes">
                Abrir a fila
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {pendingRequests
            .slice(0, 3)
            .map((r) => r.company)
            .join(' · ')}
          {pendingRequests.length > 3 && ` · +${pendingRequests.length - 3}`}
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Transportadoras ativas" value={ready.length} icon={CompanyIcon} />
        <InfoCard
          label="Receita recorrente (MRR)"
          value={formatCurrency(mrr)}
          icon={TrendUpIcon}
          accent="success"
        />
        <InfoCard label="Usuários" value={formatNumber(users)} icon={CompanyIcon} accent="info" />
        <InfoCard label="Veículos monitorados" value={formatNumber(vehicles)} icon={TruckIcon} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Em operação" value={active} accent="success" />
        <InfoCard label="Em teste (trial)" value={trial} accent="info" />
        <InfoCard label="Suspensas" value={suspended} accent="warning" />
      </div>

      {provisioning.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ambientes em provisionamento</CardTitle>
            <Badge variant="info">{provisioning.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {provisioning.map((tenant) => (
              <div
                key={tenant.id}
                className="grid gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin-saas/empresas/${tenant.id}`}
                      className="font-medium hover:underline"
                    >
                      {tenant.name}
                    </Link>
                    <StatusBadge descriptor={provisioningDescriptor(tenant.provisioningState)} />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {tenant.slug}.rookhub.com.br
                  </p>
                </div>
                <ProvisioningTimeline
                  state={tenant.provisioningState}
                  error={tenant.provisioningError}
                  className="sm:w-80"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-base">Telemetria</CardTitle>
            <SatelliteIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {(['CONNECTED', 'PENDING_CONNECTOR', 'PENDING_CONTRACT'] as TelemetryState[]).map(
              (state) => {
                const count = telemetryCount(state);
                const pct = ready.length ? Math.round((count / ready.length) * 100) : 0;
                return (
                  <div key={state} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{TELEMETRY_LABEL[state]}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand-gradient"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              },
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Só a MiX tem conector implementado. Os demais estados são ambientes liberados sem
              coleta.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Transportadoras recentes</CardTitle>
          <Link to="/admin-saas/empresas" className="text-xs text-accent hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...tenants]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((tenant) => (
              <Link
                key={tenant.id}
                to={`/admin-saas/empresas/${tenant.id}`}
                className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tenant.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PLAN_LABELS[tenant.plan]} · {tenant.vehicles} veículos · {tenant.users}{' '}
                    usuários
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge descriptor={telemetryDescriptor(tenant.telemetryState)} />
                  <StatusBadge
                    descriptor={
                      tenant.provisioningState === 'READY'
                        ? tenantStatusDescriptor(tenant.status)
                        : provisioningDescriptor(tenant.provisioningState)
                    }
                  />
                </div>
              </Link>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
