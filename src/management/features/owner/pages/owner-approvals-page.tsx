import { ApprovalIcon } from '@/components/icons';
import type { OwnerApproval } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getOwnerApprovals } from '../api';
import { ApprovalDetailPanel } from '../components/approval-detail-panel';
import { KIND_META, SEVERITY_LABEL } from '../components/approval-meta';
import { brlWhole, dateTime } from '@/management/lib/format';

const TABS = [
  { id: 'PENDENTES', label: 'Aguardando você' },
  { id: 'DECIDIDAS', label: 'Já decididas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Central de pareceres e aprovações do proprietário.
 *
 * É a ponta final do fluxo de risco: ocorrência leve o gestor libera, média exige
 * plano de ação dele, e **grave bloqueia o veículo até o dono aprovar
 * formalmente**. Enquanto o parecer espera aqui, o caminhão está parado — por isso
 * a fila também aparece no cabeçalho da visão geral.
 */
export function OwnerApprovalsPage() {
  const [tab, setTab] = useState<TabId>('PENDENTES');

  const { data, isPending, isError } = useQuery({
    queryKey: ['owner', 'approvals'],
    queryFn: getOwnerApprovals,
  });

  const all = useMemo(() => data ?? [], [data]);

  const visible = useMemo(
    () =>
      all.filter((item) =>
        tab === 'PENDENTES' ? item.status === 'PENDENTE' : item.status !== 'PENDENTE',
      ),
    [all, tab],
  );

  const approvalId = useCallback((item: OwnerApproval) => item.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, approvalId);

  const counts = useMemo(
    () => ({
      PENDENTES: all.filter((item) => item.status === 'PENDENTE').length,
      DECIDIDAS: all.filter((item) => item.status !== 'PENDENTE').length,
    }),
    [all],
  );

  const graves = visible.filter(
    (item) => item.severity === 'GRAVE' && item.status === 'PENDENTE',
  ).length;

  return (
    <>
      <PageBanner
        size="inline"
        title="Aprovações"
        description="Pareceres do gestor e liberações que exigem a sua decisão formal — com as evidências e o plano de ação anexados."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Situação da fila</h2>

        <GlassCard className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <ApprovalIcon size={28} className="text-primary shrink-0" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <p className="text-on-surface text-body-lg">
              {counts.PENDENTES === 0
                ? 'Nenhuma decisão pendente.'
                : counts.PENDENTES === 1
                  ? '1 decisão aguardando você.'
                  : `${counts.PENDENTES} decisões aguardando você.`}
            </p>
            <p className="text-on-surface-variant text-body-md mt-1">
              {graves > 0
                ? graves === 1
                  ? '1 delas é ocorrência grave — o veículo permanece bloqueado até a sua aprovação.'
                  : `${graves} delas são ocorrências graves — os veículos permanecem bloqueados até a sua aprovação.`
                : 'Toda decisão registrada aqui vai para o log de auditoria com o seu nome.'}
            </p>
          </div>
        </GlassCard>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((entry) => ({ ...entry, count: counts[entry.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das aprovações"
        >
          <QueryState isPending={isPending} isError={isError} label="as aprovações">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,360px)_1fr]">
              <div className="min-w-0">
                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    {tab === 'PENDENTES'
                      ? 'Nada aguardando a sua decisão.'
                      : 'Nenhuma decisão registrada ainda.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((item) => {
                      const active = item.id === selectedId;
                      const kind = KIND_META[item.kind];

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
                              <kind.icon
                                size={18}
                                aria-hidden="true"
                                className={cn(
                                  'mt-0.5 shrink-0',
                                  active ? 'text-on-primary' : 'text-primary-on-light',
                                )}
                              />
                              <span
                                className={cn(
                                  'min-w-0 flex-1 font-semibold',
                                  active ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {item.title}
                              </span>
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {SEVERITY_LABEL[item.severity]} · {item.requestedBy} ·{' '}
                              {dateTime.format(new Date(item.requestedAt))}
                            </span>

                            {item.financialImpact !== undefined ? (
                              <span
                                className={cn(
                                  'tabular text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-variant',
                                )}
                              >
                                {brlWhole.format(item.financialImpact)} de impacto
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
                  <ApprovalDetailPanel approval={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione um parecer para ver as evidências e decidir.
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
