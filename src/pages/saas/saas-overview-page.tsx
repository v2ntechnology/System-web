import {
  ArrowRightIcon,
  CompanyIcon,
  InboxIcon,
  SatelliteIcon,
  TrendUpIcon,
  TruckIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';
import { Link } from 'react-router';

import { ChartCard, SimpleBarChart } from '@/components/shared/charts';
import { InfoCard } from '@/components/shared/cards';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_LABELS } from '@/app/plans';
import { useSession } from '@/hooks/use-session';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  provisioningDescriptor,
  telemetryDescriptor,
  tenantStatusDescriptor,
} from '@/lib/status-maps';
import { useAccessRequests, useTenants } from './saas-api';
import { TELEMETRY_LABEL } from '@/mocks/saas';
import type { ChartPoint, TelemetryState } from '@/types';

import { Callout, ProvisioningTimeline } from './saas-ui';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function PlatformMetricCard({
  icon: Icon,
  label,
  value,
  description,
  accent = 'secondary',
}: {
  icon: IconType;
  label: string;
  value: string | number;
  description: string;
  accent?: 'secondary' | 'success' | 'info';
}) {
  const accentClass =
    accent === 'success'
      ? 'bg-success/15 text-success'
      : accent === 'info'
        ? 'bg-info/15 text-info'
        : 'bg-secondary/15 text-secondary';

  return (
    <article className="rounded-[28px] bg-card p-5 shadow-[0_16px_32px_-22px_rgba(28,26,24,0.32)] ring-1 ring-on-surface/[0.06] sm:p-6">
      <span className={`flex size-9 items-center justify-center rounded-xl ${accentClass}`}>
        <Icon className="size-[18px]" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </article>
  );
}

/**
 * Painel de entrada do Super Admin.
 *
 * A pergunta que ele responde não é "quanto faturamos", e sim **o que está
 * travado**: solicitação esperando decisão e ambiente que não terminou de subir.
 * Receita e uso vêm depois, porque não exigem ação de ninguém hoje.
 */
export default function SaasOverviewPage() {
  const { user } = useSession();
  const { tenants } = useTenants();
  /* A fila só interessa aqui pelo que está parado esperando decisão: a consulta
     já traz apenas as pendentes. */
  const pendingRequests = useAccessRequests('pending').data ?? [];

  const ready = tenants.filter((t) => t.provisioningState === 'READY');
  const provisioning = tenants.filter((t) => t.provisioningState !== 'READY');

  const active = ready.filter((t) => t.status === 'active').length;
  const trial = ready.filter((t) => t.status === 'trial').length;
  const suspended = ready.filter((t) => t.status === 'suspended').length;

  /* Quem não tem MRR medido fica de fora da soma, em vez de entrar como zero e
     puxar o total para baixo fingindo ser cliente que não paga. */
  const mrr = ready.reduce((sum, t) => sum + (t.mrr ?? 0), 0);
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
      <div>
        <section className="rounded-xl bg-primary px-6 pb-28 pt-8 text-on-primary sm:px-8 sm:pt-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[36px]">
                {saudacao()}, {user?.name?.split(' ')[0] ?? 'usuário'}
              </h1>
              <p className="mt-2 text-base sm:text-lg">
                Acompanhe as transportadoras, acessos e a operação da plataforma RookHub.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-on-primary bg-transparent text-on-primary hover:bg-on-primary hover:text-primary"
            >
              <Link to="/admin-saas/solicitacoes">
                <InboxIcon className="h-4 w-4" />
                Ver solicitações
              </Link>
            </Button>
          </div>
        </section>

        <div className="relative -mt-20 grid gap-4 px-3 sm:grid-cols-2 sm:px-6 xl:grid-cols-4 xl:px-10">
          <PlatformMetricCard
            icon={CompanyIcon}
            label="Transportadoras ativas"
            value={ready.length}
            description="Empresas com ambiente em operação"
          />
          <PlatformMetricCard
            icon={TrendUpIcon}
            label="Receita recorrente"
            value={formatCurrency(mrr)}
            description="MRR dos contratos ativos"
            accent="success"
          />
          <PlatformMetricCard
            icon={CompanyIcon}
            label="Pessoas na plataforma"
            value={formatNumber(users)}
            description="Usuários com acesso liberado"
            accent="info"
          />
          <PlatformMetricCard
            icon={TruckIcon}
            label="Veículos monitorados"
            value={formatNumber(vehicles)}
            description="Frota conectada à plataforma"
          />
        </div>
      </div>

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
                      to={`/admin-saas/empresas/${tenant.slug}`}
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
                to={`/admin-saas/empresas/${tenant.slug}`}
                className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tenant.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {/* Ambiente que não está pronto não tem contagem para
                        mostrar: ver a nota em `provisionamento`. */}
                    {PLAN_LABELS[tenant.plan]}
                    {tenant.provisioningState === 'READY'
                      ? ` · ${tenant.vehicles} veículos · ${tenant.users} usuários`
                      : ' · ambiente em preparação'}
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
