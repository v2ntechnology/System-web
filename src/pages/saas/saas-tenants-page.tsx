import { ChevronRightIcon, CompanyIcon, PlusIcon } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ApiErrorState, EmptyState, LoadingState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  provisioningDescriptor,
  telemetryDescriptor,
  tenantStatusDescriptor,
} from '@/lib/status-maps';
import { ApiError } from '@/services/http';
import { createTenant, SAAS_KEYS, useTenants, type TenantSetupInput } from './saas-api';
import { ApprovalWizard } from './approval-wizard';
import { TENANT_STATUS_LABEL, type SaasTenant } from '@/mocks/saas';
import type { PlanType, TenantStatus } from '@/types';

/** De onde a empresa veio, em uma palavra. */
const ORIGIN_LABEL: Record<string, string> = {
  ACCESS_REQUEST: 'Site',
  BACKOFFICE: 'Venda ativa',
};

type StatusFilter = TenantStatus | 'all' | 'provisioning';
type PlanFilter = PlanType | 'all';

/**
 * Todas as transportadoras atendidas, prontas ou não.
 *
 * A coluna de provisionamento vem antes do status comercial de propósito: uma
 * empresa `FAILED` está provisionada e **inacessível**, e esse é o problema que
 * precisa saltar da tela, e não o plano que ela assinou.
 */
export default function SaasTenantsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenants, carregando, erro } = useTenants();

  const [cadastrando, setCadastrando] = useState(false);

  /*
   * ⚠️ O cadastro direto é o MESMO assistente da aprovação, aberto sem
   * solicitação. Ele mora aqui, e não na fila: quem vende ativo não passa pela
   * fila, e procurar o botão dentro dela seria procurar no lugar errado.
   */
  const cadastro = useMutation({
    mutationFn: (input: TenantSetupInput) => createTenant(input),
    onSuccess: (resultado) => {
      setCadastrando(false);
      void queryClient.invalidateQueries({ queryKey: SAAS_KEYS.tenants });
      void queryClient.invalidateQueries({ queryKey: SAAS_KEYS.metrics });
      toast.success('Ambiente em provisionamento', {
        description: `${resultado.slug}.rookhub.com.br. O convite do Dono sai quando o schema ficar pronto.`,
      });
    },
    onError: (causa) =>
      toast.error(
        causa instanceof ApiError ? causa.message : 'Não foi possível cadastrar a transportadora.',
      ),
  });

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [plan, setPlan] = useState<PlanFilter>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (term && !t.name.toLowerCase().includes(term) && !t.slug.includes(term)) return false;
      if (plan !== 'all' && t.plan !== plan) return false;
      if (status === 'provisioning') return t.provisioningState !== 'READY';
      if (status !== 'all' && t.status !== status) return false;
      return true;
    });
  }, [tenants, search, status, plan]);

  const columns: DataTableColumn<SaasTenant>[] = [
    {
      id: 'name',
      header: 'Transportadora',
      cell: (t) => (
        <div>
          <p className="font-medium">{t.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{t.slug}.rookhub.com.br</p>
        </div>
      ),
    },
    {
      id: 'provisioning',
      header: 'Ambiente',
      cell: (t) => <StatusBadge descriptor={provisioningDescriptor(t.provisioningState)} />,
    },
    {
      id: 'telemetry',
      header: 'Telemetria',
      cell: (t) => (
        <div className="space-y-0.5">
          <StatusBadge descriptor={telemetryDescriptor(t.telemetryState)} />
          {t.telemetryProvider && (
            <p className="text-xs text-muted-foreground">{t.telemetryProvider}</p>
          )}
        </div>
      ),
    },
    { id: 'plan', header: 'Plano', cell: (t) => <Badge>{PLAN_LABELS[t.plan]}</Badge> },
    {
      id: 'origin',
      header: 'Entrada',
      /* Empresa anterior à coluna não tem origem gravada, e a tela não afirma
         nada quando não sabe. */
      cell: (t) =>
        t.origin ? (
          <Badge variant="muted">{ORIGIN_LABEL[t.origin] ?? t.origin}</Badge>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    /* ⚠️ Contagem só vale com o ambiente pronto: o schema de quem ainda está
       provisionando não tem o que contar, e zero ali leria como empresa vazia.
       Mesma regra do MRR logo abaixo, ausência aparece como ausência. */
    {
      id: 'vehicles',
      header: 'Veículos',
      align: 'right',
      cell: (t) =>
        t.provisioningState === 'READY' ? (
          t.vehicles
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      id: 'users',
      header: 'Usuários',
      align: 'right',
      cell: (t) =>
        t.provisioningState === 'READY' ? (
          t.users
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      id: 'mrr',
      header: 'MRR',
      align: 'right',
      /* Ausência aparece como ausência. Ver a nota em `SaasTenant.mrr`. */
      cell: (t) =>
        t.mrr == null ? (
          <span className="text-muted-foreground">não medido</span>
        ) : (
          formatCurrency(t.mrr)
        ),
    },
    { id: 'created', header: 'Desde', cell: (t) => formatDate(t.createdAt) },
    {
      id: 'status',
      header: 'Situação',
      cell: (t) => <StatusBadge descriptor={tenantStatusDescriptor(t.status)} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: () => <ChevronRightIcon className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transportadoras"
        description="Cada empresa tem o próprio schema no Postgres e o próprio subdomínio."
        actions={
          <Button onClick={() => setCadastrando(true)}>
            <PlusIcon className="h-4 w-4" />
            Cadastrar
          </Button>
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou endereço"
          className="w-full md:max-w-xs"
          aria-label="Buscar transportadoras"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="provisioning">Em provisionamento</SelectItem>
            {(Object.keys(TENANT_STATUS_LABEL) as TenantStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {TENANT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={(v) => setPlan(v as PlanFilter)}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por plano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {carregando ? (
        <LoadingState label="Carregando as transportadoras" />
      ) : erro ? (
        <ApiErrorState error={erro} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowId={(t) => t.id}
          onRowClick={(t) => navigate(`/admin-saas/empresas/${t.slug}`)}
          emptyState={
            <EmptyState
              icon={CompanyIcon}
              title="Nenhuma transportadora encontrada"
              description="Ajuste os filtros, cadastre uma direto ou aprove uma solicitação de acesso."
            />
          }
        />
      )}

      <ApprovalWizard
        request={null}
        tenants={tenants}
        open={cadastrando}
        onOpenChange={setCadastrando}
        onConfirm={(input) => cadastro.mutate(input)}
        salvando={cadastro.isPending}
      />
    </div>
  );
}
