import type { Vehicle } from '@/management/types';

import truckSide from '@imgs/truckSide.png';
import { cn } from '@/management/ui';

import { VehicleStatusChip } from '../vehicle-status';

export interface VehicleListItemProps {
  vehicle: Vehicle;
  selected: boolean;
  onSelect: (vehicle: Vehicle) => void;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Item da lista de frota (Figma).
 *
 * O selecionado vira um cartão indigo. O texto dele é branco, e não escuro como
 * no Figma: `#16161A` sobre `#6366F1` dá 4.1:1 e reprova AA em texto de corpo.
 *
 * A silhueta é a mesma para todos enquanto não houver foto por veículo — quando
 * houver, ela entra no mesmo `<img>` sem mudar o layout.
 */
export function VehicleListItem({ vehicle, selected, onSelect }: VehicleListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'focus-visible:ring-primary-on-light flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
        selected ? 'bg-primary-strong' : 'hover:bg-light-container',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md',
          selected ? 'bg-white/15' : 'bg-light-container',
        )}
      >
        {/*
         * `object-contain` preserva a silhueta 3:2; a escala compensa a margem
         * transparente do PNG — o caminhão ocupa só 56% da altura do arquivo,
         * e sem isso o thumbnail vira um borrão de 24px.
         */}
        <img
          src={truckSide}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          className="h-full w-full scale-[1.35] object-contain"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'tabular block font-semibold',
            selected ? 'text-on-primary' : 'text-on-light',
          )}
        >
          {vehicle.plate}
        </span>
        <span
          title={`${vehicle.brand} ${vehicle.model} · ${vehicle.year}`}
          className={cn(
            'text-label-md block truncate normal-case',
            selected ? 'text-on-primary' : 'text-on-light-muted',
          )}
        >
          {vehicle.brand} {vehicle.model} · {vehicle.year}
        </span>
      </span>

      <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <span
          className={cn(
            'tabular text-label-md normal-case',
            selected ? 'text-on-primary' : 'text-on-light-variant',
          )}
        >
          {brl.format(vehicle.costPerKm)}/km
        </span>
        {selected ? null : <VehicleStatusChip status={vehicle.status} />}
      </span>
    </button>
  );
}
