import {
  AlertCircleIcon,
  MedalIcon,
  SearchIcon,
  ShieldAlertIcon,
  SteeringWheelIcon,
  WarningIcon,
} from '@/components/icons';
import type { Driver, DriverStatus } from '@/management/types';
import { GlassCard, GlassSelect } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useIncrementalList } from '@/management/hooks/use-incremental-list';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getDrivers } from '../api';
import { DriverDetailPanel } from '../components/driver-detail-panel';
import { DriverHoursCard } from '../components/driver-hours-card';
import { DriverListItem } from '../components/driver-list-item';

const TABS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'EM_VIAGEM', label: 'Em viagem' },
  { id: 'DISPONIVEL', label: 'Disponíveis' },
  { id: 'ATENCAO', label: 'Requerem atenção' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Quem precisa de olho: nota baixa, muitos eventos ou CNH perto de vencer.
 *
 * Motorista sem nota não entra por esse critério. Ausência de nota significa que
 * ele rodou pouco no período, não que dirige mal, e tratá-la como zero encheria
 * a lista de atenção com quem estava de férias.
 *
 * A CNH também é opcional: ela vem do RH, não da telemetria.
 */
function needsAttention(driver: Driver) {
  const cnhDays = driver.cnhExpiresAt
    ? (new Date(driver.cnhExpiresAt).getTime() - Date.now()) / 86_400_000
    : Number.POSITIVE_INFINITY;

  return (driver.score != null && driver.score < 88) || driver.criticalEvents >= 3 || cnhDays <= 60;
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

  const drivers = useMemo(() => data ?? [], [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = drivers.filter(
      (driver) =>
        matchesTab(driver, tab) && (term.length === 0 || driver.name.toLowerCase().includes(term)),
    );

    return [...filtered].sort((a, b) => {
      switch (sort) {
        /* Sem nota vai para o fim da lista, e não para o topo: ordenar
           `undefined` como zero colocaria quem não tem amostra como pior da
           frota. */
        case 'score':
          return (b.score ?? -1) - (a.score ?? -1);
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
  /* A média considera só quem tem nota. Contar motorista sem amostra como zero
     faria a frota parecer pior a cada contratação. */
  const scored = drivers.map((driver) => driver.score).filter((score) => score != null);
  const averageScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
      : 0;
  const totalWarnings = drivers.reduce((sum, driver) => sum + driver.criticalEvents, 0);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((option) => [option.id, drivers.filter((d) => matchesTab(d, option.id)).length]),
      ) as Record<TabId, number>,
    [drivers],
  );

  /* A coluna abre com oito motoristas e cresce ao rolar dentro da própria
     caixa: a equipe inteira empurrava a ficha do motorista para fora da tela.
     A aba entra na chave para o recorte reabrir a janela nos oito primeiros. */
  const {
    visible: naTela,
    hasMore: temMais,
    sentinelRef,
  } = useIncrementalList(visible, { resetKey: `${tab}-${visible.length}` });

  const tabsWithCounts = useMemo(
    () => TABS.map((option) => ({ ...option, count: counts[option.id] })),
    [counts],
  );

  const stats: HeroStat[] = [
    {
      key: 'ativos',
      label: 'Motoristas ativos',
      value: drivers.filter((d) => d.status !== 'AFASTADO').length,
      hint: 'no quadro, fora os afastados',
      icon: SteeringWheelIcon,
    },
    {
      /* A nota é relativa à própria frota: mede a dispersão da equipe, e não
         segurança absoluta. Ver a nota do tipo `SafetySummary`. */
      key: 'score',
      label: 'Score médio',
      value: averageScore,
      hint: 'média das notas de condução',
      icon: MedalIcon,
    },
    {
      key: 'eventos',
      label: 'Eventos críticos',
      value: totalWarnings,
      hint: 'somados no período',
      icon: ShieldAlertIcon,
      tone: totalWarnings > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'atencao',
      label: 'Requerem atenção',
      value: attentionCount,
      hint: 'score baixo, muitos eventos ou CNH vencendo',
      icon: AlertCircleIcon,
      tone: attentionCount > 0 ? 'alert' : 'neutral',
    },
  ];

  return (
    <>
      <HeroBand
        title="Motoristas"
        description="Ficha completa, score de segurança, advertências e histórico na estrada de cada motorista."
      />

      {/* -------------------------------------------------------------------
       * Resumo da equipe, pódio e jornada
       * ----------------------------------------------------------------- */}
      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Ranking e resumo da equipe</h2>

        {/* A subida fica nos cards, e não na seção: em volta do conteúdo ela
            jogaria carregamento e erro por cima da faixa colorida. */}
        <HeroStats items={stats} className="-mt-16 sm:-mt-20" />

        {attentionCount > 0 ? (
          <div className="bg-warning/10 ring-warning/30 mt-5 flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 ring-1">
            <WarningIcon size={18} className="text-warning shrink-0" aria-hidden="true" />
            <p className="text-on-surface text-body-md min-w-0 flex-1">
              {attentionCount === 1
                ? '1 motorista com score baixo, muitos eventos ou CNH próxima do vencimento.'
                : `${attentionCount} motoristas com score baixo, muitos eventos ou CNH próxima do vencimento.`}
            </p>
          </div>
        ) : null}

        {/* Jornada logo abaixo do resumo: é a informação com prazo. Score e
            ranking podem esperar a tarde; um motorista em 5h30 precisa parar
            agora, e quem abre esta tela é quem faz essa ligação. */}
        <GlassCard className="mt-5 p-5 sm:p-6">
          <DriverHoursCard />
        </GlassCard>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Texto solto, e não `<label>`: o rótulo acessível já vem do próprio
              campo, e dois rótulos para o mesmo controle são lidos em dobro. */}
          <span aria-hidden="true" className="text-on-surface-variant text-body-md">
            Ordenar por
          </span>
          <GlassSelect
            id="driver-sort"
            label="Ordenar por"
            hideLabel
            variant="outline"
            pill
            className="w-auto min-w-44"
            value={sort}
            onValueChange={(next) => setSort(next as Sort)}
            options={SORTS.map((option) => ({ value: option.id, label: option.label }))}
          />

          <div className="border-outline-variant bg-surface-lowest rounded-pill focus-within:border-secondary flex min-w-0 basis-full items-center gap-2 border px-4 sm:max-w-72 sm:flex-1 sm:basis-auto">
            <SearchIcon size={18} className="text-on-surface-muted shrink-0" aria-hidden="true" />
            <label htmlFor="driver-search" className="sr-only">
              Buscar motorista pelo nome
            </label>
            <input
              id="driver-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome do motorista"
              className="text-body-md text-on-surface placeholder:text-placeholder h-11 w-full bg-transparent focus:outline-none"
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
                  {/* Enquanto a janela não corta nada, o contador é o de sempre
                      (quantos o filtro deixou passar, de quantos existem).
                      Quando corta, ele passa a contar o que está na caixa. */}
                  <span className="text-on-light-muted text-label-md tabular normal-case">
                    {naTela.length === visible.length
                      ? `${visible.length} de ${drivers.length}`
                      : `${naTela.length} de ${visible.length}`}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhum motorista encontrado com esses filtros.
                  </p>
                ) : (
                  /* Caixa da altura de oito motoristas, com rolagem própria: a
                     lista inteira empurrava a ficha para fora da primeira tela,
                     e rolar a página para ver o nono tirava a ficha do campo de
                     visão. A barra de rolagem não aparece, por decisão de
                     19/08/2026. */
                  <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto">
                    {naTela.map((driver) => (
                      <li key={driver.id} className="min-w-0">
                        <DriverListItem
                          driver={driver}
                          selected={driver.id === selectedId}
                          onSelect={(next) => setSelectedId(next.id)}
                        />
                      </li>
                    ))}

                    {/* Sentinela: entrar na tela é o que carrega o próximo
                        punhado, sem botão e sem paginação. */}
                    {temMais ? (
                      <li ref={sentinelRef} className="py-3 text-center" aria-hidden="true">
                        <span className="text-on-light-muted text-label-md normal-case">
                          Carregando mais…
                        </span>
                      </li>
                    ) : null}
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
