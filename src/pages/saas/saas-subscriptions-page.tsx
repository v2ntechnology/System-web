import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { InfoCard } from '@/components/shared/cards';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate } from '@/lib/format';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { SAAS_SUBSCRIPTIONS, type SaasSubscription } from '@/mocks/saas';

export default function SaasSubscriptionsPage() {
  const mrr = SAAS_SUBSCRIPTIONS.reduce((sum, s) => sum + s.mrr, 0);
  const active = SAAS_SUBSCRIPTIONS.filter((s) => s.status === 'active').length;
  const trial = SAAS_SUBSCRIPTIONS.filter((s) => s.status === 'trial').length;

  const columns: DataTableColumn<SaasSubscription>[] = [
    {
      id: 'tenant',
      header: 'Empresa',
      cell: (s) => <span className="font-medium">{s.tenant}</span>,
    },
    {
      id: 'plan',
      header: 'Plano',
      cell: (s) => <Badge variant="default">{PLAN_LABELS[s.plan]}</Badge>,
    },
    { id: 'mrr', header: 'MRR', align: 'right', cell: (s) => formatCurrency(s.mrr) },
    { id: 'renews', header: 'Renovação', cell: (s) => formatDate(s.renewsAt) },
    {
      id: 'status',
      header: 'Status',
      cell: (s) => <StatusBadge descriptor={tenantStatusDescriptor(s.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Receita recorrente e situação das assinaturas."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="MRR total" value={formatCurrency(mrr)} accent="success" />
        <InfoCard label="Assinaturas ativas" value={active} accent="info" />
        <InfoCard label="Em trial" value={trial} />
      </div>

      <DataTable columns={columns} data={SAAS_SUBSCRIPTIONS} getRowId={(s) => s.id} />
    </div>
  );
}
