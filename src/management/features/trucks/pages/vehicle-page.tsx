import {
  ChecklistIcon,
  ArrowLeftIcon,
  BellIcon,
  ChartIcon,
  ClockIcon,
  FileIcon,
  QrCodeIcon,
  WarningIcon,
  GridIcon,
  MaintenanceIcon,
  PartnerShopIcon,
  RouteIcon,
  UsersIcon,
} from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { HeroBand, HeroLink, HeroPill, HERO_PILL } from '@/management/components/layout/hero-band';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import { km } from '@/management/lib/format';
import { cn } from '@/management/ui';

import {
  DEMO_PLATE,
  demoDriverPhone,
  demoPosition,
  demoTelemetry,
  demoTrack,
  demoVehicle,
  demoVehicleDetail,
} from '@/management/mocks/demo-vehicle';

import { getVehiclePositions } from '@/management/features/live-map/api';
import { FleetMap } from '@/management/features/live-map/components/fleet-map';
import { prepararTrajeto } from '@/management/features/live-map/track-segments';
import { fetchJourneys } from '@/management/lib/fleet-api';
import { JourneyList } from '@/management/features/trips/components/journey-list';

import { getVehicleDetail, getVehicleRegistry, getVehicles, getVehicleTrack } from '../api';
import { YARD_STATUS } from '../yard-status';
import { VehicleDriverCard } from '../components/vehicle-driver-card';
import { MaintenanceHistory } from '../components/maintenance-history';
import { VehicleMaintenance } from '../components/vehicle-maintenance';
import { VehiclePartnerShops } from '../components/vehicle-partner-shops';
import { VehicleChecklistCard } from '../components/vehicle-checklist-card';
import { VehicleDocumentsCard } from '../components/vehicle-documents-card';
import { VehicleGuidesCard } from '../components/vehicle-guides-card';
import { VehicleManualDialog } from '../components/vehicle-manual-dialog';
import { VehicleQrDialog } from '../components/vehicle-qr-dialog';
import {
  FuelEfficiencyCard,
  FuelTankCard,
  RouteEfficiencyCard,
  ThrottleCard,
  TireStatusCard,
  VehicleCard,
} from '../components/vehicle-telemetry-cards';

/**
 * As seções da ficha, na barra lateral.
 *
 * ⚠️ **Os nomes vieram da referência em inglês e foram traduzidos, e dois deles
 * não têm conteúdo no produto**: "shipment" e "customer" pressupõem ordem de
 * frete e cliente, que o RookHub não tem. Eles ficam na barra porque o usuário
 * os pediu, e a seção diz o que falta em vez de fingir uma lista vazia.
 *
 * ⚠️ A barra é NAVEGAÇÃO DA PÁGINA, e não do produto: o menu do painel é a
 * barra superior, e uma segunda navegação global brigaria com ela.
 */
const SECOES = [
  { id: 'geral', label: 'Visão geral', icon: GridIcon },
  { id: 'viagens', label: 'Viagens', icon: RouteIcon },
  /* Manutenção fica junto da operação, e não no fim: quem abre a ficha por causa
     de um barulho no freio procura aqui antes de qualquer número. */
  { id: 'manutencao', label: 'Manutenção', icon: MaintenanceIcon },
  /* Checklist logo depois de manutenção, e antes do histórico: quem abre a ficha
     por causa de um barulho no freio quer ver, na mesma sequência, o que o
     motorista marcou na saída de hoje. */
  { id: 'checklist', label: 'Checklists', icon: ChecklistIcon },
  { id: 'historico', label: 'Histórico', icon: ClockIcon },
  { id: 'oficinas', label: 'Oficinas parceiras', icon: PartnerShopIcon },
  { id: 'cliente', label: 'Cliente', icon: UsersIcon },
  { id: 'analise', label: 'Análise', icon: ChartIcon },
  { id: 'notificacoes', label: 'Notificações', icon: BellIcon },
] as const;

type SecaoId = (typeof SECOES)[number]['id'];

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const diaCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

const SEVERIDADE: Record<string, string> = {
  CRITICO: 'bg-error',
  ATENCAO: 'bg-warning',
  INFO: 'bg-info',
};

