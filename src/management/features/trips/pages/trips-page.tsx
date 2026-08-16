import { ArrowRightIcon, WarningIcon } from '@phosphor-icons/react';
import type { Trip } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getTrips } from '../api';
import { TripDetailPanel } from '../components/trip-detail-panel';
import { TripStatusChip, finishedLate, isLate } from '../trip-status';

const TABS = [
  { id: 'EM_CURSO', label: 'Em curso' },
  { id: 'ATRASADAS', label: 'Atrasadas' },
  { id: 'CONCLUIDAS', label: 'Concluídas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const isOpen = (trip: Trip) => trip.status !== 'CONCLUIDA' && trip.status !== 'CANCELADA';

function matchesTab(trip: Trip, tab: TabId) {
  if (tab === 'EM_CURSO') return isOpen(trip);
  if (tab === 'ATRASADAS') return isLate(trip);
  return !isOpen(trip);
}

export function TripsPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['trips'], queryFn: getTrips });
  const [tab, setTab] = useState<TabId>('EM_CURSO');

  const trips = useMemo(() => data ?? [], [data]);
  const visible = useMemo(() => trips.filter((trip) => matchesTab(trip, tab)), [trips, tab]);

  const tripId = useCallback((trip: Trip) => trip.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, tripId);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((option) => [option.id, trips.filter((t) => matchesTab(t, option.id)).length]),
      ) as Record<TabId, number>,
    [trips],
  );

  const finished = trips.filter((trip) => trip.status === 'CONCLUIDA');
  const onTime = finished.filter((trip) => !finishedLate(trip)).length;
  const onTimeRate = finished.length > 0 ? Math.round((onTime / finished.length) * 100) : 0;
  const lateCount = counts.ATRASADAS;

  return (
    <>
      <PageBanner
        size="inline"
        title="Viagens"
        description="O que está rodando agora, o que passou do prazo e o histórico do que já foi entregue."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Resumo das viagens</h2>

        <QueryState isPending={isPending} isError={isError} label="as viagens">
          <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            {[
              { label: 'Em curso', value: counts.EM_CURSO },
              { label: 'Atrasadas', value: lateCount, alert: lateCount > 0 },
              { label: 'Concluídas no período', value: finished.length },
              { label: 'Entregas no prazo', value: `${onTimeRate}%` },
            ].map((metric) => (
              <div key={metric.label} className="bg-surface-lowest min-w-0 rounded-lg p-4">
                <p className="text-on-surface-variant text-label-md normal-case">{metric.label}</p>
                <p
                  className={cn(
                    'tabular font-sora mt-2 text-[32px] font-bold leading-none',
                    metric.alert ? 'text-error' : 'text-on-surface',
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </GlassCard>

          {lateCount > 0 ? (
            <div className="bg-error/10 border-error/30 text-error mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {lateCount === 1
                  ? '1 viagem em curso já passou do prazo acordado com o cliente.'
                  : `${lateCount} viagens em curso já passaram do prazo acordado com o cliente.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((option) => ({ ...option, count: counts[option.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das viagens"
        >
          <QueryState isPending={isPending} isError={isError} label="as viagens">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,340px)_1fr]">
              <div className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-sora text-primary text-headline-md">Viagens</h2>
                  <span className="text-on-light-muted text-label-md tabular normal-case">
                    {visible.length} de {trips.length}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhuma viagem nesta situação.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((trip) => {
                      const active = trip.id === selectedId;
                      const late = isLate(trip);

                      return (
                        <li key={trip.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(trip.id)}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  'tabular font-semibold',
                                  active ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {trip.code}
                              </span>
                              {active ? null : late ? (
                                <WarningIcon
                                  size={15}
                                  weight="fill"
                                  aria-label="Atrasada"
                                  className="text-error-on-light"
                                />
                              ) : (
                                <TripStatusChip status={trip.status} surface="light" />
                              )}
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 flex flex-wrap items-center gap-1.5 normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              <span className="truncate">{trip.origin}</span>
                              <ArrowRightIcon size={11} weight="bold" aria-hidden="true" />
                              <span className="truncate">{trip.destination}</span>
                            </span>

                            <span
                              className={cn(
                                'tabular text-label-md mt-0.5 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {trip.driverName} · {km.format(trip.distanceKm)} km
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <TripDetailPanel trip={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione uma viagem para ver a rota e a linha do tempo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
