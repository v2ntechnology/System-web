import {
  ClockIcon,
  FuelIcon,
  GaugeIcon,
  InfoIcon,
  LockIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { AnalyticsPeriod, FuelingRecord, VehicleCostRow } from '@/management/types';
import {
  DataTable,
  GlassCard,
  GlassInput,
  LightCard,
  SpectrumButton,
  StatusChip,
  cn,
  type Column,
} from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CostLayersCard } from '@/management/components/charts/cost-layers-card';
import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PERIOD_LABELS } from '@/management/components/layout/period-labels';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { PendingSource } from '@/management/components/layout/pending-source';
import { QueryState } from '@/management/components/layout/query-state';
import { env } from '@/app/environment';
import { useFinancialVisibility } from '@/management/features/drivers/use-financial-visibility';

import { fetchOperations, fetchVehiclePerformance } from '@/management/lib/fleet-api';

import { getCostsSummary } from '../api';
import { FuelEfficiencyList } from '../components/fuel-efficiency-list';
import { aggregateFuel, rotuloDoTipo } from '../fuel';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const inteiro = km;
const litro = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
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
  if (!env.enableMocks) return <CustosReais />;

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

/* -------------------------------------------------------------------------- */
/* Com dado real                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A tela de Custos quando a origem é a telemetria de verdade.
 *
 * <h2>Metade medida, metade ausente, e a tela diz qual é qual</h2>
 *
 * Até 06/09/2026 esta tela era só o aviso de origem ausente, e isso estava
 * certo pela metade. O custo em REAIS de fato não tem origem: preço do diesel,
 * nota da oficina e valor da multa não são coisas que o rastreador saiba. Mas o
 * consumo em quilômetro por litro é medido pela rede CAN e existe para 30 dos
 * 35 veículos que rodam.
 *
 * A ordem na tela é deliberada: primeiro o que está medido, depois o que falta.
 * O contrário faria a pessoa fechar a página antes de ver que existe número
 * confiável ali.
 *
 * ⚠️ **A conta de consumo foi corrigida no backend no mesmo dia.** Ela dividia a
 * quilometragem rodada de toda a frota pelos litros de quem informa, e dava 14%
 * a mais do que a realidade. O detalhe está em `Backend-web/docs/PLANO_DADO_REAL.md`.
 */