/**
 * A ficha de um veículo, aberta pelo cartão do pátio.
 *
 * <h2>⚠️ O endereço é a PLACA, e não o id</h2>
 *
 * `patio/BAW1F62` se lê e se manda por mensagem. Mesma escolha que o backoffice
 * fez para a empresa, e quem traduz placa em veículo é a própria tela, na lista
 * da frota que o pátio já deixou em cache.
 *
 * <h2>⚠️ SEIS DOS NOVE BLOCOS NÃO TÊM ORIGEM, e isso está na tela</h2>
 *
 * Consumo, nível de tanque, acelerador, eficiência de rota e pneu dependem de
 * sinal que a MiX não manda nesta frota; cliente e frete dependem de um módulo
 * que o produto não tem. Cada um desses blocos aparece com a forma dele e diz o
 * que falta. **Não preencher com valor de exemplo**: a regra do produto é que um
 * número real ao lado de três inventados é pior que uma tela faltando, porque
 * empresta credibilidade ao conjunto.
 *
 * O que é real: o rastro no mapa, o condutor, a quilometragem por dia, os
 * eventos de condução e o manual do veículo.
 */
export function VehiclePage() {
  const { plate = '' } = useParams();
  const [secao, setSecao] = useState<SecaoId>('geral');
  const [manualAberto, setManualAberto] = useState(false);
  const [qrAberto, setQrAberto] = useState(false);

  /*
   * ⚠️ A placa de DEMONSTRAÇÃO curto-circuita a frota, e de propósito: ela não
   * vem da API, não entra no pátio e não conta em lugar nenhum. Serve para ver a
   * ficha cheia enquanto cinco dos blocos não têm origem. Ver
   * `mocks/demo-vehicle`.
   */
  const demonstracao = plate.toUpperCase() === DEMO_PLATE;

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    enabled: !demonstracao,
  });
  const vehicle = demonstracao
    ? demoVehicle
    : vehiclesQuery.data?.find((item) => item.plate.toLowerCase() === plate.toLowerCase());

  const detailQuery = useQuery({
    queryKey: ['vehicle-detail', vehicle?.id],
    queryFn: () => getVehicleDetail(vehicle!.id),
    enabled: Boolean(vehicle?.id) && !demonstracao,
  });
  const detail = demonstracao ? demoVehicleDetail : detailQuery.data;
  /* Percurso pertence ao veículo. A página geral de Viagens ocultava essa
     relação atrás de um filtro de placa; aqui a placa já é o contexto. */
  const percursosQuery = useQuery({
    queryKey: ['veiculo', vehicle?.id, 'percursos'],
    queryFn: () => fetchJourneys({ vehicleId: vehicle!.id, days: 30 }),
    enabled: Boolean(vehicle?.id) && !demonstracao,
  });
  const percursos = percursosQuery.data?.journeys ?? [];
  /*
   * O cadastro entra só pelo número de eixos, que é o que o desenho dos pneus
   * precisa. ⚠️ A CHAVE É A MESMA do manual (`vehicle-registry`): os dois
   * dividem o cache, então abrir o manual depois disto não vai ao servidor de
   * novo.
   */
  const registryQuery = useQuery({
    queryKey: ['vehicle-registry', vehicle?.id],
    queryFn: () => getVehicleRegistry(vehicle!.id),
    enabled: Boolean(vehicle?.id),
  });

  const trackQuery = useQuery({
    queryKey: ['vehicle-track', vehicle?.id],
    queryFn: () => getVehicleTrack(vehicle!.id, 24),
    enabled: Boolean(vehicle?.id) && !demonstracao,
    refetchInterval: 60_000,
  });
  /* ⚠️ Memorizado, e não calculado no corpo: sem isto a referência muda a cada
     render e o `prepararTrajeto` abaixo reprocessa os 622 pontos toda vez. */
  const track = useMemo(
    () => (demonstracao ? demoTrack : (trackQuery.data ?? [])),
    [demonstracao, trackQuery.data],
  );

  /*
   * ⚠️ O mapa é o MESMO do `/gestao/mapa` (`FleetMap`), a pedido do usuário em
   * 16/09/2026, e não um mapa próprio: o desenho do veículo, o crachá da placa, a
   * inclinação e o tratamento de lacuna já estão resolvidos lá, e uma segunda
   * implementação divergiria na primeira correção. A diferença é a LISTA: aqui
   * ela tem um veículo só.
   *
   * ⚠️ `prepararTrajeto` é obrigatório e não é enfeite: ele separa trecho medido
   * de lacuna. Com a lista crua, o mapa liga leitura a leitura sem saber quanto
   * tempo passou entre as duas e desenha como percurso uma reta de 20km que
   * ninguém mediu.
   */
  const positionsQuery = useQuery({
    queryKey: ['fleet-positions'],
    queryFn: getVehiclePositions,
    enabled: Boolean(vehicle?.id) && !demonstracao,
    refetchInterval: 30_000,
  });
  const posicao = demonstracao
    ? demoPosition
    : positionsQuery.data?.find((item) => item.vehicleId === vehicle?.id);
  const trajeto = useMemo(() => prepararTrajeto(track), [track]);

  const status = vehicle ? YARD_STATUS[vehicle.status] : null;
  const modelo = vehicle
    ? [vehicle.brand, vehicle.model]
        .filter((parte) => parte && !/n[ãa]o informado/i.test(parte))
        .join(' ')
    : '';

  const serie = (detail?.dailyDistance ?? []).map((ponto) => ({
    dia: diaCurto.format(new Date(ponto.day)),
    km: ponto.km,
  }));

  return (
    /*
     * ⚠️ **COLUNA FLEX DE UMA TELA DE ALTURA, e a folha branca cresce dentro
     * dela.** Sem isto a folha termina onde o conteúdo termina, e o papel bege
     * do painel aparece embaixo: a seção de Manutenção sem item escolhido é
     * curta, e a página ficava com duas cores.
     *
     * ⚠️ O invólucro é DESTA tela, e não do `ManagementLayout`: transformar o
     * layout em coluna flex mudaria o empilhamento de vinte telas de uma vez, e
     * margem não colapsa mais dentro de flex. Com `flex-1` na folha a conta é do
     * navegador, sem número mágico de altura de faixa.
     */
    <div className="flex min-h-dvh flex-col">
      <HeroBand
        title={vehicle?.plate ?? plate.toUpperCase()}
        description={modelo || 'Veículo da frota'}
      >
        {status ? <HeroPill icon={status.icon}>{status.label}</HeroPill> : null}
        {vehicle ? (
          <button
            type="button"
            onClick={() => setQrAberto(true)}
            className={cn(
              HERO_PILL,
              'text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            <QrCodeIcon size={15} aria-hidden="true" />
            QR do veículo
          </button>
        ) : null}
        {vehicle ? (
          <button
            type="button"
            onClick={() => setManualAberto(true)}
            className={cn(
              HERO_PILL,
              'text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            <FileIcon size={15} aria-hidden="true" />
            Manual
          </button>
        ) : null}
        <HeroLink to="/gestao/patio" icon={ArrowLeftIcon}>
          Voltar para o pátio
        </HeroLink>
      </HeroBand>

      <PageContent className="bg-light rounded-t-4xl relative -mt-16 flex-1 pt-8 sm:rounded-t-[40px]">
        {demonstracao ? (
          /*
           * ⚠️ AVISO PERMANENTE, e não um chip discreto. Um print desta tela
           * numa reunião vira número de cliente se nada disser o contrário, e a
           * regra do produto é que tela que é maquete precisa DIZER que é.
           */
          <div
            role="status"
            className="border-warning/40 bg-warning/10 text-warning-on-light mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3"
          >
            <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-label-md normal-case">
              <strong className="font-semibold">Veículo de demonstração.</strong> Esta placa não
              existe na frota e todos os números desta página são inventados, para mostrar como a
              ficha fica quando os sensores existirem. Nenhum caminhão de verdade mostra estes
              blocos preenchidos.
            </p>
          </div>
        ) : null}

        {/* ⚠️ CONSULTA DESLIGADA É `isPending` PARA SEMPRE, e na demonstração ela
            está desligada de propósito: sem esta guarda a ficha ficava girando
            para sempre. Mesma armadilha da ficha da empresa no backoffice. */}
        <QueryState
          isPending={!demonstracao && vehiclesQuery.isPending}
          isError={!demonstracao && vehiclesQuery.isError}
          error={vehiclesQuery.error}
          label="o veículo"
        >
          {!vehicle ? (
            <div className="bg-light-container flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
              <p className="text-on-light text-body-lg font-sora font-semibold">
                Nenhum veículo com a placa {plate.toUpperCase()}
              </p>
              <p className="text-on-light-muted text-body-md max-w-sm text-balance">
                Ele pode ter saído da frota, ou o endereço foi digitado à mão.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)]">
              {/* ⚠️ `lg:sticky` com `self-start`: sem o segundo, o grudado não
                  tem altura própria dentro do grid e não gruda em nada. */}
              <nav aria-label="Seções do veículo" className="lg:sticky lg:top-6 lg:self-start">
                <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {SECOES.map((item) => {
                    const Icon = item.icon;
                    const ativa = secao === item.id;
                    return (
                      <li key={item.id} className="shrink-0 lg:shrink">
                        <button
                          type="button"
                          onClick={() => setSecao(item.id)}
                          aria-current={ativa ? 'page' : undefined}
                          className={cn(
                            'text-label-md focus-visible:ring-primary-on-light flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                            /* Ativo é a pastilha terracota da navegação, que é
                               como o painel inteiro marca "você está aqui". */
                            ativa
                              ? 'bg-primary-strong text-on-primary'
                              : 'text-on-light-variant hover:bg-light-container',
                          )}
                        >
                          <Icon size={16} aria-hidden="true" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="min-w-0">
                {secao === 'geral' ? (
                  <div className="grid gap-4 xl:grid-cols-3">
                    <VehicleCard
                      title="Trajeto do veículo"
                      icon={RouteIcon}
                      hint={
                        /* Na demonstração o rastro é inventado, e a dica não
                           pode dizer "real" logo abaixo da faixa que avisa o
                           contrário. */
                        demonstracao
                          ? 'Rastro de demonstração, com a posição atual'
                          : 'Rastro real das últimas 24 horas, com a posição atual'
                      }
                      className="xl:col-span-2"
                    >
                      <QueryState
                        isPending={!demonstracao && trackQuery.isPending}
                        isError={!demonstracao && trackQuery.isError}
                        error={trackQuery.error}
                        label="o trajeto"
                      >
                        {posicao || track.length > 0 ? (
                          <div className="border-light-outline relative h-80 overflow-hidden rounded-xl border">
                            <FleetMap
                              positions={posicao ? [posicao] : []}
                              selectedId={vehicle.id}
                              /* Não há para onde navegar: a lista tem um veículo
                                 só, e ele já é o escolhido. */
                              onSelect={() => {}}
                              track={trajeto}
                              className="h-full"
                            />
                          </div>
                        ) : (
                          <div className="bg-light-container text-on-light-muted flex h-80 flex-col items-center justify-center gap-2 rounded-xl p-6 text-center">
                            <RouteIcon size={26} aria-hidden="true" />
                            <p className="text-body-md">Sem posições nas últimas 24 horas.</p>
                            <p className="text-label-sm normal-case">
                              O rastreador deste veículo não reportou nenhum ponto no período.
                            </p>
                          </div>
                        )}
                      </QueryState>
                    </VehicleCard>

                    <VehicleDriverCard
                      vehicle={vehicle}
                      detail={detail}
                      telefone={demonstracao ? demoDriverPhone : undefined}
                    />

                    <FuelEfficiencyCard
                      porTrecho={demonstracao ? demoTelemetry.fuelPerLeg : undefined}
                      media={demonstracao ? demoTelemetry.fuelAverage : undefined}
                    />
                    <FuelTankCard tanque={demonstracao ? demoTelemetry.tank : undefined} />
                    <ThrottleCard acelerador={demonstracao ? demoTelemetry.throttle : undefined} />
                    <RouteEfficiencyCard rota={demonstracao ? demoTelemetry.route : undefined} />
                    <TireStatusCard
                      axles={registryQuery.data?.axles}
                      pneus={demonstracao ? demoTelemetry.tires : undefined}
                    />

                    <VehicleCard
                      title="Rodagem"
                      icon={ChartIcon}
                      hint="O que existe de medido: distância e trechos do período"
                    >
                      <dl className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">
                            Distância
                          </dt>
                          <dd className="text-on-light font-sora tabular text-[26px] font-bold leading-none">
                            {detail?.distanceKm == null
                              ? '–'
                              : `${km.format(detail.distanceKm)} km`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-on-light-muted text-label-sm normal-case">Trechos</dt>
                          <dd className="text-on-light font-sora tabular text-[26px] font-bold leading-none">
                            {detail?.journeys ?? '–'}
                          </dd>
                        </div>
                      </dl>
                    </VehicleCard>

                    {/*
                     * ⚠️ **Este bloco é o único da Visão geral que NÃO depende
                     * da telemetria.** Ele vem do DETRAN pela Smartec, e por
                     * isso responde mesmo para caminhão parado ou sem sinal,
                     * que é justamente quando alguém abre a ficha para saber
                     * se o veículo pode sair.
                     */}
                    <VehicleDocumentsCard detail={detail} />

                    {/*
                     * ⚠️ **Ocupa a LARGURA TODA, e é o último bloco da seção.**
                     * Cada guia é uma linha com valor, vencimento, PDF e linha
                     * digitável: espremida numa das três colunas ela quebra em
                     * quatro alturas diferentes e vira a parte mais confusa da
                     * ficha.
                     */}
                    <VehicleGuidesCard
                      vehicleId={demonstracao ? undefined : vehicle?.id}
                      className="xl:col-span-3"
                    />
                  </div>
                ) : null}

                {secao === 'viagens' ? (
                  <VehicleCard
                    title="Percursos do veículo"
                    icon={RouteIcon}
                    hint="Trechos medidos pela telemetria nos últimos 30 dias"
                  >
                    <QueryState
                      isPending={!demonstracao && percursosQuery.isPending}
                      isError={!demonstracao && percursosQuery.isError}
                      error={percursosQuery.error}
                      label="os percursos deste veículo"
                    >
                      {demonstracao ? (
                        <p className="text-on-light-muted text-body-md">
                          Percursos não são exibidos no veículo de demonstração.
                        </p>
                      ) : percursos.length === 0 ? (
                        <p className="text-on-light-muted text-body-md">
                          Nenhum percurso registrado para este veículo nos últimos 30 dias.
                        </p>
                      ) : (
                        <>
                          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Percursos
                              </dt>
                              <dd className="text-on-light font-sora tabular text-[26px] font-bold leading-none">
                                {percursos.length}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Distância
                              </dt>
                              <dd className="text-on-light font-sora tabular text-[26px] font-bold leading-none">
                                {km.format(
                                  percursos.reduce(
                                    (total, item) => total + (item.distanceKm ?? 0),
                                    0,
                                  ),
                                )}{' '}
                                km
                              </dd>
                            </div>
                            <div>
                              <dt className="text-on-light-muted text-label-sm normal-case">
                                Motorista
                              </dt>
                              <dd className="text-on-light text-body-md mt-1">
                                {percursos[0]?.driverName ?? 'Não identificado'}
                              </dd>
                            </div>
                          </dl>
                          <JourneyList journeys={percursos} />
                        </>
                      )}
                    </QueryState>
                  </VehicleCard>
                ) : null}

                {secao === 'manutencao' ? (
                  <VehicleMaintenance
                    vehicleId={vehicle.id}
                    odometroAtual={vehicle.odometerKm}
                    demonstracao={demonstracao}
                  />
                ) : null}

                {secao === 'oficinas' ? <VehiclePartnerShops position={posicao} /> : null}

                {secao === 'cliente' ? (
                  <VehicleCard title="Cliente" icon={UsersIcon} hint="A quem esta viagem atende">
                    <p className="text-on-light-variant text-body-md">
                      Não existe cadastro de cliente no RookHub. O veículo se vincula a uma{' '}
                      <strong>filial</strong> da transportadora, que hoje é{' '}
                      {vehicle.unit ?? 'sem filial definida'}.
                    </p>
                  </VehicleCard>
                ) : null}

                {secao === 'analise' ? (
                  <VehicleCard
                    title="Quilômetros por dia"
                    icon={ChartIcon}
                    hint="Medido pelos trechos do período"
                  >
                    <QueryState
                      isPending={!demonstracao && detailQuery.isPending}
                      isError={!demonstracao && detailQuery.isError}
                      error={detailQuery.error}
                      label="a análise"
                    >
                      {serie.length === 0 ? (
                        <p className="text-on-light-muted text-body-md">
                          Sem trechos registrados no período.
                        </p>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={serie}
                              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                            >
                              <defs>
                                <linearGradient id="km-dia" x1="0" y1="0" x2="0" y2="1">
                                  <stop
                                    offset="0%"
                                    stopColor="var(--secondary)"
                                    stopOpacity={0.22}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="var(--secondary)"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="dia"
                                tickLine={false}
                                axisLine={false}
                                fontSize={12}
                              />
                              <YAxis hide />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--color-light)',
                                  border: '1px solid var(--color-light-outline)',
                                  borderRadius: 12,
                                  color: 'var(--color-on-light)',
                                }}
                                formatter={(valor: unknown) =>
                                  [
                                    `${km.format(Math.round(Number(valor)))} km`,
                                    'Rodado no dia',
                                  ] as [string, string]
                                }
                              />
                              <Area
                                type="monotone"
                                dataKey="km"
                                stroke="var(--secondary)"
                                strokeWidth={2}
                                fill="url(#km-dia)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </QueryState>
                  </VehicleCard>
                ) : null}

                {secao === 'checklist' ? (
                  <VehicleChecklistCard vehicleId={vehicle.id} plate={vehicle.plate} />
                ) : null}

                {secao === 'historico' ? (
                  <MaintenanceHistory vehicleId={vehicle.id} odometroAtual={vehicle.odometerKm} />
                ) : null}

                {secao === 'notificacoes' ? (
                  <VehicleCard
                    title="Eventos de condução"
                    icon={BellIcon}
                    hint="Eventos que o rastreador registrou"
                  >
                    <QueryState
                      isPending={!demonstracao && detailQuery.isPending}
                      isError={!demonstracao && detailQuery.isError}
                      error={detailQuery.error}
                      label="os eventos de condução"
                    >
                      {(detail?.recentEvents ?? []).length === 0 ? (
                        <p className="text-on-light-muted text-body-md">
                          Nenhum evento registrado no período.
                        </p>
                      ) : (
                        <ul className="flex flex-col">
                          {detail?.recentEvents.map((evento) => (
                            <li
                              key={evento.id}
                              className="border-light-outline flex items-center gap-3 border-b py-2.5 last:border-b-0"
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'size-2 shrink-0 rounded-full',
                                  SEVERIDADE[evento.severity] ?? 'bg-info',
                                )}
                              />
                              <span className="text-on-light text-label-md min-w-0 flex-1 truncate normal-case">
                                {evento.label}
                              </span>
                              <span className="text-on-light-muted text-label-sm tabular normal-case">
                                {dataHora.format(new Date(evento.at))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </QueryState>
                  </VehicleCard>
                ) : null}
              </div>
            </div>
          )}
        </QueryState>
      </PageContent>

      {vehicle ? (
        <VehicleManualDialog
          open={manualAberto}
          onOpenChange={setManualAberto}
          vehicleId={vehicle.id}
          plate={vehicle.plate}
        />
      ) : null}
      {vehicle ? (
        <VehicleQrDialog
          open={qrAberto}
          onOpenChange={setQrAberto}
          vehicleId={vehicle.id}
          plate={vehicle.plate}
        />
      ) : null}
    </div>
  );
}
