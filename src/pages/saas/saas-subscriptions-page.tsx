import { useMemo } from 'react';
import { Link } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { InfoCard } from '@/components/shared/cards';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { useSaasStore } from '@/stores/saas-store';
import type { SaasTenant } from '@/mocks/saas';

/**
 * Receita recorrente por transportadora.
 *
 * Sai da mesma lista de empresas, e não de um mock paralelo: assinatura é um
 * recorte comercial do tenant, e duplicar a fonte faria a tela divergir da
 * realidade no primeiro upgrade feito no detalhe da empresa.
 */
export default function SaasSubscriptionsPage() {
  const tenants = useSaasStore((s) => s.tenants);

  const billable = useMemo(
    () => tenants.filter((t) => t.provisioningState === 'READY' && t.status !== 'cancelled'),
    [tenants],
  );

  const mrr = billable.reduce((sum, t) => sum + t.mrr, 0);
  const active = billable.filter((t) => t.status === 'active').length;
  const trial = billable.filter((t) => t.status === 'trial').length;
  /* Trial e suspensa não pagam: a receita potencial é o que entra se todas
     converterem, e é a única leitura que justifica acompanhar os dois números. */
  const potential = billable.reduce(
    (sum, t) => sum + (t.mrr || { starter: 890, business: 2490, enterprise: 5990 }[t.plan]),
    0,
  );

  const columns: DataTableColumn<SaasTenant>[] = [
    {
      id: 'tenant',
      header: 'Transportadora',
      cell: (t) => (
        <Link to={`/admin-saas/empresas/${t.id}`} className="font-medium hover:underline">
          {t.name}
        </Link>
      ),
    },
    { id: 'plan', header: 'Plano', cell: (t) => <Badge>{PLAN_LABELS[t.plan]}</Badge> },
    { id: 'seats', header: 'Usuários', align: 'right', cell: (t) => formatNumber(t.users) },
    { id: 'vehicles', header: 'Veículos', align: 'right', cell: (t) => formatNumber(t.vehicles) },
    {
      id: 'mrr',
      header: 'MRR',
      align: 'right',
      cell: (t) =>
        t.mrr > 0 ? formatCurrency(t.mrr) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'renews',
      header: 'Renova em',
      cell: (t) => (t.trialEndsAt ? formatDate(t.trialEndsAt) : formatDate('2026-10-01')),
    },
    {
      id: 'status',
      header: 'Situação',
      cell: (t) => <StatusBadge descriptor={tenantStatusDescriptor(t.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Receita recorrente e situação contratual de cada transportadora."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="MRR realizado" value={formatCurrency(mrr)} accent="success" />
        <InfoCard label="MRR potencial" value={formatCurrency(potential)} accent="info" />
        <InfoCard label="Assinaturas ativas" value={active} />
        <InfoCard label="Em teste" value={trial} accent="warning" />
      </div>

      <DataTable columns={columns} data={billable} getRowId={(t) => t.id} />
    </div>
  );
}
