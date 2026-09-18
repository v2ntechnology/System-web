import { ChevronRightIcon, MaintenanceIcon, RouteIcon, WarningIcon } from '@/components/icons';
import type { FleetMaintenanceDue } from '@/management/lib/fleet-api';
import { StatusChip, cn } from '@/management/ui';
import { Link } from 'react-router';

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const ITEM_LABEL: Record<FleetMaintenanceDue['item'], string> = {
  oleo: 'Óleo',
  pneus: 'Pneus',
  freios: 'Freios',
  filtros: 'Filtros',
  bateria: 'Bateria',
  revisao: 'Revisão geral',
};

function vencimento(linha: FleetMaintenanceDue) {
  if (linha.overdue) {
    const partes = [
      linha.dueInDays != null && linha.dueInDays < 0 ? `${Math.abs(linha.dueInDays)} dias` : null,
      linha.dueInKm != null && linha.dueInKm < 0
        ? `${inteiro.format(Math.abs(linha.dueInKm))} km`
        : null,
    ].filter(Boolean);
    return partes.length ? `Vencido há ${partes.join(' ou ')}` : 'Vencido';
  }

  return [
    linha.dueInDays != null ? `em ${linha.dueInDays} dias` : null,
    linha.dueInKm != null ? `em ${inteiro.format(linha.dueInKm)} km` : null,
  ]
    .filter(Boolean)
    .join(' ou ');
}

/** A prioridade de manutenção que atravessa a frota, antes dos alertas CAN. */
export function FleetMaintenanceDueQueue({ linhas }: { linhas: FleetMaintenanceDue[] }) {
  const vencidos = linhas.filter((linha) => linha.overdue).length;

  return (
    <section aria-labelledby="vencimentos-frota">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2
            id="vencimentos-frota"
            className="font-sora text-on-light text-headline-md tracking-[-0.02em]"
          >
            Vencimentos da frota
          </h2>
          <p className="text-on-light-muted text-label-md mt-1 normal-case">
            Itens vencidos ou a até 7 dias e 1.000 km do vencimento.
          </p>
        </div>
        {vencidos > 0 ? (
          <StatusChip tone="critical" surface="light" icon={<WarningIcon size={13} />}>
            {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}
          </StatusChip>
        ) : null}
      </div>

      {linhas.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-8 text-center">
          Nenhum item vencido ou próximo do vencimento na frota.
        </p>
      ) : (
        <ol className="flex flex-col">
          {linhas.map((linha) => (
            <li
              key={`${linha.vehicleId}-${linha.item}`}
              className="border-light-outline flex items-stretch gap-4 border-b py-4 last:border-b-0"
            >
              <span
                className={cn(
                  'w-1 shrink-0 rounded-full',
                  linha.overdue ? 'bg-error' : 'bg-warning-on-light/50',
                )}
                aria-hidden="true"
              />
              <span className="bg-on-light/[0.06] text-on-light-variant mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-md sm:flex">
                <MaintenanceIcon size={18} aria-hidden="true" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/gestao/patio/${linha.plate}`}
                    className="tabular font-sora text-on-light text-body-lg rounded-sm font-bold tracking-[-0.01em] hover:underline focus-visible:outline-none focus-visible:ring-2"
                  >
                    {linha.plate}
                  </Link>
                  <StatusChip tone={linha.overdue ? 'critical' : 'attention'} surface="light">
                    {ITEM_LABEL[linha.item]}
                  </StatusChip>
                  {linha.unit ? <StatusChip surface="light">{linha.unit}</StatusChip> : null}
                </div>
                <p className="text-on-light-muted text-label-sm truncate normal-case">
                  {linha.model}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 self-center">
                <RouteIcon
                  size={14}
                  className={linha.overdue ? 'text-error' : 'text-warning-on-light'}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'tabular text-label-md font-semibold normal-case',
                    linha.overdue ? 'text-error' : 'text-warning-on-light',
                  )}
                >
                  {vencimento(linha)}
                </span>
                <ChevronRightIcon size={15} className="text-on-light-muted" aria-hidden="true" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
