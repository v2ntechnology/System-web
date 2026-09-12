import { ChevronRightIcon, CompanyIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/states';
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
import { useTenants } from './saas-api';
import { TENANT_STATUS_LABEL, type SaasTenant } from '@/mocks/saas';
import type { PlanType, TenantStatus } from '@/types';

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
  const { tenants } = useTenants();

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
    { id: 'vehicles', header: 'Veículos', align: 'right', cell: (t) => t.vehicles },
    { id: 'users', header: 'Usuários', align: 'right', cell: (t) => t.users },
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

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(t) => t.id}
        onRowClick={(t) => navigate(`/admin-saas/empresas/${t.id}`)}
        emptyState={
          <EmptyState
            icon={CompanyIcon}
            title="Nenhuma transportadora encontrada"
            description="Ajuste os filtros ou aprove uma solicitação de acesso para criar a primeira."
          />
        }
      />
    </div>
  );
}
