import { NotePencilIcon } from '@phosphor-icons/react';
import type { Anomaly } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { dateOnly } from '@/management/lib/format';

import { getAnomalies, getDiagnoses } from '../api';
import { CATEGORY_LABEL, DiagnosisDetailPanel } from '../components/diagnosis-detail-panel';
import { SEVERITY_LABEL } from '../severity';

const TABS = [
  { id: 'ABERTAS', label: 'Sem parecer' },
  { id: 'RESPONDIDAS', label: 'Com parecer' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Módulo de pareceres e diagnósticos.
 *
 * A plataforma detecta a anomalia; o gestor explica a causa **antes** de o número
 * ser sintetizado na visão do dono. É o que separa "custo fixo subiu 10%" de
 * "custo fixo subiu 10% porque o seguro foi reajustado em março".
 */
export function DiagnosesPage() {
  const [tab, setTab] = useState<TabId>('ABERTAS');

  const anomalies = useQuery({ queryKey: ['manager', 'anomalies'], queryFn: getAnomalies });
  const diagnoses = useQuery({ queryKey: ['manager', 'diagnoses'], queryFn: getDiagnoses });

  const all = useMemo(() => anomalies.data ?? [], [anomalies.data]);

  const visible = useMemo(
    () => all.filter((item) => (tab === 'ABERTAS' ? !item.diagnosisId : Boolean(item.diagnosisId))),
    [all, tab],
  );

  const anomalyId = useCallback((item: Anomaly) => item.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, anomalyId);

  const counts = useMemo(
    () => ({
      ABERTAS: all.filter((item) => !item.diagnosisId).length,
      RESPONDIDAS: all.filter((item) => Boolean(item.diagnosisId)).length,
    }),
    [all],
  );

  const graves = all.filter((item) => item.severity === 'GRAVE' && !item.diagnosisId).length;

  const selectedDiagnosis = selected
    ? diagnoses.data?.find((item) => item.anomalyId === selected.id)
    : undefined;

  return (
    <>
      <PageBanner
        size="inline"
        title="Pareceres"
        description="Anomalias detectadas pela plataforma e a explicação do gestor — o que o proprietário lê no lugar do número seco."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Situação dos pareceres</h2>

        <GlassCard className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <NotePencilIcon
            size={28}
            weight="duotone"
            className="text-primary shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p className="text-on-surface text-body-lg">
              {counts.ABERTAS === 0
                ? 'Todas as anomalias explicadas.'
                : counts.ABERTAS === 1
                  ? '1 anomalia sem parecer.'
                  : `${counts.ABERTAS} anomalias sem parecer.`}
            </p>
            <p className="text-on-surface-variant text-body-md mt-1">
              {graves > 0
                ? `${graves === 1 ? '1 é grave e precisa' : `${graves} são graves e precisam`} subir para o proprietário.`
                : 'Sem parecer, o número chega ao dono sem a causa — e volta como cobrança.'}
            </p>
          </div>
        </GlassCard>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((entry) => ({ ...entry, count: counts[entry.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das anomalias"
        >
          <QueryState
            isPending={anomalies.isPending}
            isError={anomalies.isError}
            label="as anomalias"
          >
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,360px)_1fr]">
              <div className="min-w-0">
                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    {tab === 'ABERTAS'
                      ? 'Nenhuma anomalia esperando explicação.'
                      : 'Nenhum parecer redigido ainda.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((item) => {
                      const active = item.id === selectedId;

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
                            <span
                              className={cn(
                                'block font-semibold',
                                active ? 'text-on-primary' : 'text-on-light',
                              )}
                            >
                              {item.title}
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {CATEGORY_LABEL[item.category]} · severidade{' '}
                              {SEVERITY_LABEL[item.severity].toLowerCase()} ·{' '}
                              {dateOnly.format(new Date(item.detectedAt))}
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
                  <DiagnosisDetailPanel anomaly={selected} diagnosis={selectedDiagnosis} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione uma anomalia para redigir o parecer.
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
