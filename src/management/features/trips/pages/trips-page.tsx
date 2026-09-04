import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ParkingIcon,
  SearchIcon,
  RouteIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import type { Trip } from '@/management/types';
import {
  GlassDateField,
  GlassInput,
  GlassSelect,
  Pagination,
  SpectrumButton,
  cn,
} from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PendingSource } from '@/management/components/layout/pending-source';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { env } from '@/app/environment';
import { fetchFrequentStops, fetchJourneys } from '@/management/lib/fleet-api';
import { duration } from '@/management/lib/format';

import { getTrips } from '../api';
import { JourneyList } from '../components/journey-list';
import { StopsMap } from '../components/stops-map';
import { TripDetailPanel } from '../components/trip-detail-panel';
import { TripStatusChip, finishedLate, isLate } from '../trip-status';

const TABS = [
  { id: 'EM_CURSO', label: 'Em curso' },
  { id: 'ATRASADAS', label: 'Atrasadas' },
  { id: 'CONCLUIDAS', label: 'Concluídas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const isOpen = (trip: Trip) => trip.status !== 'CONCLUIDA' && trip.status !== 'CANCELADA';

function matchesTab(trip: Trip, tab: TabId) {
  if (tab === 'EM_CURSO') return isOpen(trip);
  if (tab === 'ATRASADAS') return isLate(trip);
  return !isOpen(trip);
}

/* -------------------------------------------------------------------------- */
/* Com dado real                                                               */
/* -------------------------------------------------------------------------- */

const JANELAS = [
  { dias: 1, label: 'Hoje' },
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
] as const;

const ABAS_REAIS = [
  { id: 'PERCURSOS', label: 'Percursos' },
  { id: 'PARADAS', label: 'Onde a frota para' },
] as const;

type AbaReal = (typeof ABAS_REAIS)[number]['id'];

/**
 * Quantos percursos por página.
 *
 * ⚠️ Cem, e não o `PAGE_SIZE` de trinta das outras listas (decisão do usuário em
 * 01/09/2026). Aqui a linha é baixa e a leitura é de varredura: rolar cem
 * linhas custa menos que trocar de página quatro vezes para achar um trecho.
 */
const POR_PAGINA = 100;

/** Valor de "sem recorte". Sentinela, e não string vazia: o Radix não aceita. */
const TODOS = 'TODOS';
const SEM_CONDUTOR = 'SEM_CONDUTOR';

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Viagens com o que a telemetria entrega.
 *
 * <h2>Percurso não é viagem de frete</h2>
 *
 * ⚠️ A tela de origem mostrava código da viagem, cliente, prazo acordado e taxa
 * de entrega no prazo. **Nada disso existe na telemetria.** A MiX entrega o
 * trecho entre ligar e desligar o veículo, e só. Cliente, carga, frete e prazo
 * saem de um TMS ou de um cadastro próprio, que ainda não existe.
 *
 * Manter os campos antigos preenchidos com mock seria o pior caso: um gestor
 * lendo "94% no prazo" acreditaria, porque o número tem exatamente a cara de um
 * indicador medido.
 *
 * <h2>O que entrou no lugar</h2>
 *
 * Percursos, que é o dado real, e onde a frota fica parada, que ninguém
 * pergunta e todo mundo paga. A segunda aba respondeu na primeira execução algo
 * que nenhuma outra tela responde: 122 horas em um único endereço em trinta
 * dias, com dez dos treze veículos passando por lá.
 */
function ViagensReais() {
  const [dias, setDias] = useState<number>(7);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<AbaReal>('PERCURSOS');
  const [paradaAtiva, setParadaAtiva] = useState<number | null>(null);

  /* Recortes feitos no cliente: os percursos do período já vieram na resposta,
     e trocar de placa não pode custar uma ida ao servidor. A busca continua
     server-side porque endereço não cabe em lista de opções. */
  const [placa, setPlaca] = useState(TODOS);
  const [motorista, setMotorista] = useState(TODOS);
  /* Data em ISO (`yyyy-MM-dd`), vazia quando não há recorte de dia. */
  const [diaEscolhido, setDiaEscolhido] = useState('');
  const [pagina, setPagina] = useState(1);

  const percursos = useQuery({
    queryKey: ['viagens', 'percursos', dias, busca],
    queryFn: () => fetchJourneys({ days: dias, search: busca || undefined }),
  });

  /* Trinta dias fixos: parada frequente é padrão, e padrão não aparece em um
     dia. Amarrar na janela dos percursos deixaria a aba vazia em "Hoje". */
  const paradas = useQuery({
    queryKey: ['viagens', 'paradas'],
    queryFn: () => fetchFrequentStops(30),
  });

  const lista = useMemo(() => percursos.data?.journeys ?? [], [percursos.data]);

  /* As opções saem do próprio resultado: oferecer uma placa que não rodou no
     período é oferecer uma lista vazia. */
  const opcoesPlaca = useMemo(
    () => [
      { value: TODOS, label: 'Todas as placas' },
      ...[...new Set(lista.map((item) => item.plate))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((valor) => ({ value: valor, label: valor })),
    ],
    [lista],
  );

  const opcoesMotorista = useMemo(() => {
    const nomes = [...new Set(lista.flatMap((item) => (item.driverName ? [item.driverName] : [])))];
    const semCondutor = lista.some((item) => !item.driverName);

    return [
      { value: TODOS, label: 'Todos os motoristas' },
      /* Sem condutor é um recorte de verdade, e não a ausência de filtro: é o
         percurso que não entra em nota, jornada nem ranking. */
      ...(semCondutor ? [{ value: SEM_CONDUTOR, label: 'Sem condutor identificado' }] : []),
      ...nomes
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((nome) => ({ value: nome, label: nome })),
    ];
  }, [lista]);

  const filtrados = useMemo(
    () =>
      lista.filter((item) => {
        if (placa !== TODOS && item.plate !== placa) return false;
        if (motorista === SEM_CONDUTOR && item.driverName) return false;
        if (motorista !== TODOS && motorista !== SEM_CONDUTOR && item.driverName !== motorista) {
          return false;
        }
        if (diaEscolhido !== '' && !item.startedAt.startsWith(diaEscolhido)) return false;
        return true;
      }),
    [lista, placa, motorista, diaEscolhido],
  );

  /* A página é presa ao total durante o render, e não corrigida por efeito:
     filtrar na página 3 de uma lista que passou a ter 40 deixaria a tela vazia.
     Mesmo padrão dos cadastros de frota e de motoristas. */
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const daPagina = useMemo(
    () => filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [filtrados, paginaAtual],
  );

  const filtrando = placa !== TODOS || motorista !== TODOS || diaEscolhido !== '';

  const limparFiltros = () => {
    setPlaca(TODOS);
    setMotorista(TODOS);
    setDiaEscolhido('');
    setBusca('');
    setPagina(1);
  };

  const resumo = useMemo(() => {
    const distancia = lista.reduce((soma, item) => soma + (item.distanceKm ?? 0), 0);
    const aoVolante = lista.reduce((soma, item) => soma + (item.drivingSeconds ?? 0), 0);
    const parado = lista.reduce((soma, item) => soma + (item.idleSeconds ?? 0), 0);
    const semMotorista = lista.filter((item) => !item.driverName).length;
    return { distancia, aoVolante, parado, semMotorista };
  }, [lista]);

  const totalHorasParadas = (paradas.data ?? []).reduce(
    (soma, parada) => soma + parada.totalHours,
    0,
  );

  const excessoParado = resumo.aoVolante > 0 && resumo.parado / resumo.aoVolante > 0.2;

  const stats: HeroStat[] = [
    {
      key: 'percursos',
      label: 'Percursos',
      value: km.format(lista.length),
      hint: 'trechos no período',
      icon: RouteIcon,
    },
    {
      key: 'km',
      label: 'Quilômetros rodados',
      value: km.format(resumo.distancia),
      hint: 'soma dos trechos',
      icon: TruckIcon,
    },
    {
      key: 'volante',
      label: 'Tempo ao volante',
      value: duration(resumo.aoVolante),
      hint: 'com o caminhão em movimento',
      icon: ClockIcon,
    },
    {
      /* Parado com motor ligado é combustível queimado sem sair do lugar.
         Destacado quando passa de um quinto do tempo ao volante. */
      key: 'parado',
      label: 'Motor ligado parado',
      value: duration(resumo.parado),
      hint: 'diesel queimado sem sair do lugar',
      icon: ParkingIcon,
      tone: excessoParado ? 'warn' : 'neutral',
    },
  ];

  return (
    <>
      <HeroBand
        title="Viagens"
        description="Cada percurso que a frota fez, e os lugares onde ela mais fica parada."
      >
        <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
          {JANELAS.map((janela) => (
            <button
              key={janela.dias}
              type="button"
              onClick={() => setDias(janela.dias)}
              aria-pressed={dias === janela.dias}
              className={cn(
                /* Sobre o indigo, a pastilha escolhida é a cor um degrau mais
                   escura, e não o preto do resto do painel: preto sobre indigo
                   lê como buraco na faixa. Ativo e hover são exclusivos. */
                'text-label-md focus-visible:ring-on-primary rounded-full px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                dias === janela.dias
                  ? 'bg-primary-strong text-on-primary'
                  : 'text-on-primary/80 hover:bg-primary-strong/60 hover:text-on-primary',
              )}
            >
              {janela.label}
            </button>
          ))}
        </div>
      </HeroBand>

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo do período</h2>

        <QueryState
          isPending={percursos.isPending}
          isError={percursos.isError}
          label="os percursos"
        >
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState` ela
              jogaria o carregamento e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />

          {resumo.semMotorista > 0 ? (
            /* Percurso sem condutor identificado não entra em nota, jornada nem
               ranking. O gestor precisa saber o tamanho do buraco. */
            <div className="bg-warning/10 border-warning/30 text-warning mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {resumo.semMotorista === 1
                  ? '1 percurso rodou sem condutor identificado e não entra na nota de nenhum motorista.'
                  : `${resumo.semMotorista} percursos rodaram sem condutor identificado e não entram na nota de nenhum motorista.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={ABAS_REAIS.map((opcao) => ({
            ...opcao,
            count: opcao.id === 'PERCURSOS' ? lista.length : (paradas.data ?? []).length,
          }))}
          value={aba}
          onValueChange={setAba}
          label="O que ver das viagens"
        >
          {aba === 'PERCURSOS' ? (
            <div className="pb-4">
              {/* ⚠️ `surface="light"`: os campos moram dentro do painel branco,
                  e a versão escura deles inverte a hierarquia da tela. */}
              <div className="mb-4 grid items-end gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                <GlassInput
                  surface="light"
                  label="Buscar"
                  placeholder="Rua, avenida ou bairro"
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                />

                <GlassSelect
                  surface="light"
                  label="Placa"
                  options={opcoesPlaca}
                  value={placa}
                  onValueChange={setPlaca}
                />

                <GlassSelect
                  surface="light"
                  label="Motorista"
                  options={opcoesMotorista}
                  value={motorista}
                  onValueChange={setMotorista}
                />

                {/* Calendário, e não lista de dias: a janela chega a trinta
                    dias, e escolher data em lista suspensa de trinta itens é
                    procurar, não escolher. Vazio significa "todos os dias". */}
                <GlassDateField
                  surface="light"
                  label="Dia do percurso"
                  value={diaEscolhido}
                  onValueChange={setDiaEscolhido}
                />
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-on-light-muted text-label-md normal-case">
                  {filtrados.length === lista.length
                    ? `${lista.length.toLocaleString('pt-BR')} ${lista.length === 1 ? 'percurso' : 'percursos'}`
                    : `${filtrados.length.toLocaleString('pt-BR')} de ${lista.length.toLocaleString('pt-BR')} percursos`}
                </p>

                {filtrando || busca !== '' ? (
                  <SpectrumButton type="button" variant="ghost" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </SpectrumButton>
                ) : null}
              </div>

              <QueryState
                isPending={percursos.isPending}
                isError={percursos.isError}
                label="os percursos"
              >
                {filtrados.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    {lista.length === 0
                      ? 'Nenhum percurso no período.'
                      : 'Nenhum percurso com esses filtros.'}
                  </p>
                ) : (
                  <>
                    <JourneyList journeys={daPagina} />

                    <Pagination
                      className="mt-6"
                      page={paginaAtual}
                      total={filtrados.length}
                      pageSize={POR_PAGINA}
                      onPageChange={setPagina}
                      label="percursos"
                    />
                  </>
                )}

                {percursos.data && percursos.data.ignored > 0 ? (
                  /* O piso é recorte, e recorte invisível faz a soma da tela
                     nunca fechar com a do banco. */
                  <p className="text-on-light-muted text-label-md mt-4 normal-case">
                    {percursos.data.ignored.toLocaleString('pt-BR')} manobras abaixo de{' '}
                    {numero(percursos.data.minKm * 1000)} metros ficaram de fora: são partidas de
                    pátio, não percursos.
                  </p>
                ) : null}
              </QueryState>
            </div>
          ) : (
            <div className="pb-4">
              <QueryState
                isPending={paradas.isPending}
                isError={paradas.isError}
                label="as paradas"
              >
                <p className="text-on-light-variant text-body-md mb-4 max-w-3xl">
                  Onde a frota ficou parada por mais de vinte minutos nos últimos trinta dias,
                  somando {km.format(totalHorasParadas)} horas. O sistema não sabe se o lugar é a
                  base, um cliente ou um posto: mostra o endereço e quem reconhece é você.
                </p>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_1fr]">
                  <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
                    {(paradas.data ?? []).map((parada, indice) => {
                      const ativa = indice === paradaAtiva;

                      return (
                        <li key={`${parada.coordinates[0]}-${parada.coordinates[1]}`}>
                          <button
                            type="button"
                            onClick={() => setParadaAtiva(indice)}
                            aria-current={ativa ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              ativa ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span
                                className={cn(
                                  'text-body-md truncate font-medium',
                                  ativa ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {parada.address ?? 'Endereço não informado'}
                              </span>
                              <span
                                className={cn(
                                  'tabular shrink-0 font-semibold',
                                  ativa ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {numero(parada.totalHours, 1)} h
                              </span>
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 normal-case',
                                ativa ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              <span className="tabular">
                                {parada.stops} {parada.stops === 1 ? 'parada' : 'paradas'}
                              </span>
                              {/* Veículos distintos separam a base do ponto de
                                  um motorista só. */}
                              <span className="tabular">
                                {parada.vehicles} {parada.vehicles === 1 ? 'veículo' : 'veículos'}
                              </span>
                              <span className="tabular flex items-center gap-1">
                                <ClockIcon size={12} aria-hidden="true" />
                                {numero(parada.avgMinutes)} min em média
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <StopsMap
                    stops={paradas.data ?? []}
                    selectedIndex={paradaAtiva}
                    onSelect={setParadaAtiva}
                    className="min-h-[420px] xl:min-h-[560px]"
                  />
                </div>
              </QueryState>
            </div>
          )}
        </PageTabs>

        <div className="mt-6">
          <PendingSource
            title="A viagem de frete ainda não existe aqui"
            description="Percurso é o que o veículo fez entre ligar e desligar. Viagem é o que a transportadora vendeu: cliente, carga, prazo e valor. A telemetria não sabe nada disso, e por isso esta tela não mostra prazo acordado nem taxa de entrega no prazo."
            requirements={[
              'Cadastro de viagem, ligando um ou mais percursos a um cliente e a uma carga',
              'Prazo combinado com o cliente, que é o que define atraso',
              'Valor do frete, sem o qual não há receita por viagem',
              'Ou, no lugar dos três, integração com o TMS que a transportadora já usa',
            ]}
            meanwhile={[
              { label: 'Percursos e paradas reais', to: '/gestao/viagens' },
              { label: 'Onde cada caminhão está agora', to: '/gestao/mapa' },
              { label: 'Comparação entre filiais', to: '/gestao/resultado' },
            ]}
          />
        </div>
      </PageContent>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Com mock                                                                    */
/* -------------------------------------------------------------------------- */

export function TripsPage() {
  if (!env.enableMocks) return <ViagensReais />;
  return <ViagensSimuladas />;
}

function ViagensSimuladas() {
  const { data, isPending, isError } = useQuery({ queryKey: ['trips'], queryFn: getTrips });
  const [tab, setTab] = useState<TabId>('EM_CURSO');

  const trips = useMemo(() => data ?? [], [data]);
  const visible = useMemo(() => trips.filter((trip) => matchesTab(trip, tab)), [trips, tab]);

  const tripId = useCallback((trip: Trip) => trip.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, tripId);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((option) => [option.id, trips.filter((t) => matchesTab(t, option.id)).length]),
      ) as Record<TabId, number>,
    [trips],
  );

  const finished = trips.filter((trip) => trip.status === 'CONCLUIDA');
  const onTime = finished.filter((trip) => !finishedLate(trip)).length;
  const onTimeRate = finished.length > 0 ? Math.round((onTime / finished.length) * 100) : 0;
  const lateCount = counts.ATRASADAS;

  const stats: HeroStat[] = [
    {
      key: 'curso',
      label: 'Em curso',
      value: counts.EM_CURSO,
      hint: 'na estrada agora',
      icon: RouteIcon,
    },
    {
      key: 'atrasadas',
      label: 'Atrasadas',
      value: lateCount,
      hint: 'cliente precisa ser avisado',
      icon: WarningIcon,
      tone: lateCount > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'concluidas',
      label: 'Concluídas no período',
      value: finished.length,
      hint: 'entregas fechadas',
      icon: CheckCircleIcon,
    },
    {
      key: 'prazo',
      label: 'Entregas no prazo',
      value: `${onTimeRate}%`,
      hint: 'sobre as concluídas',
      icon: ClockIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Viagens"
        description="O que está rodando agora, o que passou do prazo e o histórico do que já foi entregue."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo das viagens</h2>

        <QueryState isPending={isPending} isError={isError} label="as viagens">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState` ela
              jogaria o carregamento e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />

          {lateCount > 0 ? (
            <div className="bg-error/10 border-error/30 text-error mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {lateCount === 1
                  ? '1 viagem em curso já passou do prazo acordado com o cliente.'
                  : `${lateCount} viagens em curso já passaram do prazo acordado com o cliente.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((option) => ({ ...option, count: counts[option.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das viagens"
        >
          <QueryState isPending={isPending} isError={isError} label="as viagens">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,340px)_1fr]">
              <div className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-sora text-primary text-headline-md">Viagens</h2>
                  <span className="text-on-light-muted text-label-md tabular normal-case">
                    {visible.length} de {trips.length}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhuma viagem nesta situação.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((trip) => {
                      const active = trip.id === selectedId;
                      const late = isLate(trip);

                      return (
                        <li key={trip.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(trip.id)}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  'tabular font-semibold',
                                  active ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {trip.code}
                              </span>
                              {active ? null : late ? (
                                <WarningIcon
                                  size={15}
                                  aria-label="Atrasada"
                                  className="text-error-on-light"
                                />
                              ) : (
                                <TripStatusChip status={trip.status} surface="light" />
                              )}
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 flex flex-wrap items-center gap-1.5 normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              <span className="truncate">{trip.origin}</span>
                              <ArrowRightIcon size={11} aria-hidden="true" />
                              <span className="truncate">{trip.destination}</span>
                            </span>

                            <span
                              className={cn(
                                'tabular text-label-md mt-0.5 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {trip.driverName} · {km.format(trip.distanceKm)} km
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <TripDetailPanel trip={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione uma viagem para ver a rota e a linha do tempo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
