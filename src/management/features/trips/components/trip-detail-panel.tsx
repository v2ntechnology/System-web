import { ArrowRightIcon, MapPinIcon, PackageIcon, UserIcon } from '@/components/icons';
import type { Trip } from '@/management/types';
import { StatusChip, cn } from '@/management/ui';

import { TRIP_STATUS, TripStatusChip, finishedLate, isLate } from '../trip-status';
import { TRIP_STATUS_ORDER } from '@/management/mocks/trips';

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Horas restantes até o prazo (negativo = atrasada). */
function hoursToDue(trip: Trip) {
  return (new Date(trip.dueAt).getTime() - Date.now()) / 3_600_000;
}

export function TripDetailPanel({ trip }: { trip: Trip }) {
  const late = isLate(trip);
  const remaining = hoursToDue(trip);
  const reached = new Set(trip.timeline.map((event) => event.status));

  return (
    <section
      aria-label={`Detalhes da viagem ${trip.code}`}
      className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
    >
      <header className="border-outline-variant flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h3 className="tabular font-sora text-on-surface text-headline-md font-bold">
            {trip.code}
          </h3>
          <p className="text-on-surface-variant text-body-md mt-1 flex flex-wrap items-center gap-2">
            <MapPinIcon size={14} aria-hidden="true" />
            {trip.origin}
            <ArrowRightIcon size={12} aria-hidden="true" />
            {trip.destination}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <TripStatusChip status={trip.status} />
          {late ? (
            <StatusChip tone="critical">{Math.abs(Math.round(remaining))} h de atraso</StatusChip>
          ) : trip.finishedAt ? (
            <StatusChip tone={finishedLate(trip) ? 'attention' : 'positive'}>
              {finishedLate(trip) ? 'Entregue com atraso' : 'Entregue no prazo'}
            </StatusChip>
          ) : (
            <span className="tabular text-on-surface-muted text-label-md normal-case">
              faltam {Math.max(0, Math.round(remaining))} h
            </span>
          )}
        </div>
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Distância', value: `${km.format(trip.distanceKm)} km`, icon: null },
          {
            label: 'Motorista',
            value: trip.driverName,
            icon: <UserIcon size={14} />,
          },
          { label: 'Veículo', value: trip.plate, icon: null },
          { label: 'Carga', value: trip.cargo, icon: <PackageIcon size={14} /> },
        ].map((field) => (
          <div key={field.label} className="bg-on-surface/4 min-w-0 rounded-md p-3">
            <dt className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
              {field.icon}
              {field.label}
            </dt>
            <dd className="tabular text-on-surface text-body-md mt-1 truncate">{field.value}</dd>
          </div>
        ))}
      </dl>

      {/* Progresso da distância */}
      {trip.status !== 'CANCELADA' ? (
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-on-surface-variant text-body-md">Progresso da rota</span>
            <span className="tabular text-on-surface text-label-md normal-case">
              {trip.progressPercent}% ·{' '}
              {km.format(Math.round((trip.distanceKm * trip.progressPercent) / 100))} de{' '}
              {km.format(trip.distanceKm)} km
            </span>
          </div>
          <div
            role="img"
            aria-label={`${trip.progressPercent}% da rota percorrida`}
            className="bg-surface-high rounded-pill h-2 overflow-hidden"
          >
            <div
              className={cn('rounded-pill h-full', late ? 'bg-error' : 'bg-secondary')}
              style={{ width: `${trip.progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* RF-011 — máquina de estados visível, com o que já aconteceu e o que falta. */}
      <div className="mt-6">
        <h4 className="text-on-surface-variant text-body-md mb-3">Linha do tempo</h4>

        <ol className="flex flex-col">
          {(trip.status === 'CANCELADA'
            ? (['PLANEJADA', 'CANCELADA'] as const)
            : TRIP_STATUS_ORDER
          ).map((status, index, all) => {
            const event = trip.timeline.find((item) => item.status === status);
            const done = reached.has(status);
            const config = TRIP_STATUS[status];
            const Icon = config.icon;

            return (
              <li key={status} className="flex gap-3">
                <span className="flex flex-col items-center">
                  <span
                    className={cn(
                      'rounded-pill flex size-8 shrink-0 items-center justify-center',
                      done
                        ? status === 'CANCELADA'
                          ? 'bg-error/20 text-error'
                          : 'bg-secondary/20 text-secondary'
                        : 'bg-surface-high text-on-surface-muted',
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  {index < all.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn('w-px flex-1', done ? 'bg-secondary/40' : 'bg-outline-variant')}
                    />
                  ) : null}
                </span>

                <span className={cn('min-w-0 flex-1', index < all.length - 1 && 'pb-4')}>
                  <span
                    className={cn(
                      'text-body-md block',
                      done ? 'text-on-surface font-medium' : 'text-on-surface-muted',
                    )}
                  >
                    {config.label}
                  </span>
                  {event ? (
                    <>
                      <span className="tabular text-on-surface-muted text-label-md block normal-case">
                        {dateTime.format(new Date(event.at))}
                      </span>
                      {event.note ? (
                        <span className="text-on-surface-variant text-label-md mt-1 block normal-case">
                          {event.note}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-on-surface-muted text-label-md block normal-case">
                      Ainda não aconteceu
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
