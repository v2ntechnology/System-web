import { ClockIcon, MaintenanceIcon, MoneyIcon, WarningIcon } from '@/components/icons';
import { useMemo } from 'react';

import { usePermissions } from '@/hooks/use-session';
import { ErrorState, LoadingState } from '@/components/shared/states';
import {
  HeroPill,
  HeroStats,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { PermissionGuard } from '@/components/shared/guards';
import { Badge } from '@/components/ui/badge';
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
    /* Tokens `light`: o cartão mora dentro do painel claro, e a família
       `surface` do papel do painel operacional some contra ele. */
    <div className="bg-light ring-light-edge space-y-2 rounded-lg p-3 ring-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-on-light text-sm font-medium leading-tight">{order.title}</p>
        <Badge variant={PRIORITY[order.priority].variant}>{PRIORITY[order.priority].label}</Badge>
      </div>
      <p className="text-on-light-muted font-mono text-xs">{order.vehiclePlate}</p>
      <p className="text-on-light-muted text-xs">{order.workshop}</p>
      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-on-light-muted">Prazo: {formatDate(order.dueDate)}</span>
        <span className="text-on-light font-medium tabular-nums">
          {formatCurrency(order.estimatedCost)}
        </span>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { data, isLoading, isError, refetch } = useMaintenance();
  /*
   * ⚠️ Os números da faixa passam pela MESMA permissão do quadro. Sem isso a
   * faixa entregava "12 ordens" e o orçamento aberto para quem o
   * `PermissionGuard` abaixo manda embora com "Acesso restrito": o cabeçalho
   * vazava o dado que a tela nega.
   */
  const { hasPermission } = usePermissions();
  const canSee = hasPermission('maintenance.manage');

  const all = useMemo(() => data ?? [], [data]);

  const stats: HeroStat[] = useMemo(() => {
    const overdue = all.filter((o) => o.status === 'overdue').length;
    const inProgress = all.filter((o) => o.status === 'in_progress').length;
    const highPriority = all.filter((o) => o.priority === 'high').length;
    const budget = all
      .filter((o) => o.status !== 'completed')
      .reduce((total, o) => total + o.estimatedCost, 0);

    return [
      {
        key: 'abertas',
        label: 'Ordens',
        value: all.length,
        hint: 'no quadro inteiro',
        icon: MaintenanceIcon,
      },
      {
        key: 'atrasadas',
        label: 'Atrasadas',
        value: overdue,
        hint: overdue > 0 ? 'passaram do prazo' : 'nenhuma fora do prazo',
        icon: WarningIcon,
        tone: overdue > 0 ? 'alert' : 'neutral',
      },
      {
        key: 'oficina',
        label: 'Na oficina',
        value: inProgress,
        hint: `${highPriority} de prioridade alta`,
        icon: ClockIcon,
        tone: highPriority > 0 ? 'warn' : 'neutral',
      },
      {
        key: 'orcamento',
        label: 'Orçamento aberto',
        value: formatCurrency(budget),
        hint: 'fora as ordens concluídas',
        icon: MoneyIcon,
      },
    ];
  }, [all]);

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Manutenções"
        description="Gestão das ordens de manutenção organizadas por status (visão kanban)."
        bleed={canSee}
      >
        {canSee ? (
          <HeroPill icon={MaintenanceIcon}>
            {all.length} {all.length === 1 ? 'ordem' : 'ordens'}
          </HeroPill>
        ) : null}
      </PageHero>

      {canSee && <HeroStats items={stats} />}

      <PagePanel className={canSee ? undefined : 'mt-6'}>
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
                      'border-light-outline bg-light-container rounded-lg border border-t-2',
                      COLUMN_ACCENT[status],
                    )}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <h3 className="text-on-light text-sm font-semibold">
                        {MAINTENANCE_STATUS_LABEL[status]}
                      </h3>
                      <span className="bg-light text-on-light-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
                        {orders.length}
                      </span>
                    </div>
                    <div className="space-y-2 p-3 pt-0">
                      {orders.length === 0 ? (
                        <p className="text-on-light-muted py-4 text-center text-xs">Sem ordens</p>
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
      </PagePanel>
    </div>
  );
}
