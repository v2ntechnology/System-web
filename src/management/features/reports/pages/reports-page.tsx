import { LockSimpleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import type { ReportCategory, ReportDefinition, AnalyticsPeriod } from '@/management/types';
import { cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { useSession } from '@/management/features/auth/store';

import { getReports } from '../api';
import { PeriodIndicators } from '../components/period-indicators';
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

export function ReportsPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['reports'], queryFn: getReports });
  const session = useSession();

  const [tab, setTab] = useState<TabId>('CATALOGO');
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');
  const [category, setCategory] = useState<ReportCategory | 'TODOS'>('TODOS');
  const [search, setSearch] = useState('');

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

  return (
    <>
      <PageBanner
        size="inline"
        title="Relatórios"
        description="Exporte os números da operação com a memória de cálculo junto — para auditoria, contabilidade ou negociação com fornecedor."
      />

      {/* -------------------------------------------------------------------
       * Faixa escura: indicadores do período + seletor
       * ----------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Indicadores do período</h2>
        <PeriodIndicators period={period} />

        <div className="mt-6">
          <PeriodPicker value={period} onChange={setPeriod} />
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
                <div
                  role="group"
                  aria-label="Filtrar por categoria"
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
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
                          'rounded-pill text-label-md focus-visible:ring-primary-on-light shrink-0 px-3.5 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active
                            ? 'bg-primary-strong text-on-primary'
                            : 'text-on-light-variant hover:bg-light-container border-light-outline border',
                        )}
                      >
                        {option.label}
                        <span className="tabular ml-1.5 opacity-70">{counts[option.id]}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-pill focus-within:border-primary-on-light bg-light-container border-light-outline flex min-w-0 items-center gap-2 border px-4 xl:w-72">
                  <MagnifyingGlassIcon
                    size={18}
                    className="text-on-light-muted shrink-0"
                    aria-hidden="true"
                  />
                  <label htmlFor="report-search" className="sr-only">
                    Buscar relatório
                  </label>
                  <input
                    id="report-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome do relatório"
                    className="text-body-md text-on-light placeholder:text-on-light-muted h-11 w-full bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,340px)_1fr]">
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
                                  <LockSimpleIcon
                                    size={16}
                                    weight="fill"
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

                <div className="min-w-0">
                  {selected ? (
                    <ReportDetailPanel
                      report={selected}
                      period={period}
                      locked={isLocked(selected)}
                    />
                  ) : (
                    <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                      <p className="text-on-surface-muted text-body-md text-center">
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
