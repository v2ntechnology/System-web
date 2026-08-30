import { InfoIcon, LockIcon, WarningIcon } from '@/components/icons';
import type { AnalyticsPeriod, FuelingRecord, VehicleCostRow } from '@/management/types';
import { DataTable, GlassCard, LightCard, StatusChip, cn, type Column } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { CostLayersCard } from '@/management/components/charts/cost-layers-card';
import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PERIOD_LABELS } from '@/management/components/layout/period-labels';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { PendingSource } from '@/management/components/layout/pending-source';
import { QueryState } from '@/management/components/layout/query-state';
import { env } from '@/app/environment';
import { useFinancialVisibility } from '@/management/features/drivers/use-financial-visibility';

import { getCostsSummary } from '../api';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

const TABS = [
  { id: 'VEICULOS', label: 'Por veículo' },
  { id: 'ABASTECIMENTOS', label: 'Abastecimentos' },
  { id: 'CAMADAS', label: 'Camadas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CostsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('6M');
  const [tab, setTab] = useState<TabId>('VEICULOS');

  const canSeeFinancials = useFinancialVisibility();

  const { data, isPending, isError } = useQuery({
    queryKey: ['costs', period],
    queryFn: () => getCostsSummary(period),
    enabled: canSeeFinancials,
  });

  /*
   * RF-007 — sem permissão financeira, a tela inteira fica bloqueada.
   * O backend nem retornaria os valores (BE-14); aqui a gente explica o porquê
   * em vez de mostrar uma página vazia.
   */
  if (!canSeeFinancials) {
    return (
      <>
        <PageBanner size="inline" title="Custos" description="Custo por quilômetro em camadas." />
        <main className="mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6 xl:px-10">
          <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
            <LockIcon size={40} className="text-warning" aria-hidden="true" />
            <h2 className="font-sora text-on-surface text-headline-md">
              Você não tem acesso aos valores financeiros
            </h2>
            <p className="text-on-surface-variant text-body-md max-w-md">
              O seu perfil não permite ver custo, faturamento ou salário. Fale com o gestor da sua
              empresa se precisar dessa visão.
            </p>
          </GlassCard>
        </main>
      </>
    );
  }

  const vehicleColumns: Column<VehicleCostRow>[] = [
    {
      key: 'plate',
      header: 'Placa',
      sortValue: (r) => r.plate,
      cell: (r) => <span className="tabular font-semibold">{r.plate}</span>,
    },
    { key: 'model', header: 'Modelo', hideOnMobile: true, sortValue: (r) => r.model },
    {
      key: 'km',
      header: 'Km rodados',
      align: 'right',
      sortValue: (r) => r.kmDriven,
      cell: (r) => km.format(r.kmDriven),
    },
    {
      key: 'fuel',
      header: 'Combustível',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.fuel,
      cell: (r) => brlCompact.format(r.fuel),
    },
    {
      key: 'maintenance',
      header: 'Manutenção',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.maintenance,
      cell: (r) => brlCompact.format(r.maintenance),
    },
    {
      key: 'fixed',
      header: 'Fixos',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.fixed,
      cell: (r) => brlCompact.format(r.fixed),
    },
    {
      key: 'costPerKm',
      header: 'Custo/km',
      align: 'right',
      sortValue: (r) => r.costPerKm,
      cell: (r) => <span className="font-semibold">{brl.format(r.costPerKm)}</span>,
    },
  ];

  const fuelingColumns: Column<FuelingRecord>[] = [
    { key: 'at', header: 'Data', sortValue: (r) => r.at, cell: (r) => date.format(new Date(r.at)) },
    {
      key: 'plate',
      header: 'Placa',
      sortValue: (r) => r.plate,
      cell: (r) => <span className="tabular">{r.plate}</span>,
    },
    { key: 'station', header: 'Posto', hideOnMobile: true, sortValue: (r) => r.station },
    {
      key: 'liters',
      header: 'Litros',
      align: 'right',
      sortValue: (r) => r.liters,
      cell: (r) => `${km.format(r.liters)} l`,
    },
    {
      key: 'price',
      header: 'Preço/l',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.pricePerLiter,
      cell: (r) => brl.format(r.pricePerLiter),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (r) => r.total,
      cell: (r) => brl.format(r.total),
    },
    {
      key: 'efficiency',
      header: 'km/l',
      align: 'right',
      sortValue: (r) => r.efficiency,
      cell: (r) =>
        r.anomaly ? (
          <StatusChip tone="attention" surface="light">
            {r.efficiency.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
          </StatusChip>
        ) : (
          r.efficiency.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
        ),
    },
  ];

  const anomalies = data?.fuelings.filter((item) => item.anomaly) ?? [];

  /*
   * Sem origem de dado, a tela explica a ausência em vez de mostrar o mock.
   *
   * O caminho de demonstração continua inteiro: com `VITE_ENABLE_MOCKS=true` a
   * tela cheia volta. O que não pode acontecer é número simulado ao lado da
   * frota verdadeira, porque quem olha não tem como saber que é enfeite.
   */
  if (!env.enableMocks) {
    return (
      <>
        <PageBanner
          size="inline"
          title="Custos"
          description="Combustível, manutenção e custos fixos separados por veículo."
        />

        <PageContent className="mt-0 sm:mt-0">
          <PendingSource
            title="Custos ainda não têm origem no sistema"
            description="O custo por quilômetro é o número que o dono olha, e ele depende de lançamentos que o rastreador não conhece. A telemetria entrega quilometragem e consumo em litros; o preço do diesel, a nota da oficina e o valor da multa vêm de fora."
            requirements={[
              'Abastecimento: litros, preço por litro, posto e data',
              'Manutenção: ordem de serviço, peças, oficina e valor',
              'Multas: infração, valor, órgão e prazo de recurso',
              'Custo fixo: parcela, seguro, licenciamento e depreciação',
            ]}
            meanwhile={[
              { label: 'Quilômetros rodados e consumo médio', to: '/gestao' },
              { label: 'Motor ligado parado, que é diesel queimado', to: '/gestao' },
              { label: 'Consumo por veículo', to: '/gestao/caminhoes' },
            ]}
          />
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageBanner
        size="inline"
        title="Custos"
        description="Combustível, manutenção e custos fixos separados por veículo — com a memória de cálculo junto."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Custos do período</h2>

        <QueryState isPending={isPending} isError={isError} label="os custos">
          {data ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
                <GlassCard className="flex flex-col p-5 sm:p-6">
                  <h3 className="text-on-surface-variant text-body-md">Custo por quilômetro</h3>
                  <p className="tabular font-sora text-on-surface mt-2 text-[44px] font-bold leading-none">
                    {brl.format(data.totalCostPerKm)}
                  </p>
                  <p
                    className={cn(
                      'text-label-md mt-3 normal-case',
                      data.deltaPercent < 0 ? 'text-success' : 'text-error',
                    )}
                  >
                    {data.deltaPercent > 0 ? '+' : ''}
                    {data.deltaPercent.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
                    <span className="text-on-surface-muted"> vs. período anterior</span>
                  </p>

                  {/* RN-121 — o número vem com a procedência colada nele. */}
                  <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                    <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {data.source} · {PERIOD_LABELS[period].toLowerCase()}
                  </p>
                </GlassCard>

                <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                  {[
                    { label: 'Combustível', value: data.fuel },
                    { label: 'Manutenção', value: data.maintenance },
                    { label: 'Custos fixos', value: data.fixed },
                  ].map((layer) => (
                    <div key={layer.label} className="metric-tile">
                      <p className="text-on-surface-variant text-label-md normal-case">
                        {layer.label}
                      </p>
                      <p className="tabular font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
                        {brlCompact.format(layer.value)}
                      </p>
                      <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">
                        {Math.round(
                          (layer.value / (data.fuel + data.maintenance + data.fixed)) * 100,
                        )}
                        % do total
                      </p>
                    </div>
                  ))}
                  <div className="metric-tile">
                    <p className="text-on-surface-variant text-label-md normal-case">Km rodados</p>
                    <p className="tabular font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
                      {km.format(data.kmDriven)}
                    </p>
                    <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">
                      {data.vehicles.length} veículos
                    </p>
                  </div>
                </GlassCard>
              </div>

              {anomalies.length > 0 ? (
                /* RF-022 — abastecimento fora do padrão é achado, não estatística. */
                <div className="bg-warning/10 border-warning/30 text-warning mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
                  <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-body-md">
                    {anomalies.length === 1
                      ? '1 abastecimento fora do padrão histórico no período.'
                      : `${anomalies.length} abastecimentos fora do padrão histórico no período.`}{' '}
                    Confira na aba Abastecimentos.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </QueryState>

        <div className="mt-6">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Recortes de custo">
          <QueryState isPending={isPending} isError={isError} label="os custos">
            {data ? (
              <div className="pb-4">
                {tab === 'VEICULOS' ? (
                  <LightCard
                    title="Custo por veículo"
                    action={
                      <span className="text-on-light-muted text-label-md normal-case">
                        {PERIOD_LABELS[period].toLowerCase()}
                      </span>
                    }
                  >
                    <DataTable
                      columns={vehicleColumns}
                      rows={data.vehicles}
                      rowKey={(row) => row.vehicleId}
                      caption="Custo por veículo, separado em combustível, manutenção e fixos"
                    />
                  </LightCard>
                ) : tab === 'ABASTECIMENTOS' ? (
                  <LightCard
                    title="Abastecimentos"
                    action={
                      anomalies.length > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {anomalies.length} fora do padrão
                        </StatusChip>
                      ) : null
                    }
                  >
                    <DataTable
                      columns={fuelingColumns}
                      rows={data.fuelings}
                      rowKey={(row) => row.id}
                      caption="Abastecimentos do período, com detecção de anomalia"
                    />

                    {anomalies.length > 0 ? (
                      <div className="mt-5">
                        <h3 className="text-on-light-variant text-body-md mb-3">
                          Por que foram marcados
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {anomalies.map((item) => (
                            <li key={item.id} className="bg-surface-lowest rounded-md p-3">
                              <p className="text-on-surface flex items-center gap-2 font-medium">
                                <WarningIcon
                                  size={14}
                                  className="text-warning"
                                  aria-hidden="true"
                                />
                                <span className="tabular">{item.plate}</span> ·{' '}
                                {date.format(new Date(item.at))}
                              </p>
                              <p className="text-on-surface-variant text-body-md mt-1">
                                {item.anomaly}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </LightCard>
                ) : (
                  <CostLayersCard
                    data={data.layers}
                    title="Camadas do custo por km"
                    periodLabel={`R$/km · ${PERIOD_LABELS[period].toLowerCase()}`}
                  />
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
