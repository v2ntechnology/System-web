import { ArrowRightIcon, GavelIcon } from '@phosphor-icons/react';
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

import { getOwnerSummary } from '../api';
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
  });

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
                      <GavelIcon
                        size={20}
                        weight="duotone"
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
                          <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
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