function CustosReais() {
  /*
   * Trinta dias, e não o seletor de período da tela simulada.
   *
   * O seletor oferece de 30 dias a 12 meses, e a telemetria retroage no máximo
   * uma semana na carga inicial de cada cliente: oferecer "12 meses" devolveria
   * a mesma janela com outro rótulo, que é pior que não oferecer.
   */
  const JANELA = 30;

  const desempenho = useQuery({
    queryKey: ['custos', 'desempenho-veiculos', JANELA],
    queryFn: () => fetchVehiclePerformance(JANELA),
  });

  const operacao = useQuery({
    queryKey: ['custos', 'operacao', JANELA],
    queryFn: () => fetchOperations(JANELA),
  });

  const [categoria, setCategoria] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const consumoDaFrota = operacao.data?.metrics.find((m) => m.id === 'consumo')?.value;
  const motorOcioso = operacao.data?.metrics.find((m) => m.id === 'ocioso')?.value;
  const periodo = operacao.data?.periodLabel ?? 'últimos 30 dias';

  const resumo = useMemo(() => aggregateFuel(desempenho.data ?? []), [desempenho.data]);

  /* O recorte não muda a régua: a média de cada categoria continua sendo a do
     grupo INTEIRO, senão buscar uma placa faria a média virar o próprio
     veículo, e ele apareceria sempre exatamente na média. */
  const termo = busca.trim().toLocaleLowerCase('pt-BR');

  const grupos = useMemo(
    () =>
      resumo.grupos
        .filter((grupo) => categoria === null || grupo.categoria === categoria)
        .map((grupo) => ({
          ...grupo,
          itens:
            termo === ''
              ? grupo.itens
              : grupo.itens.filter(
                  (veiculo) =>
                    veiculo.plate.toLocaleLowerCase('pt-BR').includes(termo) ||
                    veiculo.model.toLocaleLowerCase('pt-BR').includes(termo),
                ),
        }))
        .filter((grupo) => grupo.itens.length > 0),
    [resumo.grupos, categoria, termo],
  );

  const filtrando = categoria !== null || termo !== '';

  const limpar = () => {
    setCategoria(null);
    setBusca('');
  };

  const stats: HeroStat[] = [
    {
      key: 'consumo',
      label: 'Consumo da frota',
      value: consumoDaFrota != null ? `${litro.format(consumoDaFrota)} km/l` : '–',
      hint: `${resumo.medidos.length} de ${resumo.medidos.length + resumo.semMedicao.length} veículos medem`,
      icon: FuelIcon,
    },
    {
      key: 'km',
      label: 'Quilômetros rodados',
      value: resumo.kmTotal > 0 ? inteiro.format(resumo.kmTotal) : '–',
      hint: 'soma dos trechos do período',
      icon: RouteIcon,
    },
    {
      /* ⚠️ Motor ligado parado é o único custo desta tela que já está medido em
         algo que vira dinheiro direto: é diesel queimado sem sair do lugar. */
      key: 'ocioso',
      label: 'Motor ligado parado',
      value: motorOcioso != null ? `${inteiro.format(motorOcioso)} h` : '–',
      hint: 'diesel queimado sem sair do lugar',
      icon: GaugeIcon,
      tone: motorOcioso != null && motorOcioso > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'sem-medicao',
      label: 'Sem medir consumo',
      value: resumo.semMedicao.length,
      hint: 'rodaram sem informar litro',
      icon: WarningIcon,
      tone: resumo.semMedicao.length > 0 ? 'alert' : 'neutral',
    },
  ];

  return (
    <>
      <HeroBand
        title="Custos"
        description="O que a telemetria mede sobre consumo, e o que ainda depende de lançamento. A comparação acontece dentro de cada categoria, porque van e caminhão não se comparam entre si."
      >
        <HeroPill icon={ClockIcon}>{periodo}</HeroPill>
      </HeroBand>

      {/*
       * ⚠️ O mesmo arranjo das outras rotas do painel (08/09/2026): faixa,
       * fileira de números FORA do painel mordendo a borda dela, e só então a
       * placa branca com o conteúdo. Antes eram um `GlassCard` solto no papel e
       * o aviso de origem embaixo, sem painel nenhum.
       */}
      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">O que a telemetria já mede</h2>

        <QueryState
          isPending={desempenho.isPending || operacao.isPending}
          isError={desempenho.isError || operacao.isError}
          label="o consumo da frota"
        >
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela jogaria o carregando e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState
          isPending={desempenho.isPending || operacao.isPending}
          isError={desempenho.isError || operacao.isError}
          label="o consumo da frota"
        >
          {resumo.medidos.length > 0 || resumo.semMedicao.length > 0 ? (
            <>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
                  Consumo por veículo
                </h2>
                {filtrando ? (
                  <SpectrumButton variant="ghost" size="sm" onClick={limpar}>
                    Limpar filtro
                  </SpectrumButton>
                ) : null}
              </div>

              {/*
                ⚠️ A ressalva vem ANTES da lista, e não depois: quem lê um ranking
                já formou opinião na primeira linha.
              */}
              <p className="text-on-light-variant text-body-md mb-4 flex items-start gap-2">
                <InfoIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                Consumo medido pela rede CAN, {periodo}, e agrupado por categoria: as vans desta
                frota fazem de 8 a 15 km/l e os compactadores de 2 a 3, então um ranking único
                premiaria as vans todo mês.
              </p>

              {/* ⚠️ `surface="light"`: o campo mora dentro do painel branco, e a
                  versão escura dele inverte a hierarquia da tela. */}
              <div className="mb-5 max-w-md">
                <GlassInput
                  id="consumo-busca"
                  surface="light"
                  label="Buscar"
                  placeholder="Placa ou modelo"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                />
              </div>

              {resumo.grupos.length > 1 ? (
                <>
                  <h3 className="text-on-light-variant text-label-md normal-case">Por categoria</h3>
                  <div className="mt-3 mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    {resumo.grupos.map((grupo) => {
                      const ativo = categoria === grupo.categoria;

                      return (
                        <button
                          key={grupo.categoria}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setCategoria(ativo ? null : grupo.categoria)}
                          className={cn(
                            'group flex min-w-0 items-center gap-2 rounded-md px-3.5 py-2.5 text-left transition-colors',
                            'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
                            ativo
                              ? 'bg-primary-strong text-on-primary'
                              : 'bg-light-container text-on-light-variant hover:bg-primary/10 hover:text-primary',
                          )}
                        >
                          <TruckIcon size={15} className="shrink-0" aria-hidden="true" />
                          <span className="text-label-md min-w-0 flex-1 truncate normal-case">
                            {rotuloDoTipo(grupo.categoria)}
                          </span>
                          <span
                            className={cn(
                              'tabular shrink-0 font-semibold transition-colors',
                              ativo ? 'text-on-primary' : 'text-accent group-hover:text-primary',
                            )}
                          >
                            {grupo.itens.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              <FuelEfficiencyList
                grupos={grupos}
                /* O aviso de quem não mede é da FROTA, e não do recorte: ele
                   explica por que a média não conta com aquelas placas. */
                semMedicao={resumo.semMedicao}
                emptyMessage="Nenhum veículo com esse recorte."
              />
            </>
          ) : (
            <p className="text-on-light-variant text-body-md py-10 text-center">
              Nenhum veículo rodou no período.
            </p>
          )}
        </QueryState>

        {/*
          O aviso continua, e continua inteiro: consumo medido não vira custo.
          Dentro do painel ele perde a moldura de cartão (cartão dentro de
          cartão) e vira o poço claro que o resto do painel já usa.
        */}
        <div className="mt-8">
          <PendingSource
            title="O custo em reais ainda não tem origem"
            description="O custo por quilômetro é o número que o dono olha, e ele depende de lançamentos que o rastreador não conhece. O consumo acima é medido; o preço do diesel, a nota da oficina e o valor da multa vêm de fora."
            requirements={[
              'Abastecimento: preço por litro, posto e data',
              'Manutenção: ordem de serviço, peças, oficina e valor',
              'Multas: infração, valor, órgão e prazo de recurso',
              'Custo fixo: parcela, seguro, licenciamento e depreciação',
            ]}
            meanwhile={[
              { label: 'Comparação entre filiais', to: '/gestao/resultado' },
              { label: 'Ficha e histórico de cada caminhão', to: '/gestao/caminhoes' },
              { label: 'Percursos e paradas reais', to: '/gestao/viagens' },
            ]}
            className="bg-light-container p-5 shadow-none ring-0 sm:p-6"
          />
        </div>
      </PageContent>
    </>
  );
}
