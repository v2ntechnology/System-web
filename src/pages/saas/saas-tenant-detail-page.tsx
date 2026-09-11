import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  MailIcon,
  PowerIcon,
  RefreshIcon,
  ShieldCheckIcon,
  UnlockIcon,
} from '@/components/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/states';
import { InfoCard } from '@/components/shared/cards';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PLAN_DEFINITIONS, PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import {
  domainDescriptor,
  provisioningDescriptor,
  telemetryDescriptor,
  tenantStatusDescriptor,
} from '@/lib/status-maps';
import { useSession } from '@/hooks/use-session';
import { useSaasStore } from '@/stores/saas-store';
import { SEEDED_ROLES, type SeededRole } from '@/mocks/saas';
import type { PlanType } from '@/types';

import {
  BrandPreview,
  Callout,
  DefinitionRow,
  ProvisioningTimeline,
  TelemetryHint,
} from './saas-ui';

export default function SaasTenantDetailPage() {
  const { tenantId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const actor = user?.name ?? 'Administração';

  const tenant = useSaasStore((s) => s.tenants.find((t) => t.id === tenantId));
  const audit = useSaasStore((s) => s.audit);
  const setTenantStatus = useSaasStore((s) => s.setTenantStatus);
  const setTenantPlan = useSaasStore((s) => s.setTenantPlan);
  const retryProvisioning = useSaasStore((s) => s.retryProvisioning);

  const [confirmingSuspend, setConfirmingSuspend] = useState(false);

  if (!tenant) {
    return (
      <ErrorState
        title="Transportadora não encontrada"
        description="A empresa solicitada não existe ou foi removida."
        onRetry={() => navigate('/admin-saas/empresas')}
      />
    );
  }

  const suspended = tenant.status === 'suspended';
  const tenantAudit = audit.filter((entry) => entry.tenant === tenant.name);

  function handleToggleStatus() {
    if (!tenant) return;
    setTenantStatus(tenant.id, suspended ? 'active' : 'suspended', actor);
    toast.success(suspended ? 'Transportadora reativada' : 'Transportadora suspensa', {
      description: suspended
        ? 'O acesso volta na próxima requisição, sem novo login.'
        : 'Ninguém da empresa consegue entrar até a reativação.',
    });
  }

  function handlePlanChange(plan: PlanType) {
    if (!tenant) return;
    setTenantPlan(tenant.id, plan, actor);
    toast.success(`Plano alterado para ${PLAN_LABELS[plan]}`, {
      description: 'Vale na requisição seguinte: o cliente não precisa entrar de novo.',
    });
  }

  function handleRetry() {
    if (!tenant) return;
    retryProvisioning(tenant.id, actor);
    toast.success('Provisionamento reiniciado');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin-saas/empresas')}
          aria-label="Voltar para a lista"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="min-w-[240px] flex-1">
          <PageHeader title={tenant.name} description={`${tenant.slug}.rookhub.com.br`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge descriptor={provisioningDescriptor(tenant.provisioningState)} />
          <StatusBadge descriptor={tenantStatusDescriptor(tenant.status)} />
        </div>
      </div>

      {tenant.provisioningState === 'FAILED' && (
        <Callout
          tone="destructive"
          title="O provisionamento falhou e a empresa está inacessível"
          action={
            <Button size="sm" onClick={handleRetry}>
              <RefreshIcon className="h-4 w-4" />
              Tentar de novo
            </Button>
          }
        >
          {tenant.provisioningError}
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Plano" value={PLAN_LABELS[tenant.plan]} />
        <InfoCard label="Veículos" value={tenant.vehicles} accent="info" />
        <InfoCard label="Usuários" value={tenant.users} />
        <InfoCard label="MRR" value={formatCurrency(tenant.mrr)} accent="success" />
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="telemetria">Telemetria</TabsTrigger>
          <TabsTrigger value="marca">Marca</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="geral" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cadastro</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DefinitionRow label="Razão social" value={tenant.name} />
              <DefinitionRow label="CNPJ" value={tenant.document} />
              <DefinitionRow
                label="Endereço"
                value={<span className="font-mono">{tenant.slug}.rookhub.com.br</span>}
              />
              <DefinitionRow
                label="Schema"
                value={<span className="font-mono">tenant_{tenant.slug}</span>}
              />
              <DefinitionRow label="Cliente desde" value={formatDate(tenant.createdAt)} />
              {tenant.trialEndsAt && (
                <DefinitionRow label="Teste até" value={formatDate(tenant.trialEndsAt)} />
              )}
              <DefinitionRow
                label="Domínio na Cloudflare"
                value={<StatusBadge descriptor={domainDescriptor(tenant.domainState)} />}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dono da conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <DefinitionRow label="Nome" value={tenant.ownerName} />
                <DefinitionRow
                  label="E-mail"
                  value={
                    <a
                      href={`mailto:${tenant.ownerEmail}`}
                      className="inline-flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <MailIcon className="h-3.5 w-3.5" />
                      {tenant.ownerEmail}
                    </a>
                  }
                />
                <p className="text-xs text-muted-foreground">
                  É a única credencial que a aprovação cria. Convidar e desligar o restante da
                  equipe é responsabilidade dele, e o TI Topo só intervém de forma auditada.
                </p>
                <Button variant="outline" size="sm">
                  <MailIcon className="h-4 w-4" />
                  Reenviar convite do Dono
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provisionamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ProvisioningTimeline
                  state={tenant.provisioningState}
                  error={tenant.provisioningError}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant={suspended ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => (suspended ? handleToggleStatus() : setConfirmingSuspend(true))}
                >
                  {suspended ? (
                    <UnlockIcon className="h-4 w-4" />
                  ) : (
                    <PowerIcon className="h-4 w-4" />
                  )}
                  {suspended ? 'Reativar' : 'Suspender'}
                </Button>
                <Button variant="outline" size="sm">
                  <ShieldCheckIcon className="h-4 w-4" />
                  Abrir em modo suporte
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="cargos" className="mt-4 space-y-4">
          <Callout tone="info" icon={BadgeCheckIcon} title="Os cargos são do Dono, não nossos">
            A empresa nasce com seis cargos semeados como sugestão. O Dono renomeia, muda
            permissões, apaga ou cria outros. Só o cargo Dono é indelével.
          </Callout>
          <RolesTable />
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="telemetria" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situação da coleta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <DefinitionRow
                label="Estado"
                value={<StatusBadge descriptor={telemetryDescriptor(tenant.telemetryState)} />}
              />
              <DefinitionRow
                label="Fornecedor"
                value={tenant.telemetryProvider ?? 'Não contratado'}
              />
              <TelemetryHint state={tenant.telemetryState} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conta no fornecedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm text-muted-foreground">
              <p>
                A conta é <strong className="text-foreground">do cliente</strong>. A RookHub
                intermedia a integração e não revende o rastreamento.
              </p>
              <p>
                Isso evita que a saída de um cliente vire disputa sobre rastreador instalado, e é o
                que a arquitetura de integrações já assume desde a primeira versão.
              </p>
              <Button variant="outline" size="sm">
                Testar conexão
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="marca" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parâmetros</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DefinitionRow
                label="Cor principal"
                value={
                  <span className="inline-flex items-center gap-2 font-mono">
                    <span
                      className="h-3 w-3 rounded-full border border-border"
                      style={{ backgroundColor: tenant.branding.colorPrimary }}
                      aria-hidden
                    />
                    {tenant.branding.colorPrimary}
                  </span>
                }
              />
              <DefinitionRow
                label="Cor de apoio"
                value={tenant.branding.colorAccent ?? 'Não definida'}
              />
              <DefinitionRow label="Fonte" value={tenant.branding.fontFamily} />
              <DefinitionRow
                label="Logo"
                value={tenant.branding.logoUrl ? 'Enviado' : 'Não enviado'}
              />
              <p className="pt-3 text-xs text-muted-foreground">
                A marca é lida antes do login, quando ainda não há sessão nem empresa no token. Por
                isso mora no plano de controle, e não no schema do cliente.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Prévia do login do cliente</p>
            <BrandPreview branding={tenant.branding} companyName={tenant.name} slug={tenant.slug} />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="plano" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plano contratado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <Select
                    value={tenant.plan}
                    onValueChange={(v) => handlePlanChange(v as PlanType)}
                  >
                    <SelectTrigger className="w-[200px]" aria-label="Alterar plano">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="pb-2 text-xs text-muted-foreground">
                  Trocar o plano vale na requisição seguinte, sem novo login.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Módulos liberados ({PLAN_DEFINITIONS[tenant.plan].modules.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLAN_DEFINITIONS[tenant.plan].modules.map((m) => (
                    <Badge key={m} variant="outline">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Callout tone="info" title="O plano é o teto; o cargo distribui o que sobrou">
            As permissões do cargo são intersectadas com as do plano. Rota de módulo não contratado
            devolve 402, para a tela oferecer upgrade em vez de dizer “sem acesso”.
          </Callout>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="auditoria" className="mt-4">
          <Card>
            <CardContent className="divide-y divide-border/60 pt-6">
              {tenantAudit.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum evento registrado para esta transportadora.
                </p>
              )}
              {tenantAudit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Badge variant={entry.kind === 'support' ? 'info' : 'muted'} className="mt-0.5">
                    {entry.kind === 'support' ? 'Suporte' : 'Admin'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor} · {formatDateTime(entry.at)}
                      {entry.route && ` · ${entry.method} ${entry.route}`}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmingSuspend}
        onOpenChange={setConfirmingSuspend}
        title={`Suspender ${tenant.name}?`}
        description="Ninguém da empresa consegue entrar enquanto estiver suspensa, inclusive o Dono. Os dados permanecem intactos e a reativação vale na requisição seguinte."
        confirmLabel="Suspender"
        variant="destructive"
        onConfirm={handleToggleStatus}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cargos semeados                                                             */
/* -------------------------------------------------------------------------- */

function RolesTable() {
  const columns: DataTableColumn<SeededRole>[] = [
    {
      id: 'name',
      header: 'Cargo',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{r.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{r.key}</p>
          </div>
          {r.system && <Badge variant="default">Sistema</Badge>}
        </div>
      ),
    },
    {
      id: 'description',
      header: 'O que faz',
      cell: (r) => <span className="text-sm text-muted-foreground">{r.description}</span>,
    },
    {
      id: 'landing',
      header: 'Entra em',
      cell: (r) => (
        <Badge variant={r.landing === 'gestao' ? 'info' : 'muted'}>
          {r.landing === 'gestao' ? '/gestao' : '/app'}
        </Badge>
      ),
    },
    { id: 'members', header: 'Pessoas', align: 'right', cell: (r) => r.members },
  ];

  return <DataTable columns={columns} data={SEEDED_ROLES} getRowId={(r) => r.key} />;
}
