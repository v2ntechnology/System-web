import { ArrowLeft } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { InfoCard } from '@/components/shared/cards';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PLAN_LABELS } from '@/app/plans';
import { formatCurrency, formatDate } from '@/lib/format';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { SAAS_TENANTS } from '@/mocks/saas';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SaasTenantDetailPage() {
  const { tenantId = '' } = useParams();
  const navigate = useNavigate();
  const tenant = SAAS_TENANTS.find((t) => t.id === tenantId);

  if (!tenant) {
    return (
      <ErrorState title="Empresa não encontrada" description="A empresa solicitada não existe." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin-saas/empresas')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader title={tenant.name} description={`Identificador: ${tenant.slug}`} />
        </div>
        <StatusBadge descriptor={tenantStatusDescriptor(tenant.status)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Plano" value={PLAN_LABELS[tenant.plan]} />
        <InfoCard label="Veículos" value={tenant.vehicles} accent="info" />
        <InfoCard label="Usuários" value={tenant.users} />
        <InfoCard label="MRR" value={formatCurrency(tenant.mrr)} accent="success" />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Dados da assinatura</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <InfoRow label="Cliente desde" value={formatDate(tenant.createdAt)} />
          <Separator />
          <InfoRow label="Plano" value={PLAN_LABELS[tenant.plan]} />
          <Separator />
          <InfoRow
            label="Status"
            value={<StatusBadge descriptor={tenantStatusDescriptor(tenant.status)} />}
          />
          <Separator />
          <InfoRow label="Receita mensal" value={formatCurrency(tenant.mrr)} />
        </CardContent>
      </Card>
    </div>
  );
}
