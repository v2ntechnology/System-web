import { InfoIcon } from '@/components/icons';
import type { AnalyticsPeriod, RankingPeriod } from '@/management/types';
import { GlassCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PERIOD_LABELS } from '@/management/components/layout/period-labels';
import { PendingSource } from '@/management/components/layout/pending-source';
import { PeriodPicker } from '@/management/components/layout/period-picker';
import { QueryState } from '@/management/components/layout/query-state';

import { env } from '@/app/environment';
import { getDrivers } from '@/management/features/drivers/api';
import { fetchVehiclePerformance } from '@/management/lib/fleet-api';

import { getDriverHighlights, getFleetProfitability } from '../api';
import { DriverHighlightsCard } from '../components/driver-highlights-card';
import { DriverPerformanceCard } from '../components/driver-performance-card';
import { FleetProfitabilityCard } from '../components/fleet-profitability-card';
import { VehiclePerformanceCard } from '../components/vehicle-performance-card';
import { brl, brlWhole, percent } from '@/management/lib/format';

const TABS = [
  { id: 'PESSOAS', label: 'Pessoas' },
  { id: 'FROTA', label: 'Frota' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Com dado real                                                               */
/* -------------------------------------------------------------------------- */

const JANELAS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
] as const;

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Descarta o "Não informado" que a MiX devolve no lugar do modelo em branco. */
const modeloUtil = (modelo: string | undefined) =>
  !modelo || /^n[aã]o informado$/i.test(modelo.trim()) ? '' : modelo;

/**
 * Desempenho com o que a telemetria entrega.
 *
 * <h2>Rentabilidade por caminhão não existe, e não é detalhe</h2>
 *
 * ⚠️ A tela de origem abria com "caminhão mais rentável: R$ 84.310 de resultado,
 * 31% de margem". Receita por caminhão depende de frete, e custo depende de
 * abastecimento e manutenção: **nenhum dos três existe no sistema**. Era o
 * número mais confiável da tela e o único que ninguém mediu.
 *
 * O que entra no lugar responde a mesma pergunta com o que existe: quem está
 * trabalhando, quem queima combustível parado e quem dirige melhor.
 *
 * <h2>Os dois destaques</h2>
 *
 * "Mais rodou" e "mais tempo com o motor ligado parado", e não melhor e pior
 * consumo. Consumo não compara entre tipos: uma van faz 18 km/l e um caminhão
 * faz 2,6, então "pior consumo da frota" elegeria sempre o caminhão maior, que
 * pode estar indo muito bem para o que é. A comparação de consumo fica na
 * tabela, onde o tipo aparece ao lado.
 */
function DesempenhoReal() {
  const [dias, setDias] = useState<number>(30);
  const [aba, setAba] = useState<TabId>('PESSOAS');

  const veiculos = useQuery({
    queryKey: ['owner', 'veiculos-desempenho', dias],
    queryFn: () => fetchVehiclePerformance(dias),
  });

  /* O ranking de motorista já vem com nota relativa à frota, do backend. */
  const motoristas = useQuery({
    queryKey: ['owner', 'motoristas-desempenho'],
    queryFn: () => getDrivers(),
  });

  const lista = veiculos.data ?? [];
  const rodaram = lista.filter((veiculo) => (veiculo.distanceKm ?? 0) > 0);

  const maisRodou = rodaram[0];

  /* Motor ligado parado em PROPORÇÃO do tempo ao volante. Em horas absolutas o
     campeão seria sempre quem rodou mais, que é a conclusão errada. */
  const maisParado = rodaram
    .filter((veiculo) => (veiculo.drivingHours ?? 0) > 1 && veiculo.idleHours != null)
    .sort(
      (a, b) =>
        (b.idleHours ?? 0) / (b.drivingHours ?? 1) - (a.idleHours ?? 0) / (a.drivingHours ?? 1),
    )[0];

  const janela = JANELAS.find((opcao) => opcao.dias === dias)?.label ?? `${dias} dias`;

  return (
    <>
      <PageBanner
        size="inline"
        title="Desempenho"
        description="Quem está trabalhando, quem queima combustível parado e quem dirige melhor."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Extremos da frota no período</h2>

        <div role="group" aria-label="Período" className="mb-4 flex flex-wrap gap-1.5">
          {JANELAS.map((opcao) => (
            <button
              key={opcao.dias}
              type="button"
              onClick={() => setDias(opcao.dias)}
              aria-pressed={dias === opcao.dias}
              className={cn(
                'text-label-md focus-visible:ring-secondary rounded-full px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                dias === opcao.dias
                  ? 'bg-primary-strong text-on-primary'
                  : 'bg-on-surface/8 text-on-surface-variant hover:text-on-surface',
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        <QueryState isPending={veiculos.isPending} isError={veiculos.isError} label="a frota">
          <div className="grid gap-5 sm:grid-cols-2">
            <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
              <h3 className="text-on-surface-variant text-body-md">Quem mais rodou</h3>
              <p className="tabular font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                {maisRodou?.plate ?? '–'}
              </p>
              <p className="text-on-surface-variant text-label-md mt-3 normal-case">
                {maisRodou
                  ? `${numero(maisRodou.distanceKm)} km em ${maisRodou.daysUsed} ${maisRodou.daysUsed === 1 ? 'dia' : 'dias'} · ${maisRodou.journeys} percursos`
                  : 'nenhum veículo rodou no período'}
              </p>
              <p className="text-on-surface-muted text-label-md mt-auto pt-5 normal-case">
                {/* "Não informado" é o que a MiX devolve quando o modelo está em
                    branco no cadastro do cliente. Repetir isso na tela é ocupar
                    uma linha para dizer que não se sabe. */}
                {[modeloUtil(maisRodou?.model), maisRodou?.unit].filter(Boolean).join(' · ')}
              </p>
            </GlassCard>

            <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
              <h3 className="text-on-surface-variant text-body-md">
                Mais tempo com o motor ligado parado
              </h3>
              <p className="tabular font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                {maisParado?.plate ?? '–'}
              </p>
              <p className="text-warning text-label-md mt-3 normal-case">
                {maisParado
                  ? `${numero(maisParado.idleHours, 1)} h paradas contra ${numero(maisParado.drivingHours, 1)} h ao volante`
                  : 'sem tempo de motor suficiente para comparar'}
              </p>
              {/* O número vem com a procedência colada nele: é combustível
                  queimado sem sair do lugar, não é ociosidade do motorista. */}
              <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Comparado em proporção do tempo ao volante · {janela.toLowerCase()}
              </p>
            </GlassCard>
          </div>
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((opcao) => ({
            ...opcao,
            count:
              opcao.id === 'FROTA'
                ? rodaram.length
                : (motoristas.data ?? []).filter((m) => m.score != null && m.kmDriven > 0).length,
          }))}
          value={aba}
          onValueChange={setAba}
          label="Recortes de desempenho"
        >
          <div className="pb-4">
            {aba === 'PESSOAS' ? (
              <QueryState
                isPending={motoristas.isPending}
                isError={motoristas.isError}
                label="os motoristas"
              >
                <DriverPerformanceCard
                  drivers={motoristas.data ?? []}
                  periodLabel="últimos 30 dias"
                />

                <div className="mt-6">
                  <PendingSource
                    title="Premiação ainda não pode ser calculada"
                    description="A nota diz quem dirige melhor, mas o bônus depende de coisas que a telemetria não sabe: se a entrega chegou no prazo, quanto a viagem rendeu e qual é a regra de premiação da empresa."
                    requirements={[
                      'Viagem de frete com prazo acordado, para existir entrega no prazo',
                      'Regra de bônus da empresa, com o que conta e quanto vale',
                      'Integração com a folha, para o valor sair do sistema e chegar no pagamento',
                    ]}
                    meanwhile={[
                      { label: 'Ranking de condução real', to: '/gestao/desempenho' },
                      { label: 'Jornada e ficha do motorista', to: '/gestao/motoristas' },
                      { label: 'Onde a frota gera evento', to: '/gestao/seguranca' },
                    ]}
                  />
                </div>
              </QueryState>
            ) : (
              <QueryState isPending={veiculos.isPending} isError={veiculos.isError} label="a frota">
                <VehiclePerformanceCard vehicles={lista} periodLabel={janela.toLowerCase()} />

                <div className="mt-6">
                  <PendingSource
                    title="Rentabilidade por caminhão ainda não pode ser calculada"
                    description="Saber qual ativo se paga exige receita e custo por veículo. A telemetria entrega o que o caminhão fez, e não o que ele faturou nem o que consumiu de dinheiro."
                    requirements={[
                      'Frete por viagem, para haver receita atribuível ao veículo',
                      'Abastecimento lançado, com litros e valor pago',
                      'Ordem de serviço de manutenção, com peça e mão de obra',
                      'Parcela de financiamento e depreciação, quando houver',
                    ]}
                    meanwhile={[
                      { label: 'Desempenho operacional por caminhão', to: '/gestao/desempenho' },
                      { label: 'Comparação entre filiais', to: '/gestao' },
                      { label: 'Ficha e cadastro do veículo', to: '/gestao/caminhoes' },
                    ]}
                  />
                </div>
              </QueryState>
            )}
          </div>
        </PageTabs>
      </PageContent>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Com mock                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Gamificação e performance (visão do dono).
 *
 * Pessoas e ativos lado a lado porque são as duas alavancas que o dono
 * efetivamente move: premiar quem dirige melhor e decidir o que fazer com o
 * caminhão que não se paga.
 */
export function OwnerPerformancePage() {
  if (!env.enableMocks) return <DesempenhoReal />;
  return <DesempenhoSimulado />;
}

function DesempenhoSimulado() {
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
        description="Destaques do time e rentabilidade por caminhão: quem premiar e qual ativo cobrar."
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
