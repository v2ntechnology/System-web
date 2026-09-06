import {
  ApprovalIcon,
  CalendarIcon,
  ChartBarIcon,
  ChartIcon,
  FuelIcon,
  GaugeIcon,
  MoneyIcon,
  ParkingIcon,
  RouteIcon,
  TrendDownIcon,
  TrendUpIcon,
  WarningIcon,
  type IconType,
} from '@/components/icons';
import type { AnalyticsPeriod } from '@/management/types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { HeroPill, HeroLink } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';

import { env } from '@/app/environment';
import { PendingSource } from '@/management/components/layout/pending-source';
import { brl, brlWhole, km, percent, signedPoints } from '@/management/lib/format';
import { fetchOperations, fetchUnitPerformance } from '@/management/lib/fleet-api';

import { getOwnerSummary } from '../api';
import { UnitPerformanceCard } from '../components/unit-performance-card';
import { CostCategoriesCard } from '../components/cost-categories-card';
import { InsightsCard } from '../components/insights-card';
import { MarginTrendCard } from '../components/margin-trend-card';
import { OwnerHero } from '../components/owner-hero';
import { ResultTrendCard } from '../components/result-trend-card';

/*
 * Os ids vêm fixos do backend (`FleetQueries`), e o ícone é escolhido por eles.
 * O padrão existe porque a lista é montada lá: uma métrica nova aparece na tela
 * antes de alguém lembrar de desenhar um ícone para ela.
 */
const METRIC_ICONS: Record<string, IconType> = {
  km: RouteIcon,
  criticos: WarningIcon,
  velocidade: GaugeIcon,
  ocioso: ParkingIcon,
  consumo: FuelIcon,
};

/**
 * Visão geral do proprietário: estratégica e macro.
 *
 * Deliberadamente **sem** mapa, viagem ou rota do dia: a visão do dono existe
 * para avaliar lucratividade sem distração operacional. Quem precisa do que está
 * acontecendo agora é o gestor e o operador.
 *
 * A ordem da página é a ordem da pergunta que o dono faz: quanto sobrou, por quê,
 * como está a tendência e onde o dinheiro foi gasto.
 *
 * O cabeçalho é o mesmo par da visão geral do gestor (`HeroBand` + `HeroStats`),
 * adotado aqui em 05/09/2026 a pedido do usuário: as duas telas são a home de
 * `/gestao` e precisam ser reconhecíveis uma na outra.
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

  const empresa = session ? ` da ${session.tenant.name}` : '';

  if (!env.enableMocks) {
    const metricas: HeroStat[] = (operacao.data?.metrics ?? []).map((indicador) => ({
      key: indicador.id,
      label: indicador.label,
      value: indicador.unit
        ? `${indicador.value.toLocaleString('pt-BR')} ${indicador.unit}`
        : indicador.value.toLocaleString('pt-BR'),
      hint: indicador.hint,
      icon: METRIC_ICONS[indicador.id] ?? ChartIcon,
    }));

    return (
      <>
        <OwnerHero
          description={`Veja o que a frota${empresa} produziu nos últimos 30 dias, e o que ainda falta para o resultado financeiro existir.`}
        >
          <HeroPill icon={CalendarIcon}>Últimos 30 dias</HeroPill>
        </OwnerHero>

        <PageContent>
          <h2 className="sr-only">Operação do período</h2>

          <QueryState
            isPending={operacao.isPending || filiais.isPending}
            isError={operacao.isError || filiais.isError}
            label="a operação"
          >
            {operacao.data ? (
              /* A subida fica nos cards, e não em volta do `QueryState`: ali ela
                 jogaria o carregamento e o erro por cima da faixa colorida. */
              <HeroStats items={metricas} className="-mt-16 sm:-mt-20" />
            ) : null}

            {/* RN-121: o número vem com a procedência colada nele. */}
            {operacao.data ? (
              <p className="text-on-surface-muted text-label-sm mt-3 normal-case">
                {operacao.data.source}
              </p>
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

  /*
   * O resultado do período abre a fileira porque é o único número que o dono
   * precisa ver antes de qualquer clique, e os quatro seguintes existem para
   * explicá-lo: a margem diz se sobrou pouco ou muito, a receita e o custo por
   * km dizem de onde veio, e o km rodado é o denominador dos dois.
   */
  const indicadores: HeroStat[] = data
    ? [
        {
          key: 'resultado',
          label: data.netResult >= 0 ? 'Resultado do período' : 'Prejuízo do período',
          value: brlWhole.format(data.netResult),
          hint: 'receita menos todos os custos',
          icon: MoneyIcon,
          tone: data.netResult >= 0 ? 'neutral' : 'alert',
        },
        {
          key: 'margem',
          label: 'Margem líquida',
          value: percent(data.netMarginPercent),
          hint:
            data.netMarginDeltaPoints === 0
              ? 'estável vs. período anterior'
              : `${signedPoints(data.netMarginDeltaPoints)} vs. período anterior`,
          icon: data.netMarginDeltaPoints < 0 ? TrendDownIcon : TrendUpIcon,
        },
        {
          key: 'receita',
          label: 'Receita bruta',
          value: brlWhole.format(data.revenue),
          hint: 'fretes faturados',
          icon: ChartBarIcon,
        },
        {
          key: 'custo-km',
          label: 'Custo por km',
          value: brl.format(data.costPerKm),
          hint: 'todas as categorias da DRE',
          icon: GaugeIcon,
        },
        {
          key: 'km',
          label: 'Km rodados',
          value: km.format(data.kmDriven),
          hint: 'telemetria consolidada',
          icon: RouteIcon,
        },
      ]
    : [];

  return (
    <>
      <OwnerHero description={`Veja quanto sobrou${empresa} e o que espera uma decisão sua.`}>
        {data ? (
          <HeroPill icon={CalendarIcon}>Resultado consolidado · {data.periodLabel}</HeroPill>
        ) : null}

        {data && data.pendingApprovals > 0 ? (
          /*
           * A fila de aprovações mora no cabeçalho porque uma ocorrência grave
           * mantém o caminhão parado até o dono decidir: atraso aqui custa
           * receita, não é caixa de entrada.
           */
          <HeroLink to="/gestao/aprovacoes" icon={ApprovalIcon}>
            {data.pendingApprovals === 1
              ? '1 decisão aguarda você'
              : `${data.pendingApprovals} decisões aguardam você`}
          </HeroLink>
        ) : null}
      </OwnerHero>

      <PageContent>
        <h2 className="sr-only">Resultado do período</h2>

        <QueryState isPending={isPending} isError={isError} label="a visão do proprietário">
          {data ? (
            <>
              {/* A subida fica nos cards, e não em volta do `QueryState`: ali ela
                  jogaria o carregamento e o erro por cima da faixa colorida. */}
              <HeroStats items={indicadores} className="-mt-16 sm:-mt-20" />

              {/* RN-121: o número vem com a procedência colada nele. */}
              <p className="text-on-surface-muted text-label-sm mt-3 normal-case">{data.source}</p>

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
