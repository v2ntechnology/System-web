import { CalendarBlankIcon, ClockIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { MaintenanceOrder, MaintenanceStatus } from '@/management/types';
import { LightCard, cn } from '@/management/ui';
import type { ComponentType } from 'react';

export interface MaintenanceCardProps {
  orders: MaintenanceOrder[];
  className?: string | undefined;
}

/**
 * Status sempre acompanhado de ícone e texto — nunca só cor (RNF-028).
 * As cores vivem sobre o bloco escuro, onde os semânticos da marca funcionam.
 */
const STATUS: Record<
  MaintenanceStatus,
  { label: string; className: string; icon: ComponentType<{ size?: number; weight?: 'fill' }> }
> = {
  ATRASADA: { label: 'Atrasada', className: 'text-error', icon: WarningCircleIcon },
  HOJE: { label: 'Hoje', className: 'text-warning', icon: ClockIcon },
  AGENDADA: { label: 'Agendada', className: 'text-on-surface-muted', icon: CalendarBlankIcon },
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function MaintenanceCard({ orders, className }: MaintenanceCardProps) {
  const late = orders.filter((order) => order.status === 'ATRASADA').length;

  return (
    <LightCard
      title="Manutenção"
      className={className}
      action={
        late > 0 ? (
          /* Sobre o painel claro: `error` daria 2.0:1 — ver `--color-error-on-light`. */
          <span className="bg-error-on-light text-on-primary rounded-pill text-label-md px-3 py-1 normal-case">
            {late} atrasada{late > 1 ? 's' : ''}
          </span>
        ) : null
      }
    >
      {orders.length === 0 ? (
        <p className="text-on-light-variant text-body-md">
          Nenhuma ordem de serviço aberta para este hub.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const status = STATUS[order.status];
            const StatusIcon = status.icon;

            return (
              <li key={order.id} className="bg-surface-lowest rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-on-surface truncate font-semibold">{order.service}</p>
                    <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                      <span className="tabular">{order.plate}</span> · {order.model}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'text-label-md flex shrink-0 items-center gap-1 normal-case',
                      status.className,
                    )}
                  >
                    <StatusIcon size={14} weight="fill" />
                    {status.label}
                  </span>
                </div>

                <p className="text-on-surface-muted text-label-md mt-2 normal-case">
                  {dateFormat.format(new Date(order.dueAt))} · {order.workshop}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </LightCard>
  );
}
