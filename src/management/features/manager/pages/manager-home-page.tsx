import type { AnalyticsPeriod } from '@/management/types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import heroImage from '@imgs/truck01.jpg';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';

import { getManagerOverview } from '../api';
import { ChecklistFailuresCard } from '../components/checklist-failures-card';
import { EventsTrendCard } from '../components/events-trend-card';
import { OperationalMetricsCard } from '../components/operational-metrics-card';
import { ReadinessStrip } from '../components/readiness-strip';

/**
 * Painel operacional do gestor.
 *
 * Deliberadamente **sem** receita, margem ou DRE: o resultado financeiro global
 * é do dono. Aqui o assunto é a operação — o que pode sair agora, o que está
 * travado e quais eventos de risco estão subindo.
 *
 * A ordem é a da rotina: prontidão, indicadores, tendência dos eventos e a fila
 * de reprovações que vira tratativa.
 */
export function ManagerHomePage() {
  const session = useSession();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30D');

  const { data, isPending, isError } = useQuery({
    queryKey: ['manager', 'overview', period],
    queryFn: () => getManagerOverview(period),
  });

  return (
    <>
      <PageBanner
        size="hero"
        image={heroImage}
        eyebrow={data ? `Prontidão da operação · ${data.periodLabel}` : null}
        title={session?.tenant.name ?? 'Painel do gestor'}
      />

      <PageContent>
        <h2 className="sr-only">Situação da operação</h2>

        <QueryState isPending={isPending} isError={isError} label="o painel do gestor">
          {data ? (
            <>
              <ReadinessStrip
                vehiclesReady={data.vehiclesReady}
                vehiclesBlocked={data.vehiclesBlocked}
                driversReady={data.driversReady}
                driversUnavailable={data.driversUnavailable}
                pendingReleases={data.pendingReleases}
                awaitingOwner={data.awaitingOwner}
                openAnomalies={data.openAnomalies}
                source={data.source}
              />

              <div className="mt-6">
                <PeriodPicker value={period} onChange={setPeriod} />
              </div>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
                <OperationalMetricsCard metrics={data.metrics} periodLabel={data.periodLabel} />
                <EventsTrendCard data={data.trend} />
              </div>

              <div className="mt-5">
                <ChecklistFailuresCard failures={data.failures} />
              </div>
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}
