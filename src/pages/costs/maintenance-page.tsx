import { ErrorState, LoadingState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionGuard } from '@/components/shared/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMaintenance } from '@/hooks/use-queries';
import { formatDate, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MAINTENANCE_STATUS_LABEL, MAINTENANCE_STATUS_ORDER } from '@/mocks/costs/maintenance';
import { type MaintenanceOrder, type MaintenancePriority } from '@/types';

const PRIORITY: Record<
  MaintenancePriority,
  { label: string; variant: 'destructive' | 'warning' | 'muted' }
> = {
  high: { label: 'Alta', variant: 'destructive' },
  medium: { label: 'Média', variant: 'warning' },
  low: { label: 'Baixa', variant: 'muted' },
};

const COLUMN_ACCENT: Record<string, string> = {
  preventive_soon: 'border-t-info',
  under_review: 'border-t-muted-foreground',
  waiting_parts: 'border-t-warning',
  in_progress: 'border-t-primary',
  completed: 'border-t-success',
  overdue: 'border-t-destructive',
};

function OrderCard({ order }: { order: MaintenanceOrder }) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{order.title}</p>
          <Badge variant={PRIORITY[order.priority].variant}>{PRIORITY[order.priority].label}</Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{order.vehiclePlate}</p>
        <p className="text-xs text-muted-foreground">{order.workshop}</p>
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-muted-foreground">Prazo: {formatDate(order.dueDate)}</span>
          <span className="font-medium">{formatCurrency(order.estimatedCost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MaintenancePage() {
  const { data, isLoading, isError, refetch } = useMaintenance();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenções"
        description="Gestão das ordens de manutenção organizadas por status (visão kanban)."
      />
      <PermissionGuard permission="maintenance.manage">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <LoadingState label="Carregando ordens…" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MAINTENANCE_STATUS_ORDER.map((status) => {
              const orders = data.filter((o) => o.status === status);
              return (
                <div
                  key={status}
                  className={cn(
                    'rounded-lg border border-t-2 border-border bg-muted/20',
                    COLUMN_ACCENT[status],
                  )}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <h3 className="text-sm font-semibold">{MAINTENANCE_STATUS_LABEL[status]}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {orders.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-3 pt-0">
                    {orders.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">Sem ordens</p>
                    ) : (
                      orders.map((order) => <OrderCard key={order.id} order={order} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PermissionGuard>
    </div>
  );
}
