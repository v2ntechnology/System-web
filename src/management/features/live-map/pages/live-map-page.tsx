import { GaugeIcon, MapPinIcon, WarningIcon } from '@phosphor-icons/react';
import type { VehiclePosition } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import { VehicleStatusChip } from '@/management/features/trucks/vehicle-status';

import { getVehiclePositions } from '../api';
import { FleetMap } from '../components/fleet-map';

/** RN-140 — integração parada há mais de 30 minutos vira aviso explícito. */
const STALE_SYNC_MINUTES = 30;

const isStale = (vehicle: VehiclePosition) =>
  (Date.now() - new Date(vehicle.lastSyncAt).getTime()) / 60_000 > STALE_SYNC_MINUTES;

const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function LiveMapPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-positions'],
    queryFn: getVehiclePositions,
    /* Sem WebSocket ainda (FE-11), o polling é o que mantém a posição viva. */
    refetchInterval: 4000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const positions = useMemo(() => data ?? [], [data]);
  const moving = positions.filter((vehicle) => vehicle.speedKmh > 0).length;
  const staleCount = positions.filter(isStale).length;

  const select = useCallback((vehicleId: string) => setSelectedId(vehicleId), []);

  return (
    <>
      <PageBanner
        size="inline"
        title="Mapa ao vivo"
        description="Onde cada caminhão está agora, com velocidade e horário da última sincronização."
      />

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 sm:px-6">
        <QueryState isPending={isPending} isError={isError} label="as posições">
          {staleCount > 0 ? (
            /* RN-141 — saber que o dado é velho ANTES de decidir com base nele. */
            <div className="bg-warning/10 border-warning/30 text-warning mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {staleCount === 1
                  ? '1 veículo está há mais de 30 minutos sem sincronizar — a posição dele no mapa pode estar velha.'
                  : `${staleCount} veículos estão há mais de 30 minutos sem sincronizar — as posições deles no mapa podem estar velhas.`}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_1fr]">
            {/* Lista — funciona como fonte de informação mesmo sem o mapa. */}
            <GlassCard className="flex flex-col p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-on-surface-variant text-body-md">Frota</h2>
                <span className="tabular text-on-surface-muted text-label-md normal-case">
                  {moving} em movimento de {positions.length}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {positions.map((vehicle) => {
                  const active = vehicle.vehicleId === selectedId;
                  const stale = isStale(vehicle);

                  return (
                    <li key={vehicle.vehicleId}>
                      <button
                        type="button"
                        onClick={() => select(vehicle.vehicleId)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'focus-visible:ring-secondary w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active ? 'bg-primary-strong' : 'bg-surface-lowest hover:bg-surface-high',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'tabular font-semibold',
                              active ? 'text-on-primary' : 'text-on-surface',
                            )}
                          >
                            {vehicle.plate}
                          </span>
                          {active ? null : (
                            <VehicleStatusChip status={vehicle.status} surface="dark" />
                          )}
                        </span>

                        <span
                          className={cn(
                            'text-label-md mt-1 flex items-center gap-1.5 normal-case',
                            active ? 'text-on-primary' : 'text-on-surface-muted',
                          )}
                        >
                          <MapPinIcon size={13} weight="duotone" aria-hidden="true" />
                          <span className="truncate">{vehicle.place}</span>
                        </span>

                        <span
                          className={cn(
                            'text-label-md mt-1 flex items-center gap-3 normal-case',
                            active ? 'text-on-primary' : 'text-on-surface-muted',
                          )}
                        >
                          <span className="tabular flex items-center gap-1.5">
                            <GaugeIcon size={13} weight="duotone" aria-hidden="true" />
                            {vehicle.speedKmh} km/h
                          </span>
                          <span className={cn('tabular', stale && !active && 'text-warning')}>
                            {stale ? 'sem sinal desde ' : 'às '}
                            {time.format(new Date(vehicle.lastSyncAt))}
                          </span>
                        </span>

                        {vehicle.driverName ? (
                          <span
                            className={cn(
                              'text-label-md mt-1 block truncate normal-case',
                              active ? 'text-on-primary' : 'text-on-surface-variant',
                            )}
                          >
                            {vehicle.driverName}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>

            <FleetMap
              positions={positions}
              selectedId={selectedId}
              onSelect={select}
              className="min-h-[520px] xl:min-h-[calc(100dvh-320px)]"
            />
          </div>
        </QueryState>
      </main>
    </>
  );
}
