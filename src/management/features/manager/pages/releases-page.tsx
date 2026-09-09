import { ApprovalIcon, ClockIcon, InboxIcon, TruckIcon, UserIcon } from '@/components/icons';
import type { ReleaseRequest } from '@/management/types';
import { cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getReleases } from '../api';
import { ReleaseDetailPanel } from '../components/release-detail-panel';
import { LONG_WAIT_HOURS, SEVERITY_LABEL, SEVERITY_RAIL } from '../severity';

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

  const stats: HeroStat[] = [
    {
      key: 'fila',
      label: 'Na fila',
      value: counts.PENDENTES,
      hint: 'aguardando sua decisão',
      icon: InboxIcon,
      tone: counts.PENDENTES > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'parado',
      label: 'Ativo parado',
      value: `${hoursStopped} h`,
      hint: 'somadas na fila inteira',
      icon: ClockIcon,
      tone: hoursStopped > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'graves',
      label: 'Dependem do proprietário',
      value: graves,
      hint: 'ocorrência grave sai da sua alçada',
      icon: ApprovalIcon,
      tone: graves > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'tratadas',
      label: 'Tratadas',
      value: counts.TRATADAS,
      hint: 'decisões já registradas',
      icon: TruckIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Liberações"
        description="Autorização de saída de caminhão e motorista, com a pendência, a severidade e a regra de quem decide."
      />

      <section className="-mt-16 px-4 pb-8 sm:-mt-20 sm:px-6 xl:px-10">
        <h2 className="sr-only">Situação da fila</h2>
        <HeroStats items={stats} />
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
                              'focus-visible:ring-primary-on-light flex w-full gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            {/* A cor repete o rótulo de severidade, nunca o substitui. */}
                            <span
                              className={cn(
                                'w-1 shrink-0 self-stretch rounded-full',
                                SEVERITY_RAIL[item.severity],
                              )}
                              aria-hidden="true"
                            />

                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <Icon
                                  size={18}
                                  aria-hidden="true"
                                  className={cn(
                                    /* `mt-0.5` é o ajuste óptico que já estava
                                       calibrado para este ícone de 18px. */
                                    'mt-0.5 shrink-0 self-start',
                                    active ? 'text-on-primary' : 'text-primary-on-light',
                                  )}
                                />
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 font-semibold',
                                    active ? 'text-on-primary' : 'text-on-light',
                                  )}
                                >
                                  {item.subject}
                                </span>

                                {/*
                                 * A espera é o que ordena a fila, então ela tem
                                 * peso de dado e não de rodapé. Passando do
                                 * limite ela vira vermelha, o mesmo corte que o
                                 * painel aberto usa no chip "N h parado".
                                 */}
                                <span
                                  className={cn(
                                    'tabular shrink-0 font-semibold',
                                    active
                                      ? 'text-on-primary'
                                      : item.waitingHours >= LONG_WAIT_HOURS
                                        ? 'text-error-on-light'
                                        : 'text-on-light-variant',
                                  )}
                                >
                                  {item.waitingHours}h
                                </span>
                              </span>

                              {/*
                                 A linha de baixo diz duas coisas de naturezas
                                 diferentes: a severidade, que decide QUEM libera,
                                 e o tamanho do problema. A data do pedido saiu
                                 daqui: as horas de espera já dizem a idade, e a
                                 data exata está no painel, que é onde se decide.
                              */}
                              <span
                                className={cn(
                                  'text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-muted',
                                )}
                              >
                                <span
                                  className={cn(
                                    'font-medium',
                                    active ? 'text-on-primary' : 'text-on-light-variant',
                                  )}
                                >
                                  {SEVERITY_LABEL[item.severity]}
                                </span>{' '}
                                ·{' '}
                                {item.blockers.length === 1
                                  ? '1 pendência'
                                  : `${item.blockers.length} pendências`}
                              </span>

                              {/* A viagem é contexto, não risco: linha própria,
                                  senão a corrente de pontos quebra em três na
                                  coluna de 360px. */}
                              {item.tripCode ? (
                                <span
                                  className={cn(
                                    'text-label-md mt-0.5 block truncate normal-case',
                                    active ? 'text-on-primary' : 'text-on-light-muted',
                                  )}
                                >
                                  <span className="tabular">{item.tripCode}</span>
                                  {item.destination ? ` · ${item.destination}` : ''}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/*
               * ⚠️ `xl:sticky`: no monitor a fila rola e o painel de decisão fica.
               * Numa fila longa o gestor perdia o pedido aberto de vista ao
               * procurar o próximo, e `self-start` é o que dá altura ao grudado
               * dentro do grid.
               */}
              <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
                {selected ? (
                  <ReleaseDetailPanel release={selected} />
                ) : (
                  /* Tokens `light`, e não `surface`: este bloco mora dentro do
                     painel claro. Com `surface-lowest` ele era o poço do tema,
                     que é outra família e destoa do card ao lado. */
                  <div className="bg-light-container flex min-h-72 items-center justify-center rounded-xl p-6">
                    <p className="text-on-light-muted text-body-md max-w-xs text-center text-balance">
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
