import { WarningIcon, WrenchIcon } from '@phosphor-icons/react';
import type { ServiceOrder, ServiceOrderStatus } from '@/management/types';
import { GlassCard, LightCard, StatusChip, cn, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getMaintenanceSummary } from '../api';

const TABS = [
  { id: 'ORDENS', label: 'Ordens de serviço' },
  { id: 'PLANOS', label: 'Planos preventivos' },
  { id: 'OFICINAS', label: 'Oficinas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUS: Record<ServiceOrderStatus, { label: string; tone: StatusTone }> = {
  ABERTA: { label: 'Aberta', tone: 'info' },
  EM_EXECUCAO: { label: 'Em execução', tone: 'attention' },
  CONCLUIDA: { label: 'Concluída', tone: 'positive' },
  ATRASADA: { label: 'Atrasada', tone: 'critical' },
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function MaintenancePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['maintenance'],
    queryFn: getMaintenanceSummary,
  });

  const [tab, setTab] = useState<TabId>('ORDENS');

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const orderId = useCallback((order: ServiceOrder) => order.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(orders, orderId);

  const open = orders.filter((o) => o.status !== 'CONCLUIDA').length;
  const late = orders.filter((o) => o.status === 'ATRASADA').length;
  const cost = orders.reduce((sum, o) => sum + o.cost, 0);
  const avgDowntime =
    orders.length > 0
      ? Math.round((orders.reduce((sum, o) => sum + o.downtimeHours, 0) / orders.length) * 10) / 10
      : 0;

  return (
    <>
      <PageBanner
        size="inline"
        title="Manutenção"
        description="Ordens de serviço, planos preventivos e o desempenho de cada oficina."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Resumo de manutenção</h2>

        <QueryState isPending={isPending} isError={isError} label="a manutenção">
          <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            {[
              { label: 'OS abertas', value: open },
              { label: 'Atrasadas', value: late, alert: late > 0 },
              { label: 'Custo no período', value: brl.format(cost) },
              { label: 'Parada média', value: `${avgDowntime} h` },
            ].map((metric) => (
              <div key={metric.label} className="bg-surface-lowest min-w-0 rounded-lg p-4">
                <p className="text-on-surface-variant text-label-md normal-case">{metric.label}</p>
                <p
                  className={cn(
                    'tabular font-sora mt-2 text-[28px] font-bold leading-none',
                    metric.alert ? 'text-error' : 'text-on-surface',
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </GlassCard>

          {late > 0 ? (
            <div className="bg-error/10 border-error/30 text-error mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {late === 1
                  ? '1 ordem de serviço passou do prazo — o veículo continua rodando com pendência.'
                  : `${late} ordens de serviço passaram do prazo — os veículos continuam rodando com pendência.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Seções de manutenção">
          <QueryState isPending={isPending} isError={isError} label="a manutenção">
            {data ? (
              <div className="pb-4">
                {tab === 'ORDENS' ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_1fr]">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-baseline justify-between gap-3">
                        <h2 className="font-sora text-primary text-headline-md">Ordens</h2>
                        <span className="text-on-light-muted text-label-md tabular normal-case">
                          {orders.length}
                        </span>
                      </div>

                      <ul className="flex flex-col gap-2">
                        {orders.map((order) => {
                          const active = order.id === selectedId;
                          const status = STATUS[order.status];

                          return (
                            <li key={order.id} className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedId(order.id)}
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
                                    {order.code}
                                  </span>
                                  {active ? null : (
                                    <StatusChip tone={status.tone} surface="light">
                                      {status.label}
                                    </StatusChip>
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    'text-label-md mt-1 block truncate normal-case',
                                    active ? 'text-on-primary' : 'text-on-light-muted',
                                  )}
                                >
                                  <span className="tabular">{order.plate}</span> · {order.service}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="min-w-0">
                      {selected ? (
                        <section
                          aria-label={`Detalhes da ordem ${selected.code}`}
                          className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
                        >
                          <header className="border-outline-variant flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                            <div className="min-w-0">
                              <h3 className="tabular font-sora text-on-surface text-headline-md font-bold">
                                {selected.code}
                              </h3>
                              <p className="text-on-surface-variant text-body-md mt-1">
                                {selected.service}
                              </p>
                              <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                <span className="tabular">{selected.plate}</span> · {selected.model}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <StatusChip tone={STATUS[selected.status].tone}>
                                {STATUS[selected.status].label}
                              </StatusChip>
                              <StatusChip tone="neutral">
                                {selected.type === 'PREVENTIVA' ? 'Preventiva' : 'Corretiva'}
                              </StatusChip>
                            </div>
                          </header>

                          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                            {[
                              { label: 'Oficina', value: selected.workshop },
                              {
                                label: 'Aberta em',
                                value: date.format(new Date(selected.openedAt)),
                              },
                              { label: 'Prazo', value: date.format(new Date(selected.dueAt)) },
                              { label: 'Parada', value: `${selected.downtimeHours} h` },
                            ].map((field) => (
                              <div key={field.label} className="bg-white/4 min-w-0 rounded-md p-3">
                                <dt className="text-on-surface-muted text-label-md normal-case">
                                  {field.label}
                                </dt>
                                <dd className="tabular text-on-surface text-body-md mt-1 truncate">
                                  {field.value}
                                </dd>
                              </div>
                            ))}
                          </dl>

                          <div className="mt-6">
                            <h4 className="text-on-surface-variant text-body-md mb-3">
                              Itens da ordem
                            </h4>
                            <ul className="flex flex-col gap-2">
                              {selected.items.map((item) => (
                                <li
                                  key={item.label}
                                  className="bg-white/4 flex items-center justify-between gap-3 rounded-md px-3 py-2.5"
                                >
                                  <span className="text-on-surface text-body-md">{item.label}</span>
                                  <span className="tabular text-on-surface text-body-md">
                                    {brl.format(item.cost)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <p className="border-outline-variant mt-3 flex items-center justify-between gap-3 border-t pt-3">
                              <span className="text-on-surface-variant text-body-md">Total</span>
                              <span className="tabular font-sora text-on-surface text-headline-md font-bold">
                                {brl.format(selected.cost)}
                              </span>
                            </p>
                          </div>
                        </section>
                      ) : null}
                    </div>
                  </div>
                ) : tab === 'PLANOS' ? (
                  <LightCard title="Planos preventivos">
                    <p className="text-on-light-variant text-body-md mb-5">
                      O plano dispara pela quilometragem, não pelo calendário — é o que evita
                      manutenção cedo demais em veículo parado e tarde demais em veículo que roda.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.plans.map((plan) => (
                        <li
                          key={plan.id}
                          className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-on-surface font-semibold">{plan.name}</h3>
                              <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                a cada {km.format(plan.intervalKm)} km · {plan.appliesTo}
                              </p>
                            </div>
                            <WrenchIcon
                              size={18}
                              weight="duotone"
                              className="text-on-surface-muted shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          {plan.overdueVehicles.length > 0 ? (
                            <p className="text-error text-label-md mt-3 flex items-center gap-1.5 normal-case">
                              <WarningIcon size={14} weight="fill" aria-hidden="true" />
                              Vencido em{' '}
                              <span className="tabular">{plan.overdueVehicles.join(', ')}</span>
                            </p>
                          ) : null}

                          <ul className="border-outline-variant mt-auto flex flex-col gap-1.5 border-t pt-3">
                            {plan.nextVehicles.map((vehicle) => (
                              <li
                                key={vehicle.plate}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="tabular text-on-surface-variant text-label-md normal-case">
                                  {vehicle.plate}
                                </span>
                                <span
                                  className={cn(
                                    'tabular text-label-md normal-case',
                                    vehicle.kmToService < 1000
                                      ? 'text-warning'
                                      : 'text-on-surface-muted',
                                  )}
                                >
                                  em {km.format(vehicle.kmToService)} km
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                ) : (
                  <LightCard title="Oficinas">
                    <p className="text-on-light-variant text-body-md mb-5">
                      Custo médio e tempo de parada por oficina — é o que sustenta a negociação de
                      contrato.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.workshops.map((workshop) => (
                        <li key={workshop.id} className="bg-surface-lowest rounded-lg p-4">
                          <h3 className="text-on-surface font-semibold">{workshop.name}</h3>
                          <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                            {workshop.city}
                          </p>

                          <dl className="border-outline-variant mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                            <div>
                              <dt className="text-on-surface-muted text-label-sm normal-case">
                                Ordens
                              </dt>
                              <dd className="tabular text-on-surface mt-0.5 font-semibold">
                                {workshop.ordersInPeriod}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-surface-muted text-label-sm normal-case">
                                Custo médio
                              </dt>
                              <dd className="tabular text-on-surface mt-0.5 font-semibold">
                                {brl.format(workshop.averageCost)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-surface-muted text-label-sm normal-case">
                                Parada
                              </dt>
                              <dd className="tabular text-on-surface mt-0.5 font-semibold">
                                {workshop.averageDowntimeHours} h
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
