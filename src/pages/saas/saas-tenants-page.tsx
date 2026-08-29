import { ChevronRightIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/shared/filters';
import { Badge } from '@/components/ui/badge';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate } from '@/lib/format';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { SAAS_TENANTS, type SaasTenant } from '@/mocks/saas';

export default function SaasTenantsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return SAAS_TENANTS;
    return SAAS_TENANTS.filter((t) => t.name.toLowerCase().includes(term));
  }, [search]);

  const columns: DataTableColumn<SaasTenant>[] = [
    {
      id: 'name',
      header: 'Empresa',
      cell: (t) => (
        <div>
          <p className="font-medium">{t.name}</p>
          <p className="text-xs text-muted-foreground">{t.slug}</p>
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Plano',
      cell: (t) => <Badge variant="default">{PLAN_LABELS[t.plan]}</Badge>,
    },
    { id: 'vehicles', header: 'Veículos', align: 'right', cell: (t) => t.vehicles },
    { id: 'users', header: 'Usuários', align: 'right', cell: (t) => t.users },
    { id: 'mrr', header: 'MRR', align: 'right', cell: (t) => formatCurrency(t.mrr) },
    { id: 'created', header: 'Desde', cell: (t) => formatDate(t.createdAt) },
    {
      id: 'status',
      header: 'Status',
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
        title="Empresas"
        description="Todas as transportadoras que utilizam a plataforma."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar empresa"
        className="w-full md:max-w-xs"
        aria-label="Buscar empresas"
      />
      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(t) => t.id}
        onRowClick={(t) => navigate(`/admin-saas/empresas/${t.id}`)}
        emptyState={<EmptyState title="Nenhuma empresa encontrada" />}
      />
    </div>
  );
}
