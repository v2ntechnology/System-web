import { ClockIcon, TruckIcon, UserIcon } from '@/components/icons';
import type { ReleaseRequest } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { dateTime } from '@/management/lib/format';

import { getReleases } from '../api';
import { ReleaseDetailPanel } from '../components/release-detail-panel';
import { SEVERITY_LABEL } from '../severity';

const TABS = [
  { id: 'PENDENTES', label: 'Na fila' },
  { id: 'TRATADAS', label: 'Tratadas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Gestão de liberações — o workflow de risco do gestor.
 *
 * Toda saída travada por checklist, telemetria ou manutenção cai aqui. A
 * severidade da maior pendência define quem decide: leve o gestor libera, média
 * exige plano de ação, grave sobe para o proprietário com o veículo bloqueado.
 *
 * A fila é ordenada por tempo de espera, não por data do pedido: o que dói é o
 * ativo parado.
 */
export function ReleasesPage() {
  const [tab, setTab] = useState<TabId>('PENDENTES');

  const { data, isPending, isError } = useQuery({
    queryKey: ['manager', 'releases'],
    queryFn: getReleases,
  });

  const all = useMemo(() => data ?? [], [data]);

  const visible = useMemo(
    () =>
      all
        .filter((item) =>
          tab === 'PENDENTES' ? item.status === 'PENDENTE' : item.status !== 'PENDENTE',
        )
        .sort((a, b) => b.waitingHours - a.waitingHours),
    [all, tab],
  );

  const releaseId = useCallback((item: ReleaseRequest) => item.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, releaseId);

  const counts = useMemo(
    () => ({
      PENDENTES: all.filter((item) => item.status === 'PENDENTE').length,
      TRATADAS: all.filter((item) => item.status !== 'PENDENTE').length,
    }),
    [all],
  );

  const pending = all.filter((item) => item.status === 'PENDENTE');
  const graves = pending.filter((item) => item.severity === 'GRAVE').length;
  const hoursStopped = pending.reduce((sum, item) => sum + item.waitingHours, 0);

  return (
    <>
      <PageBanner
        size="inline"
        title="Liberações"
        description="Autorização de saída de caminhões e motoristas — com a pendência, a severidade e a regra de quem decide."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Situação da fila</h2>

        <GlassCard className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <ClockIcon size={28} className="text-primary shrink-0" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <p className="text-on-surface text-body-lg">
              {counts.PENDENTES === 0
                ? 'Nenhum pedido na fila.'
                : counts.PENDENTES === 1
                  ? '1 pedido aguardando decisão.'
                  : `${counts.PENDENTES} pedidos aguardando decisão.`}
            </p>
            <p className="text-on-surface-variant text-body-md mt-1">
              {counts.PENDENTES === 0
                ? 'Toda decisão registrada aqui entra no histórico do veículo e do motorista.'
                : `${hoursStopped}h de ativo parado somadas${
                    graves > 0
                      ? ` · ${graves === 1 ? '1 ocorrência grave depende' : `${graves} ocorrências graves dependem`} do proprietário`
                      : ''
                  }.`}
            </p>
          </div>
        </GlassCard>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((entry) => ({ ...entry, count: counts[entry.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das liberações"
        >
          <QueryState isPending={isPending} isError={isError} label="as liberações">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,360px)_1fr]">
              <div className="min-w-0">
                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    {tab === 'PENDENTES'
                      ? 'Nada aguardando decisão.'
                      : 'Nenhuma liberação tratada ainda.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((item) => {
                      const active = item.id === selectedId;
                      const Icon = item.kind === 'VEICULO' ? TruckIcon : UserIcon;

                      return (
                        <li key={item.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            <span className="flex items-start gap-2">
                              <Icon
                                size={18}
                                aria-hidden="true"
                                className={cn(
                                  'mt-0.5 shrink-0',
                                  active ? 'text-on-primary' : 'text-primary-on-light',
                                )}
                              />
                              <span
                                className={cn(
                                  'tabular min-w-0 flex-1 font-semibold',
                                  active ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {item.subject}
                              </span>
                              <span
                                className={cn(
                                  'tabular text-label-md shrink-0 normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-variant',
                                )}
                              >
                                {item.waitingHours}h
                              </span>
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {SEVERITY_LABEL[item.severity]} ·{' '}
                              {item.blockers.length === 1
                                ? '1 pendência'
                                : `${item.blockers.length} pendências`}{' '}
                              · {dateTime.format(new Date(item.requestedAt))}
                            </span>

                            {item.tripCode ? (
                              <span
                                className={cn(
                                  'text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-variant',
                                )}
                              >
                                {item.tripCode}
                                {item.destination ? ` · ${item.destination}` : ''}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <ReleaseDetailPanel release={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione um pedido para ver as pendências e decidir.
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
