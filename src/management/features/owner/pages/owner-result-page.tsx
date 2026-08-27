import type { AnalyticsPeriod } from '@/management/types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';

import { env } from '@/app/environment';
import { PendingSource } from '@/management/components/layout/pending-source';

import { getIncomeStatement } from '../api';
import { CostCategoriesCard } from '../components/cost-categories-card';
import { IncomeStatementCard } from '../components/income-statement-card';
import { MarginTrendCard } from '../components/margin-trend-card';
import { OwnerKpiStrip } from '../components/owner-kpi-strip';
import { ResultTrendCard } from '../components/result-trend-card';

const TABS = [
  { id: 'DRE', label: 'DRE' },
  { id: 'CUSTOS', label: 'Custos globais' },
  { id: 'TENDENCIA', label: 'Tendência' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * DRE e custos operacionais globais (visão do dono).
 *
 * As três abas respondem perguntas diferentes sobre o mesmo período: quanto
 * sobrou (DRE), em que foi gasto (custos globais) e para onde está indo
 * (tendência). Misturar as três numa rolagem única foi o que deixou a tela de
 * custos difícil de ler.
 */
export function OwnerResultPage() {
  if (!env.enableMocks) return <ResultadoSemFonte />;
  return <ResultadoSimulado />;
}

/**
 * O resultado financeiro, enquanto não existe de onde tirá-lo.
 *
 * ⚠️ **Esta é a tela mais perigosa do painel para preencher com mock.** DRE,
 * margem e custo por quilômetro são os números que o dono usa para decidir
 * compra de caminhão, contratação e preço de frete. Um deles inventado custa
 * dinheiro de verdade, e nenhum deles tem origem: receita depende de frete
 * lançado, e custo depende de abastecimento, oficina e folha.
 *
 * A telemetria entrega quilometragem e litros consumidos, que são DOIS dos
 * insumos de um custo por quilômetro. Faltam os preços, e é isso que a tela diz.
 */
function ResultadoSemFonte() {
  return (
    <>
      <PageBanner
        size="inline"
        title="Resultado"
        description="Demonstrativo do período, custos operacionais e a tendência da margem."
      />

      <PageContent className="mt-0 sm:mt-0">
        <PendingSource
          title="O resultado do período ainda não pode ser calculado"
          description="Receita, custo e margem são os números que decidem compra de caminhão e preço de frete. Nenhum dos três sai do rastreador: ele mede o que o veículo fez, não o que a empresa recebeu nem o que pagou."
          requirements={[
            'Frete faturado por viagem, que é de onde vem a receita',
            'Abastecimento com litros e valor pago, para fechar o custo de combustível',
            'Ordem de serviço de manutenção, com peça e mão de obra',
            'Folha, pedágio, seguro, financiamento e depreciação',
          ]}
          meanwhile={[
            { label: 'Operação real dos últimos 30 dias', to: '/gestao' },
            { label: 'Desempenho e consumo por caminhão', to: '/gestao/desempenho' },
            { label: 'Onde a frota perde tempo parada', to: '/gestao/viagens' },
          ]}
        />
      </PageContent>
    </>
  );
}

function ResultadoSimulado() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');
  const [tab, setTab] = useState<TabId>('DRE');

  const { data, isPending, isError } = useQuery({
    queryKey: ['owner', 'income-statement', period],
    queryFn: () => getIncomeStatement(period),
  });

  return (
    <>
      <PageBanner
        size="inline"
        title="Resultado"
        description="Demonstrativo do período, custos operacionais globais e a tendência da margem — com a memória de cálculo junto."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Indicadores do período</h2>

        <QueryState isPending={isPending} isError={isError} label="o resultado">
          {data ? (
            <OwnerKpiStrip
              netResult={data.netResult}
              netMarginPercent={data.netMarginPercent}
              netMarginDeltaPoints={data.netMarginDeltaPoints}
              revenue={data.revenue}
              costPerKm={data.costPerKm}
              kmDriven={data.kmDriven}
              source={data.source}
            />
          ) : null}
        </QueryState>

        <div className="mt-6">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Recortes do resultado">
          <QueryState isPending={isPending} isError={isError} label="o resultado">
            {data ? (
              <div className="pb-4">
                {tab === 'DRE' ? (
                  <IncomeStatementCard statement={data} />
                ) : tab === 'CUSTOS' ? (
                  <CostCategoriesCard categories={data.categories} periodLabel={data.periodLabel} />
                ) : (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <ResultTrendCard data={data.series} />
                    <MarginTrendCard data={data.series} />
                  </div>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
