import { CameraIcon } from '@phosphor-icons/react';
import type { ChecklistFailure } from '@/management/types';
import { DataTable, LightCard, StatusChip, type Column } from '@/management/ui';

import { dateTime } from '@/management/lib/format';

import { SEVERITY_LABEL, SEVERITY_TONE } from '../severity';

export interface ChecklistFailuresCardProps {
  failures: ChecklistFailure[];
  className?: string | undefined;
}

/**
 * Itens reprovados nos checklists, na fila de tratativa do gestor.
 *
 * A coluna "Bloqueia" é a que importa: reprovação que impede a saída (RF-016)
 * vira pedido de liberação e para um caminhão; as demais entram na manutenção
 * programada. Ordenar por data esconde isso, então o bloqueio é etiqueta.
 */
export function ChecklistFailuresCard({ failures, className }: ChecklistFailuresCardProps) {
  const blocking = failures.filter((item) => item.blocking).length;

  const columns: Column<ChecklistFailure>[] = [
    {
      key: 'at',
      header: 'Quando',
      sortValue: (row) => row.at,
      cell: (row) => dateTime.format(new Date(row.at)),
    },
    {
      key: 'plate',
      header: 'Placa',
      sortValue: (row) => row.plate,
      cell: (row) => <span className="tabular font-semibold">{row.plate}</span>,
    },
    { key: 'driver', header: 'Motorista', hideOnMobile: true, sortValue: (row) => row.driverName },
    {
      key: 'item',
      header: 'Item reprovado',
      sortValue: (row) => row.item,
      cell: (row) => (
        <span className="flex items-center gap-2">
          {row.item}
          {/* RN-040 — foto anexada pelo motorista. Sem ela a tratativa é cega. */}
          {row.hasPhoto ? (
            <CameraIcon
              size={14}
              weight="fill"
              className="text-on-light-muted shrink-0"
              aria-label="Com foto"
            />
          ) : null}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severidade',
      sortValue: (row) => row.severity,
      cell: (row) => (
        <StatusChip tone={SEVERITY_TONE[row.severity]} surface="light">
          {SEVERITY_LABEL[row.severity]}
        </StatusChip>
      ),
    },
    {
      key: 'blocking',
      header: 'Bloqueia',
      align: 'right',
      sortValue: (row) => (row.blocking ? 1 : 0),
      cell: (row) =>
        row.blocking ? (
          <StatusChip tone="critical" surface="light">
            Impede a saída
          </StatusChip>
        ) : (
          <span className="text-on-light-muted">Não</span>
        ),
    },
  ];

  return (
    <LightCard
      title="Checklists reprovados"
      className={className}
      action={
        blocking > 0 ? (
          <StatusChip tone="critical" surface="light">
            {blocking === 1 ? '1 impede a saída' : `${blocking} impedem a saída`}
          </StatusChip>
        ) : (
          <StatusChip tone="positive" surface="light">
            Nenhum bloqueio ativo
          </StatusChip>
        )
      }
    >
      <DataTable
        columns={columns}
        rows={failures}
        rowKey={(row) => row.id}
        caption="Itens reprovados nos checklists do período, com severidade e bloqueio"
        emptyMessage="Nenhuma reprovação no período."
      />
    </LightCard>
  );
}
