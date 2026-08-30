import { ApprovalIcon, ArrowRightIcon } from '@/components/icons';
import type { AnalyticsPeriod } from '@/management/types';
import { SpectrumButton } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import heroImage from '@imgs/truck01.jpg';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';

import { env } from '@/app/environment';
import { PendingSource } from '@/management/components/layout/pending-source';
import { fetchOperations, fetchUnitPerformance } from '@/management/lib/fleet-api';

import { getOwnerSummary } from '../api';
import { UnitPerformanceCard } from '../components/unit-performance-card';
import { CostCategoriesCard } from '../components/cost-categories-card';
import { InsightsCard } from '../components/insights-card';
import { MarginTrendCard } from '../components/margin-trend-card';
import { OwnerKpiStrip } from '../components/owner-kpi-strip';
import { ResultTrendCard } from '../components/result-trend-card';

/**
 * Visão geral do proprietário — estratégica e macro.
 *
 * Deliberadamente **sem** mapa, viagem ou rota do dia: a visão do dono existe
 * para avaliar lucratividade sem distração operacional. Quem precisa do que está
 * acontecendo agora é o gestor e o operador.
 *
 * A ordem da página é a ordem da pergunta que o dono faz: quanto sobrou, por quê,
 * como está a tendência e onde o dinheiro foi gasto.
 */
export function OwnerHomePage() {
  const session = useSession();
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');

  const { data, isPending, isError } = useQuery({
    queryKey: ['owner', 'summary', period],
    queryFn: () => getOwnerSummary(period),
    enabled: env.enableMocks,
  });

  /*
   * ⚠️ O resultado financeiro do dono é 100% simulado, e não pode conviver com
   * a frota real na mesma tela.
   *
   * Receita, margem e custo por quilômetro dependem de lançamentos que não
   * existem no sistema. Mostrar uma receita inventada na tela de ENTRADA do
   * dono é a pior versão desse erro: é o número que ele mais confia e o único
   * que ninguém mediu.
   *
   * O que entra no lugar é o que a telemetria sabe de verdade, mais a
   * explicação do que falta para o resultado existir.
   */
  const operacao = useQuery({
    queryKey: ['owner', 'operacao'],
    queryFn: () => fetchOperations(30),
    enabled: !env.enableMocks,
  });

  const filiais = useQuery({
    queryKey: ['owner', 'filiais'],
    queryFn: () => fetchUnitPerformance(30),
    enabled: !env.enableMocks,
  });

  if (!env.enableMocks) {
    return (
      <>
        <PageBanner
          size="hero"
          image={heroImage}
          eyebrow="Operação nos últimos 30 dias"
          title={session?.tenant.name ?? 'Visão do proprietário'}
        />

        <PageContent>
          <h2 className="sr-only">Operação do período</h2>

          <QueryState
            isPending={operacao.isPending || filiais.isPending}
            isError={operacao.isError || filiais.isError}
            label="a operação"
          >
            {operacao.data ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {operacao.data.metrics.map((indicador) => (
                  <div key={indicador.id} className="metric-tile">
                    <p className="text-on-surface-variant text-label-md normal-case">
                      {indicador.label}
                    </p>
                    <p className="tabular font-sora text-on-surface mt-2 text-[28px] font-bold leading-none">
                      {indicador.value.toLocaleString('pt-BR')}
                      {indicador.unit ? (
                        <span className="text-on-surface-muted text-body-md font-normal">
                          {indicador.unit}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-on-surface-muted text-label-md mt-2 normal-case">
                      {indicador.hint}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {filiais.data ? (
              <UnitPerformanceCard
                units={filiais.data}
                periodLabel="últimos 30 dias"
                className="mt-5"
              />
            ) : null}

            <PendingSource
              title="O resultado financeiro ainda não pode ser calculado"
              description="Receita, margem e custo por quilômetro dependem de lançamentos que o rastreador não conhece. A telemetria entrega quilometragem, consumo em litros e tempo de motor; o preço do frete e o custo de operar vêm de fora."
              requirements={[
                'Receita: valor do frete por viagem ou por contrato',
                'Combustível: litros, preço por litro e data do abastecimento',
                'Manutenção: ordem de serviço, peças, oficina e valor',
                'Custo fixo: parcela, seguro, licenciamento e depreciação',
              ]}
              meanwhile={[
                { label: 'Comparação entre filiais', to: '/gestao' },
                { label: 'Consumo e quilometragem por veículo', to: '/gestao/caminhoes' },
                { label: 'Quem está acima do limite de jornada', to: '/gestao/motoristas' },
              ]}
            />
          </QueryState>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageBanner
        size="hero"
        image={heroImage}
        eyebrow={data ? `Resultado consolidado · ${data.periodLabel}` : null}
        title={session?.tenant.name ?? 'Visão do proprietário'}
      />

      <PageContent>
        <h2 className="sr-only">Resultado do período</h2>

        <QueryState isPending={isPending} isError={isError} label="a visão do proprietário">
          {data ? (
            <>
              <OwnerKpiStrip
                netResult={data.netResult}
                netMarginPercent={data.netMarginPercent}
                netMarginDeltaPoints={data.netMarginDeltaPoints}
                revenue={data.revenue}
                costPerKm={data.costPerKm}
                kmDriven={data.kmDriven}
                source={data.source}
                aside={
                  data.pendingApprovals > 0 ? (
                    /*
                     * A fila de aprovações mora no cabeçalho porque uma ocorrência
                     * grave mantém o caminhão parado até o dono decidir — atraso
                     * aqui custa receita, não é caixa de entrada.
                     */
                    <div className="bg-warning/10 border-warning/30 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
                      <ApprovalIcon
                        size={20}
                        className="text-warning shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-on-surface text-body-md min-w-0 flex-1">
                        {data.pendingApprovals === 1
                          ? '1 decisão aguarda sua aprovação.'
                          : `${data.pendingApprovals} decisões aguardam sua aprovação.`}
                      </p>
                      <SpectrumButton asChild size="sm">
                        <Link to="/gestao/aprovacoes">
                          Analisar
                          <ArrowRightIcon size={16} aria-hidden="true" />
                        </Link>
                      </SpectrumButton>
                    </div>
                  ) : null
                }
              />

              <div className="mt-6">
                <PeriodPicker value={period} onChange={setPeriod} />
              </div>

              {/* O resumo textual vem antes dos gráficos: é o que responde "por quê". */}
              <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
                <InsightsCard insights={data.insights} />
                <CostCategoriesCard categories={data.categories} periodLabel={data.periodLabel} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <ResultTrendCard data={data.series} />
                <MarginTrendCard data={data.series} />
              </div>
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}
