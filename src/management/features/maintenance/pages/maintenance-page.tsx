import {
  ChevronDownIcon,
  ClockIcon,
  MaintenanceIcon,
  MoneyIcon,
  SearchIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { ServiceOrderStatus } from '@/management/types';
import {
  GlassInput,
  GlassSelect,
  SpectrumButton,
  StatusChip,
  cn,
  type StatusTone,
} from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PendingSource } from '@/management/components/layout/pending-source';
import { QueryState } from '@/management/components/layout/query-state';
import { env } from '@/app/environment';

import { fetchMechanicalAlerts } from '@/management/lib/fleet-api';

import { getMaintenanceSummary } from '../api';
import { aggregateMechanicalAlerts, formatAlertDescription } from '../alerts';
import {
  MechanicalAlertsQueue,
  MechanicalKindFilters,
} from '../components/mechanical-alerts-queue';

const TABS = [
  { id: 'ORDENS', label: 'Ordens de serviço' },
  { id: 'PLANOS', label: 'Planos preventivos' },
  { id: 'OFICINAS', label: 'Oficinas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUS: Record<ServiceOrderStatus, { label: string; tone: StatusTone }> = {
  ABERTA: { label: 'Aberta', tone: 'info' },
  EM_EXECUCAO: { label: 'Em execução', tone: 'attention' },
  CONCLUIDA: { label: 'Concluída', tone: 'positive' },
  ATRASADA: { label: 'Atrasada', tone: 'critical' },
};

/**
 * Faixa vertical da linha, no desenho das outras filas do painel.
 *
 * ⚠️ Existe para o estado SOBREVIVER à seleção: o chip era escondido na linha
 * escolhida (`active ? null : <StatusChip/>`), porque o tonal não se lê sobre o
 * laranja. Abrir uma OS ATRASADA apagava justamente o motivo de ela ser urgente.
 *
 * Família de PREENCHIMENTO, nunca `-on-light`: aquela é de texto e como tinta
 * chapada vira vinho e marrom, que não se separam.
 */
const STATUS_RAIL: Record<ServiceOrderStatus, string> = {
  ABERTA: 'bg-info',
  EM_EXECUCAO: 'bg-warning',
  CONCLUIDA: 'bg-success',
  ATRASADA: 'bg-error',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const inteiro = km;

/** Valor do seletor de unidade quando nenhuma foi escolhida. */
const TODAS_UNIDADES = 'TODAS';
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function MaintenancePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['maintenance'],
    queryFn: getMaintenanceSummary,
  });

  const [tab, setTab] = useState<TabId>('ORDENS');

  const orders = useMemo(() => data?.orders ?? [], [data]);

  const open = orders.filter((o) => o.status !== 'CONCLUIDA').length;
  const late = orders.filter((o) => o.status === 'ATRASADA').length;
  const cost = orders.reduce((sum, o) => sum + o.cost, 0);
  const avgDowntime =
    orders.length > 0
      ? Math.round((orders.reduce((sum, o) => sum + o.downtimeHours, 0) / orders.length) * 10) / 10
      : 0;

  /*
   * Sem origem de dado, a tela explica a ausência em vez de mostrar o mock.
   *
   * O caminho de demonstração continua inteiro: com `VITE_ENABLE_MOCKS=true` a
   * tela cheia volta. O que não pode acontecer é número simulado ao lado da
   * frota verdadeira, porque quem olha não tem como saber que é enfeite.
   */
  if (!env.enableMocks) return <ManutencaoReal />;

  return (
    <>
      <HeroBand
        title="Manutenção"
        description="Ordens de serviço, planos preventivos e o desempenho de cada oficina."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo de manutenção</h2>

        <QueryState isPending={isPending} isError={isError} label="a manutenção">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela puxaria o carregando e o erro para dentro da faixa. */}
          <HeroStats
            className="-mt-16 sm:-mt-20"
            items={[
              {
                key: 'abertas',
                label: 'OS abertas',
                value: open,
                hint: 'aguardando execução',
                icon: MaintenanceIcon,
                tone: open > 0 ? 'warn' : 'neutral',
              },
              {
                key: 'atrasadas',
                label: 'Atrasadas',
                value: late,
                hint: 'o veículo roda com pendência',
                icon: WarningIcon,
                tone: late > 0 ? 'alert' : 'neutral',
              },
              {
                key: 'custo',
                label: 'Custo no período',
                value: brl.format(cost),
                hint: 'peças e serviço somados',
                icon: MoneyIcon,
              },
              {
                key: 'parada',
                label: 'Parada média',
                value: `${avgDowntime} h`,
                hint: 'do veículo por ordem',
                icon: ClockIcon,
              },
            ]}
          />

          {late > 0 ? (
            <div className="bg-error/10 border-error/30 text-error mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {late === 1
                  ? '1 ordem de serviço passou do prazo — o veículo continua rodando com pendência.'
                  : `${late} ordens de serviço passaram do prazo — os veículos continuam rodando com pendência.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Seções de manutenção">
          <QueryState isPending={isPending} isError={isError} label="a manutenção">
            {data ? (
              <div className="pb-4">
                {tab === 'ORDENS' ? (
                  <section>
                    {/*
                     * ⚠️ FILA ÚNICA, no desenho de `/gestao/impedimentos` (decisão
                     * do usuário em 08/09/2026), e não mais lista estreita com
                     * painel de detalhe ao lado.
                     *
                     * A ordem de serviço não pede master-detail: ela tem meia dúzia
                     * de fatos, e todos cabem na própria linha. O que sobrava para o
                     * painel era a quebra de itens, que virou uma revelação dentro
                     * da linha. Em troca, o código, a oficina e o prazo deixam de
                     * viver numa coluna de 340px espremida.
                     */}
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-sora text-on-light text-headline-md">Ordens</h2>
                      <span className="text-on-light-muted text-label-md tabular normal-case">
                        {orders.length} {orders.length === 1 ? 'ordem' : 'ordens'}
                      </span>
                    </div>

                    {orders.length === 0 ? (
                      <p className="text-on-light-variant text-body-md py-10 text-center">
                        Nenhuma ordem de serviço no período.
                      </p>
                    ) : (
                      <ol className="flex flex-col">
                        {orders.map((order) => {
                          const status = STATUS[order.status];

                          return (
                            <li
                              key={order.id}
                              className="border-light-outline flex items-stretch gap-4 border-b py-4 last:border-b-0"
                            >
                              {/* A cor repete o rótulo, nunca o substitui. */}
                              <span
                                className={cn(
                                  'w-1 shrink-0 rounded-full',
                                  STATUS_RAIL[order.status],
                                )}
                                aria-hidden="true"
                              />

                              <span className="bg-on-light/[0.06] text-on-light-variant mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-md sm:flex">
                                <MaintenanceIcon size={18} aria-hidden="true" />
                              </span>

                              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="tabular font-sora text-on-light text-body-lg font-bold tracking-[-0.01em]">
                                    {order.code}
                                  </span>
                                  <StatusChip tone={status.tone} surface="light">
                                    {status.label}
                                  </StatusChip>
                                  <StatusChip surface="light">
                                    {order.type === 'PREVENTIVA' ? 'Preventiva' : 'Corretiva'}
                                  </StatusChip>
                                </div>

                                <p className="text-on-light-variant text-body-md">
                                  {order.service}
                                </p>

                                <p className="text-on-light-muted text-label-sm normal-case">
                                  <span className="tabular">{order.plate}</span> · {order.model} ·{' '}
                                  {order.workshop} · prazo em{' '}
                                  <span className="tabular">
                                    {date.format(new Date(order.dueAt))}
                                  </span>
                                </p>

                                {/* ⚠️ `<details>` nativo: a quebra de itens é o único
                                    fato que não cabe na linha, e ela não justifica
                                    estado em React nem uma segunda coluna. */}
                                {order.items.length > 0 ? (
                                  <details className="group mt-1">
                                    <summary className="text-accent text-label-md focus-visible:ring-primary inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md normal-case hover:underline focus-visible:outline-none focus-visible:ring-2">
                                      <ChevronDownIcon
                                        size={14}
                                        aria-hidden="true"
                                        className="transition-transform group-open:rotate-180"
                                      />
                                      {order.items.length}{' '}
                                      {order.items.length === 1 ? 'item' : 'itens'}
                                    </summary>

                                    <ul className="mt-2 flex flex-col gap-1.5">
                                      {order.items.map((item) => (
                                        <li
                                          key={item.label}
                                          className="bg-light-container flex items-center justify-between gap-3 rounded-md px-3 py-2"
                                        >
                                          <span className="text-on-light text-label-md normal-case">
                                            {item.label}
                                          </span>
                                          <span className="tabular text-on-light text-label-md shrink-0 normal-case">
                                            {brl.format(item.cost)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="tabular font-sora text-on-light text-body-lg font-bold">
                                  {brl.format(order.cost)}
                                </span>
                                <span className="tabular text-on-light-muted text-label-sm normal-case">
                                  {order.downtimeHours} h parado
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                ) : tab === 'PLANOS' ? (
                  <section>
                    {/* ⚠️ Sem `LightCard`: era cartão dentro de cartão. Ele
                        embrulhava o conteúdo INTEIRO da aba, e esse conteúdo é uma
                        grade de blocos, dentro do painel branco da página. Título e
                        respiro fazem a separação, que é como o resto do painel faz. */}
                    <h2 className="font-sora text-on-light text-headline-md mb-5">
                      Planos preventivos
                    </h2>
                    <p className="text-on-light-variant text-body-md mb-5">
                      O plano dispara pela quilometragem, não pelo calendário — é o que evita
                      manutenção cedo demais em veículo parado e tarde demais em veículo que roda.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.plans.map((plan) => (
                        <li
                          key={plan.id}
                          className="bg-light-container flex min-w-0 flex-col rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-on-light font-semibold">{plan.name}</h3>
                              <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                                a cada {km.format(plan.intervalKm)} km · {plan.appliesTo}
                              </p>
                            </div>
                            <MaintenanceIcon
                              size={18}
                              className="text-on-light-muted shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          {plan.overdueVehicles.length > 0 ? (
                            <p className="text-error text-label-md mt-3 flex items-center gap-1.5 normal-case">
                              <WarningIcon size={14} aria-hidden="true" />
                              Vencido em{' '}
                              <span className="tabular">{plan.overdueVehicles.join(', ')}</span>
                            </p>
                          ) : null}

                          <ul className="border-light-outline mt-auto flex flex-col gap-1.5 border-t pt-3">
                            {plan.nextVehicles.map((vehicle) => (
                              <li
                                key={vehicle.plate}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="tabular text-on-light-variant text-label-md normal-case">
                                  {vehicle.plate}
                                </span>
                                <span
                                  className={cn(
                                    'tabular text-label-md normal-case',
                                    vehicle.kmToService < 1000
                                      ? 'text-warning'
                                      : 'text-on-light-muted',
                                  )}
                                >
                                  em {km.format(vehicle.kmToService)} km
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <section>
                    <h2 className="font-sora text-on-light text-headline-md mb-5">Oficinas</h2>
                    <p className="text-on-light-variant text-body-md mb-5">
                      Custo médio e tempo de parada por oficina — é o que sustenta a negociação de
                      contrato.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.workshops.map((workshop) => (
                        <li key={workshop.id} className="bg-light-container rounded-lg p-4">
                          <h3 className="text-on-light font-semibold">{workshop.name}</h3>
                          <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                            {workshop.city}
                          </p>

                          <dl className="border-light-outline mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Ordens
                              </dt>
                              <dd className="tabular text-on-light mt-0.5 font-semibold">
                                {workshop.ordersInPeriod}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Custo médio
                              </dt>
                              <dd className="tabular text-on-light mt-0.5 font-semibold">
                                {brl.format(workshop.averageCost)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Parada
                              </dt>
                              <dd className="tabular text-on-light mt-0.5 font-semibold">
                                {workshop.averageDowntimeHours} h
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </section>
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
 * A tela de Manutenção quando a origem é a telemetria de verdade.
 *
 * <h2>Metade medida, metade ausente</h2>
 *
 * Até 06/09/2026 esta tela era só o aviso de origem ausente, e isso estava certo
 * pela metade. Ordem de serviço, oficina e plano preventivo de fato não existem
 * no sistema, e não é a telemetria que vai criá-los.
 *
 * Mas o rastreador acusa problema mecânico o tempo todo, e ninguém estava
 * olhando: 22.307 ocorrências em 30 dias, em 33 veículos. Isso é exatamente o
 * que uma oficina usa para decidir qual caminhão examinar primeiro.
 *
 * A ordem é deliberada: primeiro o que está medido, depois o que falta. O
 * contrário faria a pessoa fechar a página antes de ver que existe informação
 * confiável ali.
 */
function ManutencaoReal() {
  /*
   * Trinta dias, fixos.
   *
   * Alerta mecânico é padrão que se forma com repetição: numa janela de um dia,
   * um caminhão com problema crônico aparece igual a um que disparou o sensor
   * uma vez numa subida.
   */
  const JANELA = 30;
  const PERIODO = 'últimos 30 dias';

  const alertas = useQuery({
    queryKey: ['manutencao', 'alertas-mecanicos', JANELA],
    queryFn: () => fetchMechanicalAlerts(JANELA),
  });

  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [unidade, setUnidade] = useState(TODAS_UNIDADES);
  const [pagina, setPagina] = useState(1);

  const resumo = useMemo(() => aggregateMechanicalAlerts(alertas.data ?? []), [alertas.data]);

  /* A busca é por placa E modelo: quem procura "Actros" está atrás da família
     inteira, e quem digita a placa está atrás de um caminhão só. */
  const termo = busca.trim().toLocaleLowerCase('pt-BR');

  const filtrados = useMemo(
    () =>
      resumo.veiculos.filter(
        (veiculo) =>
          (tipo === null || veiculo.tipos.some((t) => t.description === tipo)) &&
          (unidade === TODAS_UNIDADES || veiculo.unidade === unidade) &&
          (termo === '' ||
            veiculo.plate.toLocaleLowerCase('pt-BR').includes(termo) ||
            (veiculo.model ?? '').toLocaleLowerCase('pt-BR').includes(termo)),
      ),
    [resumo.veiculos, tipo, unidade, termo],
  );

  const filtrando = tipo !== null || unidade !== TODAS_UNIDADES || termo !== '';

  /* Todo filtro volta para a primeira página: recortar a fila estando na quarta
     é a forma mais rápida de olhar para uma lista vazia. */
  const escolherTipo = (proximo: string | null) => {
    setTipo(proximo);
    setPagina(1);
  };

  const escolherUnidade = (proxima: string) => {
    setUnidade(proxima);
    setPagina(1);
  };

  const escolherBusca = (proxima: string) => {
    setBusca(proxima);
    setPagina(1);
  };

  const limpar = () => {
    setTipo(null);
    setUnidade(TODAS_UNIDADES);
    setBusca('');
    setPagina(1);
  };

  const note = filtrando
    ? `Mostrando ${filtrados.length} de ${resumo.veiculos.length} veículos: ${[
        tipo ? formatAlertDescription(tipo).toLocaleLowerCase('pt-BR') : null,
        unidade !== TODAS_UNIDADES ? unidade : null,
        termo ? `"${busca.trim()}"` : null,
      ]
        .filter(Boolean)
        .join(' · ')}. A contagem à direita continua sendo o total do veículo.`
    : `${inteiro.format(resumo.total)} ocorrências em ${resumo.veiculos.length} ${
        resumo.veiculos.length === 1 ? 'veículo' : 'veículos'
      }, ${PERIODO}. É o que o sensor disparou, e não um diagnóstico.`;

  return (
    <>
      <HeroBand
        title="Manutenção"
        description="O que o rastreador acusa de mecânico, e o que ainda depende de cadastro. A fila começa pelo caminhão que mais dispara, e os tipos recortam a lista sem mudar essa ordem."
      >
        <HeroPill icon={ClockIcon}>{PERIODO}</HeroPill>
      </HeroBand>

      {/*
       * ⚠️ O mesmo arranjo de `/gestao/impedimentos` (decisão do usuário em
       * 08/09/2026): faixa, fileira de números FORA do painel mordendo a borda
       * dela, e só então a placa branca com o conteúdo.
       *
       * Antes era um `GlassCard` solto sobre o papel seguido do aviso de origem,
       * sem painel nenhum: o conteúdo flutuava enquanto as outras rotas do par
       * tinham a placa. A subida fica nos cards, e não na seção, senão o
       * carregando e o erro apareceriam por cima da faixa colorida.
       */}
      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo dos alertas mecânicos</h2>

        <QueryState
          isPending={alertas.isPending}
          isError={alertas.isError}
          label="os alertas mecânicos"
        >
          <HeroStats
            className="-mt-16 sm:-mt-20"
            items={[
              {
                key: 'alertas',
                label: 'Alertas da rede CAN',
                value: inteiro.format(resumo.total),
                hint: 'ocorrências no período',
                icon: WarningIcon,
                tone: resumo.total > 0 ? 'warn' : 'neutral',
              },
              {
                key: 'veiculos',
                label: 'Veículos acusando',
                value: resumo.veiculos.length,
                hint: 'com ao menos um alerta',
                icon: TruckIcon,
              },
              {
                key: 'tipo',
                label: 'Tipo mais frequente',
                value: resumo.porTipo[0] ? inteiro.format(resumo.porTipo[0][1]) : '—',
                hint: resumo.porTipo[0]?.[0] ?? 'nenhum alerta no período',
                icon: MaintenanceIcon,
              },
              {
                key: 'ultimo',
                label: 'Último registro',
                value: resumo.ultimo ? date.format(new Date(resumo.ultimo)) : '—',
                hint: 'ocorrência mais recente',
                icon: ClockIcon,
              },
            ]}
          />
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState
          isPending={alertas.isPending}
          isError={alertas.isError}
          label="os alertas mecânicos"
        >
          {resumo.porTipo.length > 0 ? (
            <>
              {/* ⚠️ Sem cartão em volta: a barra já vive dentro do painel branco,
                  e cartão dentro de cartão é moldura sobre moldura. É o mesmo
                  desenho de `FleetFilters`, com `surface="light"` nos campos. */}
              <div
                role="group"
                aria-label="Filtros dos alertas mecânicos"
                className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
              >
                <GlassInput
                  id="alerta-busca"
                  surface="light"
                  label="Buscar"
                  placeholder="Placa ou modelo"
                  value={busca}
                  onChange={(event) => escolherBusca(event.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                />

                {/* O seletor só existe quando o rastreador informa unidade em mais
                    de uma: com uma só, ele seria um controle sem escolha. */}
                {resumo.unidades.length > 1 ? (
                  <GlassSelect
                    id="alerta-unidade"
                    surface="light"
                    label="Unidade"
                    value={unidade}
                    onValueChange={escolherUnidade}
                    options={[
                      { value: TODAS_UNIDADES, label: 'Todas as unidades' },
                      ...resumo.unidades.map((nome) => ({ value: nome, label: nome })),
                    ]}
                  />
                ) : null}
              </div>

              <h3 className="text-on-light-variant text-label-md mt-6 normal-case">
                Por tipo de alerta
              </h3>
              <div className="mt-3">
                <MechanicalKindFilters
                  porTipo={resumo.porTipo}
                  selected={tipo}
                  onSelect={escolherTipo}
                />
              </div>

              <div className="mt-8">
                <MechanicalAlertsQueue
                  veiculos={filtrados}
                  note={note}
                  page={pagina}
                  onPageChange={setPagina}
                  action={
                    filtrando ? (
                      <SpectrumButton variant="ghost" size="sm" onClick={limpar}>
                        Limpar filtro
                      </SpectrumButton>
                    ) : null
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-on-light-variant text-body-md py-10 text-center">
              Nenhum alerta mecânico nos {JANELA} dias.
            </p>
          )}
        </QueryState>

        {/*
          O aviso continua, e continua inteiro: alerta de sensor não é ordem de
          serviço. Dentro do painel ele perde a moldura de cartão (cartão dentro
          de cartão) e vira o poço claro que o resto do painel já usa.
        */}
        <div className="mt-8">
          <PendingSource
            title="A oficina e o plano ainda não têm origem"
            description="Os alertas acima dizem o que o veículo está acusando. O que foi feito a respeito, quanto custou e quando vence o próximo serviço dependem de cadastro que ainda não existe."
            requirements={[
              'Plano preventivo: qual serviço, a cada quantos quilômetros ou horas',
              'Ordem de serviço: abertura, oficina, peças, valor e conclusão',
              'Tempo parado, que é o custo invisível da manutenção',
            ]}
            meanwhile={[
              { label: 'Odômetro e horímetro de cada veículo', to: '/gestao/caminhoes' },
              { label: 'Consumo por veículo', to: '/gestao/custos' },
              { label: 'Eventos de condução', to: '/gestao/seguranca' },
            ]}
            className="bg-light-container p-5 shadow-none ring-0 sm:p-6"
          />
        </div>
      </PageContent>
    </>
  );
}
