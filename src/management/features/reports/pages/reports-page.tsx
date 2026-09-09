import {
  CalendarIcon,
  LockIcon,
  MoneyIcon,
  RouteIcon,
  SearchIcon,
  ShieldAlertIcon,
  TrendDownIcon,
  TrendUpIcon,
} from '@/components/icons';
import type { ReportCategory, ReportDefinition, AnalyticsPeriod } from '@/management/types';
import { GlassInput, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { useSession } from '@/management/features/auth/store';

import { getReportIndicators, getReports } from '../api';
import { PeriodIndicators } from '../components/period-indicators';
import { PERIOD_LABELS } from '@/management/components/layout/period-labels';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { ReportDetailPanel } from '../components/report-detail-panel';
import { ReportHistory } from '../components/report-history';
import { ReportSchedules } from '../components/report-schedules';

const TABS = [
  { id: 'CATALOGO', label: 'Catálogo' },
  { id: 'AGENDADOS', label: 'Agendados' },
  { id: 'HISTORICO', label: 'Histórico' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CATEGORIES: { id: ReportCategory | 'TODOS'; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'CUSTOS', label: 'Custos' },
  { id: 'OPERACAO', label: 'Operação' },
  { id: 'SEGURANCA', label: 'Segurança' },
  { id: 'MANUTENCAO', label: 'Manutenção' },
];

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const brlPrecise = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR');

export function ReportsPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['reports'], queryFn: getReports });
  const session = useSession();

  const [tab, setTab] = useState<TabId>('CATALOGO');
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');
  const [category, setCategory] = useState<ReportCategory | 'TODOS'>('TODOS');
  const [search, setSearch] = useState('');

  /* Mesma chave do gráfico de disponibilidade: os dois dividem o cache, e os
     números da faixa não custam uma segunda consulta. */
  const indicadores = useQuery({
    queryKey: ['report-indicators', period],
    queryFn: () => getReportIndicators(period),
  });

  const reports = useMemo(() => data ?? [], [data]);
  const contracted = session?.tenant.modules ?? [];

  /**
   * RF-002 — o plano contratado inclui o módulo?
   *
   * ⚠️ Só o estado visual. A autorização real acontece no backend, antes de o
   * relatório ser gerado (BE-14). Esconder botão não é controle de acesso.
   */
  const isLocked = (report: ReportDefinition) => !contracted.includes(report.requiredModule);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesCategory = category === 'TODOS' || report.category === category;
      const matchesTerm =
        term.length === 0 || `${report.title} ${report.description}`.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [reports, category, search]);

  const reportId = useCallback((report: ReportDefinition) => report.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, reportId);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((option) => [
          option.id,
          option.id === 'TODOS'
            ? reports.length
            : reports.filter((report) => report.category === option.id).length,
        ]),
      ) as Record<ReportCategory | 'TODOS', number>,
    [reports],
  );

  /* Em custo, CAIR é bom: a semântica do indicador é invertida em relação a um
     número comum, e por isso a seta e a cor não seguem o sinal. */
  const custoCaindo = (indicadores.data?.costDelta ?? 0) < 0;
  const SetaDoCusto = custoCaindo ? TrendDownIcon : TrendUpIcon;

  const stats: HeroStat[] = indicadores.data
    ? [
        {
          key: 'custo-km',
          label: 'Custo por km',
          value: brlPrecise.format(indicadores.data.costPerKm),
          hint: `${indicadores.data.costDelta > 0 ? '+' : ''}${indicadores.data.costDelta.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}% contra o período anterior`,
          icon: SetaDoCusto,
          tone: custoCaindo ? 'neutral' : 'warn',
        },
        {
          key: 'viagens',
          label: 'Viagens concluídas',
          value: numero.format(indicadores.data.tripsCompleted),
          hint: 'no período escolhido',
          icon: RouteIcon,
        },
        {
          key: 'eventos',
          label: 'Eventos críticos',
          value: numero.format(indicadores.data.criticalEvents),
          hint: 'somados no período',
          icon: ShieldAlertIcon,
          tone: indicadores.data.criticalEvents > 0 ? 'warn' : 'neutral',
        },
        {
          key: 'manutencao',
          label: 'Gasto com manutenção',
          value: brl.format(indicadores.data.maintenanceCost),
          hint: 'peças e serviço somados',
          icon: MoneyIcon,
        },
      ]
    : [];

  return (
    <>
      <HeroBand
        title="Relatórios"
        description="Exporte os números da operação com a memória de cálculo junto, para auditoria, contabilidade ou negociação com fornecedor."
      >
        <HeroPill icon={CalendarIcon}>{PERIOD_LABELS[period]}</HeroPill>
      </HeroBand>

      {/* -------------------------------------------------------------------
       * Números do período mordendo a faixa, seletor e disponibilidade
       * ----------------------------------------------------------------- */}
      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Indicadores do período</h2>

        <QueryState
          isPending={indicadores.isPending}
          isError={indicadores.isError}
          label="os indicadores do período"
        >
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela jogaria o carregando e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
        </QueryState>

        {/* ⚠️ O seletor vem ANTES do gráfico e depois dos números: ele governa
            os dois, e um controle escondido no fim da seção faz o gráfico
            parecer fixo. */}
        <div className="mt-6">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>

        <div className="mt-5">
          <PeriodIndicators period={period} />
        </div>
      </section>

      {/* -------------------------------------------------------------------
       * Painel claro: abas flutuantes
       * ----------------------------------------------------------------- */}
      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Seções de relatórios">
          {tab === 'CATALOGO' ? (
            <QueryState isPending={isPending} isError={isError} label="os relatórios">
              <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                {/* ⚠️ Mesmo segmentado das viagens e das notificações: poço em
                    pílula com a pastilha clara subindo quando escolhida. */}
                <div
                  role="group"
                  aria-label="Filtrar por categoria"
                  className="bg-light-container rounded-pill flex w-fit max-w-full gap-1 overflow-x-auto p-1.5"
                >
                  {CATEGORIES.map((option) => {
                    const active = category === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCategory(option.id)}
                        className={cn(
                          'group text-body-md rounded-pill focus-visible:ring-primary shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active
                            ? 'bg-light text-accent font-medium shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)]'
                            : 'text-on-light-variant hover:bg-on-light/[0.06] hover:text-on-light',
                        )}
                      >
                        {option.label}
                        <span className={cn('tabular ml-2 opacity-70', active && 'opacity-100')}>
                          {counts[option.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ⚠️ `GlassInput` com `surface="light"`, e não um `<input>`
                    montado à mão: é o campo do sistema, e só ele traz o foco, o
                    poço e o rótulo acessível iguais aos das outras telas. */}
                <GlassInput
                  id="report-search"
                  surface="light"
                  label="Buscar relatório"
                  hideLabel
                  placeholder="Nome do relatório"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                  className="xl:w-72"
                />
              </div>

              <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,380px)_1fr]">
                <div className="min-w-0">
                  {visible.length === 0 ? (
                    <p className="text-on-light-variant text-body-md py-10 text-center">
                      Nenhum relatório encontrado com esses filtros.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {visible.map((report) => {
                        const active = report.id === selectedId;
                        const locked = isLocked(report);

                        return (
                          <li key={report.id} className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedId(report.id)}
                              aria-current={active ? 'true' : undefined}
                              className={cn(
                                'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                                active ? 'bg-primary-strong' : 'hover:bg-light-container',
                              )}
                            >
                              <span className="flex items-start gap-2">
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 font-semibold',
                                    active ? 'text-on-primary' : 'text-on-light',
                                  )}
                                >
                                  {report.title}
                                </span>
                                {locked ? (
                                  <LockIcon
                                    size={16}
                                    aria-label="Módulo não contratado"
                                    className={cn(
                                      'mt-0.5 shrink-0',
                                      active ? 'text-on-primary' : 'text-warning-on-light',
                                    )}
                                  />
                                ) : null}
                              </span>
                              <span
                                className={cn(
                                  'text-label-md mt-0.5 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-muted',
                                )}
                              >
                                {report.formats.join(' · ')}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* `xl:sticky`: no monitor a lista rola e o relatório aberto
                    fica. `self-start` é o que dá altura ao grudado no grid. */}
                <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
                  {selected ? (
                    <ReportDetailPanel
                      report={selected}
                      period={period}
                      locked={isLocked(selected)}
                    />
                  ) : (
                    /* Tokens `light`: este bloco mora dentro do painel claro.
                       Com `surface-lowest` ele era o poço do tema, outra
                       família. */
                    <div className="bg-light-container flex min-h-72 items-center justify-center rounded-xl p-6">
                      <p className="text-on-light-muted text-body-md max-w-xs text-center text-balance">
                        Selecione um relatório para ver a prévia e exportar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </QueryState>
          ) : tab === 'AGENDADOS' ? (
            <div className="pb-4">
              <ReportSchedules />
            </div>
          ) : (
            <div className="pb-4">
              <ReportHistory />
            </div>
          )}
        </PageTabs>
      </PageContent>
    </>
  );
}
