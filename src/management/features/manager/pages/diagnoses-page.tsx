import { ArrowUpRightIcon, BadgeCheckIcon, EntryIcon, WarningIcon } from '@/components/icons';
import type { Anomaly } from '@/management/types';
import { Alert, SpectrumButton, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { dateOnly } from '@/management/lib/format';

import { getAnomalies, getDiagnoses } from '../api';
import { CATEGORY_LABEL, DiagnosisDetailPanel } from '../components/diagnosis-detail-panel';
import { SEVERITY_LABEL, SEVERITY_RAIL, SEVERITY_RANK, SEVERITY_TEXT } from '../severity';

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

  const sent = diagnoses.data?.filter((item) => item.sentToOwner).length ?? 0;

  /*
   * A anomalia que mais pesa na fila: a mais grave, e entre iguais a mais
   * antiga. É para ela que o botão do resumo leva.
   *
   * ⚠️ `filter` antes de `sort`: o `sort` ordena no lugar, e ordenar `all`
   * mexeria no cache do React Query.
   */
  const urgent = useMemo(
    () =>
      all
        .filter((item) => !item.diagnosisId)
        .sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            Date.parse(a.detectedAt) - Date.parse(b.detectedAt),
        )[0] ?? null,
    [all],
  );

  /*
   * Leva o gestor à anomalia que pesa mais, venha ele de onde vier na tela.
   *
   * Trocar de aba e selecionar no mesmo passo é seguro porque o `useMasterDetail`
   * deriva a seleção no render: ele guarda o id pedido e procura na lista já
   * refiltrada, em vez de sincronizar por efeito.
   */
  const openUrgent = () => {
    if (!urgent) return;
    setTab('ABERTAS');
    setSelectedId(urgent.id);
  };

  const stats: HeroStat[] = [
    {
      key: 'abertas',
      label: 'Sem parecer',
      value: counts.ABERTAS,
      hint: 'aguardando a sua explicação',
      icon: EntryIcon,
      tone: counts.ABERTAS > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'graves',
      label: 'Graves na fila',
      value: graves,
      hint: 'anomalia grave sobe para o proprietário',
      icon: WarningIcon,
      tone: graves > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'respondidas',
      label: 'Com parecer',
      value: counts.RESPONDIDAS,
      hint: 'já têm a causa escrita',
      icon: BadgeCheckIcon,
    },
    {
      key: 'enviados',
      label: 'Enviados ao dono',
      value: sent,
      hint: 'chegaram à visão do proprietário',
      icon: ArrowUpRightIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Pareceres"
        description="Anomalias detectadas pela plataforma e a explicação do gestor: o que o proprietário lê no lugar do número seco."
      />

      {/* A margem negativa é o que faz os cards subirem por cima da borda da
          faixa. O `pb` grande do `HeroBand` existe para isto. */}
      <section className="-mt-16 px-4 pb-8 sm:-mt-20 sm:px-6 xl:px-10">
        <h2 className="sr-only">Situação dos pareceres</h2>

        <HeroStats items={stats} />

        {/*
         * ⚠️ O resumo MUDA DE COR com a situação, como na fila de aprovações do
         * dono.
         *
         * Era um `GlassCard` neutro: "Todas as anomalias explicadas" e "3 sem
         * parecer, 1 grave" saíam no mesmo cinza, com o mesmo ícone. A frase
         * mudava e a tela não, então não dava para saber de relance se estava
         * tudo certo ou pegando fogo, que é a única pergunta que se faz ao abrir
         * uma fila.
         */}
        <Alert
          severity={graves > 0 ? 'error' : counts.ABERTAS > 0 ? 'warning' : 'success'}
          className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3"
        >
          {graves > 0 ? (
            <WarningIcon size={22} className="shrink-0" aria-hidden="true" />
          ) : counts.ABERTAS > 0 ? (
            <EntryIcon size={22} className="shrink-0" aria-hidden="true" />
          ) : (
            <BadgeCheckIcon size={22} className="shrink-0" aria-hidden="true" />
          )}

          <span className="min-w-0 flex-1">
            <span className="text-body-lg block font-semibold">
              {counts.ABERTAS === 0
                ? 'Todas as anomalias explicadas.'
                : counts.ABERTAS === 1
                  ? '1 anomalia sem parecer.'
                  : `${counts.ABERTAS} anomalias sem parecer.`}
            </span>
            <span className="text-body-md mt-1 block">
              {graves > 0
                ? `${graves === 1 ? '1 é grave e precisa' : `${graves} são graves e precisam`} subir para o proprietário.`
                : 'Sem parecer, o número chega ao dono sem a causa, e volta como cobrança.'}
            </span>
          </span>

          {/* O botão é o que faz o resumo valer o espaço ao lado dos números:
              sem ele, a frase só repetiria dois cards logo acima. */}
          {urgent ? (
            <SpectrumButton size="sm" onClick={openUrgent}>
              {graves > 0 ? 'Abrir a mais grave' : 'Abrir a primeira'}
            </SpectrumButton>
          ) : null}
        </Alert>
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
                              'focus-visible:ring-primary-on-light flex w-full gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            {/* Mesma faixa das outras filas do painel. A cor
                                repete o rótulo, nunca o substitui. */}
                            <span
                              className={cn(
                                'w-1 shrink-0 self-stretch rounded-full',
                                SEVERITY_RAIL[item.severity],
                              )}
                              aria-hidden="true"
                            />

                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 font-semibold',
                                    active ? 'text-on-primary' : 'text-on-light',
                                  )}
                                >
                                  {item.title}
                                </span>
                                {/* A detecção é quando o problema começou a
                                    contar: sai da corrente de pontos e vira
                                    dado alinhado à direita. */}
                                <span
                                  className={cn(
                                    'tabular text-label-md shrink-0 normal-case',
                                    active ? 'text-on-primary' : 'text-on-light-muted',
                                  )}
                                >
                                  {dateOnly.format(new Date(item.detectedAt))}
                                </span>
                              </span>

                              <span
                                className={cn(
                                  'text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-muted',
                                )}
                              >
                                <span
                                  className={cn(
                                    'font-medium',
                                    active ? 'text-on-primary' : SEVERITY_TEXT[item.severity],
                                  )}
                                >
                                  {SEVERITY_LABEL[item.severity]}
                                </span>{' '}
                                · {CATEGORY_LABEL[item.category]}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* `xl:sticky`: no monitor a lista rola e o parecer aberto fica.
                  `self-start` é o que dá altura ao grudado dentro do grid. */}
              <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
                {selected ? (
                  <DiagnosisDetailPanel anomaly={selected} diagnosis={selectedDiagnosis} />
                ) : (
                  /* Tokens `light`: este bloco mora dentro do painel claro.
                     Com `surface-lowest` ele era o poço do tema, outra família. */
                  <div className="bg-light-container flex min-h-72 items-center justify-center rounded-xl p-6">
                    <p className="text-on-light-muted text-body-md max-w-xs text-center text-balance">
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
