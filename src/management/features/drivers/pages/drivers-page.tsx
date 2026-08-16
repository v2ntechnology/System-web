import { MagnifyingGlassIcon, WarningIcon } from '@phosphor-icons/react';
import type { Driver, DriverStatus, RankingPeriod } from '@/management/types';
import { GlassCard } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getDrivers } from '../api';
import { DriverDetailPanel } from '../components/driver-detail-panel';
import { DriverListItem } from '../components/driver-list-item';
import { DriverRankingCard } from '../components/driver-ranking-card';

const TABS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'EM_VIAGEM', label: 'Em viagem' },
  { id: 'DISPONIVEL', label: 'Disponíveis' },
  { id: 'ATENCAO', label: 'Requerem atenção' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Score baixo, muitos eventos ou CNH perto de vencer — quem precisa de olho. */
function needsAttention(driver: Driver) {
  const cnhDays = (new Date(driver.cnhExpiresAt).getTime() - Date.now()) / 86_400_000;
  return driver.score < 88 || driver.criticalEvents >= 3 || cnhDays <= 60;
}

function matchesTab(driver: Driver, tab: TabId) {
  if (tab === 'TODOS') return true;
  if (tab === 'ATENCAO') return needsAttention(driver);
  return driver.status === (tab as DriverStatus);
}

type Sort = 'score' | 'events' | 'km' | 'name';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'score', label: 'Melhor score' },
  { id: 'events', label: 'Mais eventos' },
  { id: 'km', label: 'Mais km' },
  { id: 'name', label: 'Nome' },
];

export function DriversPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['drivers'], queryFn: getDrivers });

  const [tab, setTab] = useState<TabId>('TODOS');
  const [sort, setSort] = useState<Sort>('score');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<RankingPeriod>('MES');

  const drivers = useMemo(() => data ?? [], [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = drivers.filter(
      (driver) =>
        matchesTab(driver, tab) && (term.length === 0 || driver.name.toLowerCase().includes(term)),
    );

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'score':
          return b.score - a.score;
        case 'events':
          return b.criticalEvents - a.criticalEvents;
        case 'km':
          return b.kmDriven - a.kmDriven;
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR');
      }
    });
  }, [drivers, tab, sort, search]);

  const driverId = useCallback((driver: Driver) => driver.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, driverId);

  const attentionCount = drivers.filter(needsAttention).length;
  const averageScore =
    drivers.length > 0
      ? Math.round(drivers.reduce((sum, driver) => sum + driver.score, 0) / drivers.length)
      : 0;
  const totalWarnings = drivers.reduce((sum, driver) => sum + driver.criticalEvents, 0);

  /** Vindo do pódio: garante que o motorista esteja visível na lista. */
  function focusDriver(driverId: string) {
    setTab('TODOS');
    setSearch('');
    setSelectedId(driverId);
  }

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((option) => [option.id, drivers.filter((d) => matchesTab(d, option.id)).length]),
      ) as Record<TabId, number>,
    [drivers],
  );

  const tabsWithCounts = useMemo(
    () => TABS.map((option) => ({ ...option, count: counts[option.id] })),
    [counts],
  );

  return (
    <>
      <PageBanner
        size="inline"
        title="Motoristas"
        description="Ficha completa, score de segurança, advertências e histórico na estrada de cada motorista."
      />

      {/* -------------------------------------------------------------------
       * Faixa escura: pódio + resumo da equipe
       * ----------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Ranking e resumo da equipe</h2>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <GlassCard className="flex p-5 sm:p-6">
            <DriverRankingCard
              period={period}
              onPeriodChange={setPeriod}
              selectedDriverId={selectedId}
              onSelectDriver={focusDriver}
            />
          </GlassCard>

          <GlassCard className="flex flex-col p-5 sm:p-6">
            <h3 className="text-on-surface-variant text-body-md">Resumo da equipe</h3>

            <div className="mt-4 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Motoristas ativos',
                  value: drivers.filter((d) => d.status !== 'AFASTADO').length,
                },
                { label: 'Score médio', value: averageScore },
                { label: 'Eventos críticos', value: totalWarnings },
                { label: 'Requerem atenção', value: attentionCount },
              ].map((metric) => (
                <div key={metric.label} className="bg-surface-lowest rounded-lg p-4">
                  <p className="text-on-surface-variant text-label-md normal-case">
                    {metric.label}
                  </p>
                  <p className="tabular font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            {attentionCount > 0 ? (
              <p className="text-warning text-label-md mt-4 flex items-start gap-2 normal-case">
                <WarningIcon
                  size={14}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {attentionCount === 1
                  ? '1 motorista com score baixo, muitos eventos ou CNH próxima do vencimento.'
                  : `${attentionCount} motoristas com score baixo, muitos eventos ou CNH próxima do vencimento.`}
              </p>
            ) : null}
          </GlassCard>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="driver-sort" className="text-on-surface-variant text-body-md">
            Ordenar por
          </label>
          <select
            id="driver-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="border-outline-variant bg-surface-lowest text-on-surface text-body-md focus-visible:ring-secondary rounded-pill h-11 border px-4 focus-visible:outline-none focus-visible:ring-2"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="border-outline-variant bg-surface-lowest rounded-pill focus-within:border-secondary flex min-w-0 basis-full items-center gap-2 border px-4 sm:max-w-72 sm:flex-1 sm:basis-auto">
            <MagnifyingGlassIcon
              size={18}
              className="text-on-surface-muted shrink-0"
              aria-hidden="true"
            />
            <label htmlFor="driver-search" className="sr-only">
              Buscar motorista pelo nome
            </label>
            <input
              id="driver-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome do motorista"
              className="text-body-md text-on-surface placeholder:text-on-surface-muted h-11 w-full bg-transparent focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------
       * Painel claro: abas flutuantes + lista e ficha
       * ----------------------------------------------------------------- */}
      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={tabsWithCounts}
          value={tab}
          onValueChange={setTab}
          label="Situação dos motoristas"
        >
          <QueryState isPending={isPending} isError={isError} label="os motoristas">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,340px)_1fr]">
              <div className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-sora text-primary text-headline-md">Equipe</h2>
                  <span className="text-on-light-muted text-label-md tabular normal-case">
                    {visible.length} de {drivers.length}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhum motorista encontrado com esses filtros.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((driver) => (
                      <li key={driver.id} className="min-w-0">
                        <DriverListItem
                          driver={driver}
                          selected={driver.id === selectedId}
                          onSelect={(next) => setSelectedId(next.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <DriverDetailPanel driver={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione um motorista para ver a ficha completa.
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
