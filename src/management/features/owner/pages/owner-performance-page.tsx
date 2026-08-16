import { InfoIcon } from '@phosphor-icons/react';
import type { AnalyticsPeriod, RankingPeriod } from '@/management/types';
import { GlassCard } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PERIOD_LABELS } from '@/management/components/layout/period-labels';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { QueryState } from '@/management/components/layout/query-state';

import { getDriverHighlights, getFleetProfitability } from '../api';
import { DriverHighlightsCard } from '../components/driver-highlights-card';
import { FleetProfitabilityCard } from '../components/fleet-profitability-card';
import { brl, brlWhole, percent } from '@/management/lib/format';

const TABS = [
  { id: 'PESSOAS', label: 'Pessoas' },
  { id: 'FROTA', label: 'Frota' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Gamificação e performance (visão do dono).
 *
 * Pessoas e ativos lado a lado porque são as duas alavancas que o dono
 * efetivamente move: premiar quem dirige melhor e decidir o que fazer com o
 * caminhão que não se paga.
 */
export function OwnerPerformancePage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('MES');
  const [tab, setTab] = useState<TabId>('PESSOAS');

  const fleet = useQuery({
    queryKey: ['owner', 'fleet-profitability', period],
    queryFn: () => getFleetProfitability(period),
  });

  const drivers = useQuery({
    queryKey: ['owner', 'driver-highlights', rankingPeriod],
    queryFn: () => getDriverHighlights(rankingPeriod),
  });

  const best = fleet.data?.[0];
  const worst = fleet.data?.[fleet.data.length - 1];

  return (
    <>
      <PageBanner
        size="inline"
        title="Desempenho"
        description="Destaques do time e rentabilidade por caminhão — quem premiar e qual ativo cobrar."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Extremos da frota no período</h2>

        <QueryState isPending={fleet.isPending} isError={fleet.isError} label="a rentabilidade">
          {best && worst ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
                <h3 className="text-on-surface-variant text-body-md">Caminhão mais rentável</h3>
                <p className="tabular font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                  {best.plate}
                </p>
                <p className="text-success text-label-md mt-3 normal-case">
                  {brlWhole.format(best.result)} de resultado · {percent(best.marginPercent)} de
                  margem
                </p>
                <p className="text-on-surface-muted text-label-md mt-auto pt-5 normal-case">
                  {best.model} · sobra {brl.format(best.result / best.kmDriven)} por km
                </p>
              </GlassCard>

              <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
                <h3 className="text-on-surface-variant text-body-md">Caminhão menos rentável</h3>
                <p className="tabular font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                  {worst.plate}
                </p>
                <p className="text-error text-label-md mt-3 normal-case">
                  {brlWhole.format(worst.result)} de resultado · {percent(worst.marginPercent)} de
                  margem
                </p>
                {/* RN-121 — o número vem com a procedência colada nele. */}
                <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                  <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Notas de frete e custo rateado · {PERIOD_LABELS[period].toLowerCase()}
                </p>
              </GlassCard>
            </div>
          ) : null}
        </QueryState>

        <div className="mt-6">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Recortes de desempenho">
          <div className="pb-4">
            {tab === 'PESSOAS' ? (
              <QueryState
                isPending={drivers.isPending}
                isError={drivers.isError}
                label="os destaques"
              >
                {drivers.data ? (
                  <DriverHighlightsCard
                    highlights={drivers.data}
                    period={rankingPeriod}
                    onPeriodChange={setRankingPeriod}
                  />
                ) : null}
              </QueryState>
            ) : (
              <QueryState
                isPending={fleet.isPending}
                isError={fleet.isError}
                label="a rentabilidade"
              >
                {fleet.data ? (
                  <FleetProfitabilityCard
                    fleet={fleet.data}
                    periodLabel={PERIOD_LABELS[period].toLowerCase()}
                  />
                ) : null}
              </QueryState>
            )}
          </div>
        </PageTabs>
      </PageContent>
    </>
  );
}
