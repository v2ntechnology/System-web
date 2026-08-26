import { WarningIcon } from '@/components/icons';
import type { Driver, DriverStatus } from '@/management/types';
import { Avatar, cn, type StatusTone } from '@/management/ui';

const STATUS: Record<DriverStatus, { label: string; tone: StatusTone }> = {
  EM_VIAGEM: { label: 'Em viagem', tone: 'info' },
  DISPONIVEL: { label: 'Disponível', tone: 'positive' },
  DESCANSO: { label: 'Em descanso', tone: 'neutral' },
  AFASTADO: { label: 'Afastado', tone: 'attention' },
};

export const DRIVER_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([key, value]) => [key, value.label]),
) as Record<DriverStatus, string>;

/**
 * Dias até o vencimento da CNH. Abaixo de 60 vira alerta.
 *
 * Sem data cadastrada não há alerta a dar: a CNH vem do RH, não da telemetria, e
 * tratar a ausência como vencida marcaria a frota inteira de vermelho no dia em
 * que os motoristas chegassem pela integração.
 */
function daysUntil(iso: string | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function DriverListItem({
  driver,
  selected,
  onSelect,
}: {
  driver: Driver;
  selected: boolean;
  onSelect: (driver: Driver) => void;
}) {
  const cnhDays = daysUntil(driver.cnhExpiresAt);
  const cnhExpiring = cnhDays <= 60;

  return (
    <button
      type="button"
      onClick={() => onSelect(driver)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'focus-visible:ring-primary-on-light flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
        selected ? 'bg-primary-strong' : 'hover:bg-light-container',
      )}
    >
      <Avatar src={driver.avatarUrl} name={driver.name} className="size-11" />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-semibold',
            selected ? 'text-on-primary' : 'text-on-light',
          )}
        >
          {driver.name}
        </span>
        <span
          className={cn(
            'text-label-md block truncate normal-case',
            selected ? 'text-on-primary' : 'text-on-light-muted',
          )}
        >
          {driver.currentVehiclePlate ? (
            <span className="tabular">{driver.currentVehiclePlate}</span>
          ) : (
            'Sem veículo'
          )}
          {' · '}
          {DRIVER_STATUS_LABELS[driver.status]}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {cnhExpiring ? (
          <WarningIcon
            size={16}
            aria-label={cnhDays <= 0 ? 'CNH vencida' : `CNH vence em ${cnhDays} dias`}
            className={cn(selected ? 'text-on-primary' : 'text-warning-on-light')}
          />
        ) : null}

        <span className="text-right">
          <span
            className={cn(
              'tabular block font-semibold',
              selected ? 'text-on-primary' : 'text-on-light',
            )}
          >
            {driver.score}
          </span>
          <span
            className={cn(
              'text-label-sm block normal-case',
              selected ? 'text-on-primary' : 'text-on-light-muted',
            )}
          >
            score
          </span>
        </span>
      </span>
    </button>
  );
}
