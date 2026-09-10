import {
  ClockIcon,
  CloseIcon,
  GaugeIcon,
  MapPinIcon,
  LayersIcon,
  RadarIcon,
  RouteIcon,
  SatelliteIcon,
  TiltIcon,
  TruckIcon,
  SearchIcon,
} from '@/components/icons';
import type { VehiclePosition, VehicleStatus } from '@/management/types';
import { cn } from '@/management/ui';
import * as Popover from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MAP_BASES, type MapBaseId } from '@/components/shared/map-style';
import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import {
  VEHICLE_STATUS_LABELS,
  VehicleStatusChip,
} from '@/management/features/trucks/vehicle-status';

import { getEventHeatmap, getVehiclePositions, getVehicleTrack } from '../api';
import { CORES_DA_GESTAO } from '../components/fleet-3d-layer';
import { FleetMap, type FleetMapHandle } from '../components/fleet-map';
import { TrackReplay } from '../components/track-replay';
import { descreverLacuna, prepararTrajeto } from '../track-segments';
import { VehicleDrawer } from '../components/vehicle-drawer';

/**
 * De quanto em quanto tempo a tela repergunta a posição.
 *
 * Dez segundos, decisão do usuário em 30/08/2026. Sai daqui e não de dois
 * lugares: o intervalo aparece escrito na tela, e com o número repetido a
 * legenda passaria a mentir na primeira vez que alguém mexesse no outro.
 */
const REFETCH_MS = 10_000;

const STALE_SYNC_MINUTES = 30;

/**
 * Quanto tempo o aviso de veículos mudos fica na tela.
 *
 * Decisão do usuário em 30/08/2026: o aviso era uma faixa fixa acima do mapa,
 * ocupando uma linha inteira o tempo todo e empurrando o território para baixo.
 * Virou aviso flutuante que aparece, informa e sai.
 */
const AVISO_MS = 8000;

const isStale = (vehicle: VehiclePosition) =>
  (Date.now() - new Date(vehicle.lastSyncAt).getTime()) / 60_000 > STALE_SYNC_MINUTES;

/**
 * Há quanto tempo chegou a leitura mais recente da frota inteira.
 *
 * ⚠️ Este número é a VERDADE da tela, e o intervalo do polling não é.
 *
 * O chip dizia "atualização automática a cada 10 segundos", e o usuário
 * apontou a mentira em 30/08/2026. Os 10 segundos são de quanto em quanto
 * tempo a tela repergunta ao NOSSO banco. O banco só recebe posição nova
 * quando o coletor da MiX roda, num ciclo bem mais longo, e antes disso ainda
 * há o tempo que o rastreador leva para reportar à MiX. Perguntar dez vezes
 * por minuto por um dado que muda a cada vários minutos não deixa o dado mais
 * novo, só deixa a legenda mais otimista.
 *
 * Medir aqui, em vez de repetir o intervalo do coletor, é de propósito: o
 * número do backend é configuração (`MIX_COLLECTION_INTERVAL_MS`) e o atraso
 * do rastreador não é configurável por ninguém. O que se pode afirmar com
 * honestidade é a idade do dado que está na tela.
 */
function idadeDaLeitura(positions: VehiclePosition[]): number | null {
  if (positions.length === 0) return null;

  const maisRecente = Math.max(...positions.map((v) => new Date(v.lastSyncAt).getTime()));
  return Math.max(0, Date.now() - maisRecente);
}

/** "agora", "há 4 min", "há 2 h". */
function haQuantoTempo(ms: number): string {
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  return horas === 1 ? 'há 1 hora' : `há ${horas} horas`;
}

const SITUACOES: { id: VehicleStatus | 'TODOS'; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'EM_VIAGEM', label: 'Em viagem' },
  { id: 'DISPONIVEL', label: 'Disponíveis' },
  { id: 'MANUTENCAO', label: 'Manutenção' },
  { id: 'SEM_SINAL', label: 'Sem sinal' },
];

const TRACK_WINDOWS = [
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 72, label: '72h' },
] as const;

/**
 * A legenda das cores do mapa.
 *
 * ⚠️ **Derivada, e nunca escrita à mão.** As cores vêm de `CORES_DA_GESTAO`, que
 * é a mesma constante que pinta os caminhões, e os rótulos de
 * `VEHICLE_STATUS_LABELS`, que é o nome que o resto do sistema dá a cada estado.
 *
 * A versão anterior era uma lista fixa de três itens e mentia por omissão: os
 * caminhões cinza (sem sinal) e os vermelhos (bloqueado) apareciam no mapa sem
 * nada que os explicasse, e um deles é justamente o segundo estado mais comum da
 * frota (relatado pelo usuário em 30/08/2026). Escrever à mão significa que
 * qualquer status novo nasce invisível na legenda; derivando, ele aparece
 * sozinho.
 *
 * Ela também dizia "Atenção" onde o sistema inteiro diz "Manutenção", que é o
 * tipo de sinônimo que faz a pessoa procurar um filtro que não existe.
 */
const LEGENDA = (Object.keys(CORES_DA_GESTAO) as VehicleStatus[]).map((status) => ({
  status,
  cor: CORES_DA_GESTAO[status],
  label: VEHICLE_STATUS_LABELS[status],
}));

const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function locationLabel(vehicle: VehiclePosition) {
  return (
    vehicle.place ?? `${vehicle.coordinates[1].toFixed(4)}, ${vehicle.coordinates[0].toFixed(4)}`
  );
}

/**
 * Cartão flutuante sobre o mapa.
 *
 * ⚠️ **É a MESMA receita do mapa da operação** (`components/shared/operation-map`),
 * a pedido do usuário em 30/08/2026: papel a 80%, traço de divisória, canto
 * pequeno e desfoque padrão. São dois mapas do mesmo produto, e a informação que
 * flutua sobre eles não pode ter dois desenhos.
 *
 * Os tokens têm nomes diferentes nos dois lados e apontam para os mesmos
 * valores: `background`, `border` e `muted-foreground` do painel operacional
 * são aliases de `surface`, `outline-variant` e `on-surface-muted`, declarados
 * em `globals.css`. Aqui usa-se o nome da gestão, que é a convenção da pasta.
 *
 * ⚠️ O caminho até aqui passou por duas versões recusadas, e as duas valem como
 * aviso. A primeira era uma placa quase preta: sobre o Liberty, que é um mapa
 * claro, ela não lê como vidro, lê como buraco. A segunda era branco puro com
 * desfoque muito forte, que ficava mais pesado que o mapa. O papel a 80% é o que
 * deixa o território aparecer sem disputar com ele.
 *
 * ⚠️ Quem garante a leitura é a camada de papel, e não o desfoque. O
 * `backdrop-blur` só dissolve a malha de ruas; ele não escurece nem clareia
 * nada, e um cartão com blur e fundo transparente fica ilegível sobre mapa
 * detalhado.
 */
const SOBRE_O_MAPA =
  'border-outline-variant bg-surface/80 text-on-surface-muted pointer-events-auto rounded-md border backdrop-blur';

export function LiveMapPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-positions'],
    queryFn: getVehiclePositions,
    refetchInterval: REFETCH_MS,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackHours, setTrackHours] = useState(24);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<VehicleStatus | 'TODOS'>('TODOS');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showHeat, setShowHeat] = useState(false);
  const [trajetoAberto, setTrajetoAberto] = useState(false);
  /* A base escolhida na tela e o ângulo da câmera (05/09/2026). A base vence o
     tema: quem escolheu o noturno escolheu o noturno. */
  const [base, setBase] = useState<MapBaseId>('liberty');
  /* ⚠️ Nasce ligado porque o mapa é criado já inclinado (pedido do usuário em
     05/09/2026, em `fleet-map.tsx`). Com `false` aqui, o botão abriria apagado
     sobre um mapa inclinado, e o primeiro clique pareceria não fazer nada: ele
     desinclinaria, que é o contrário do que o ícone prometia. */
  const [inclinado, setInclinado] = useState(true);
  const [menuDeBase, setMenuDeBase] = useState(false);
  /**
   * A ficha DESENHADA no drawer, que não é a mesma coisa que a seleção.
   *
   * ⚠️ Ela sobrevive ao fechamento até a animação terminar. Sem isso não há
   * animação de saída nenhuma: o conteúdo desmonta no clique e o que resta é a
   * largura encolhendo sozinha.
   */
  const [fichaId, setFichaId] = useState<string | null>(null);

  /* O caminhão do replay é escrito direto na fonte do MapLibre por este handle.
     Ver a nota em `TrackReplay`: passar a posição por estado re-renderizava a
     página inteira sessenta vezes por segundo. */
  const mapa = useRef<FleetMapHandle>(null);

  /* A moldura é o retângulo inteiro do mapa, painéis flutuantes incluídos. */
  const molduraDoMapa = useRef<HTMLDivElement>(null);

  const listaDeVeiculos = useRef<HTMLUListElement>(null);

  /**
   * A lista acompanha quem foi escolhido NO MAPA.
   *
   * Pedido do usuário em 09/09/2026. Escolher um caminhão no mapa já marcava a
   * linha dele na lista, mas a marca podia estar a trinta placas de distância,
   * fora da área visível: a tela dizia "este aqui" apontando para um lugar que
   * ninguém estava vendo.
   *
   * ⚠️ Quem rola é a LISTA, na mão, e não `scrollIntoView`. Aquele método sobe
   * rolando todos os ancestrais roláveis até achar espaço, e o de cima é a
   * PÁGINA: usá-lo aqui traria de volta o solavanco vertical que o ouvinte da
   * roda acabou de resolver. Mexer no `scrollTop` da própria lista não sai dela.
   *
   * ⚠️ Item já visível fica onde está. Centralizar sempre faria a lista pular a
   * cada clique nela mesma, inclusive quando a linha escolhida já estava debaixo
   * do cursor, que é movimento sem motivo.
   */
  useEffect(() => {
    if (!selectedId) return;

    const lista = listaDeVeiculos.current;
    const item = lista?.querySelector<HTMLElement>(`[data-vehicle-id="${selectedId}"]`);
    if (!lista || !item) return;

    const caixaDaLista = lista.getBoundingClientRect();
    const caixaDoItem = item.getBoundingClientRect();

    const acimaDaVista = caixaDoItem.top < caixaDaLista.top;
    const abaixoDaVista = caixaDoItem.bottom > caixaDaLista.bottom;
    if (!acimaDaVista && !abaixoDaVista) return;

    const paraCentralizar =
      caixaDoItem.top - caixaDaLista.top - (caixaDaLista.height - caixaDoItem.height) / 2;

    lista.scrollBy({
      top: paraCentralizar,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [selectedId]);

  /**
   * Roda do mouse dentro da moldura é ZOOM, nunca rolagem da página.
   *
   * ⚠️ Relatado pelo usuário em 09/09/2026: no meio de um zoom a página dava um
   * solavanco vertical, mesmo com o cursor sobre o mapa. A causa é de estrutura,
   * e não do MapLibre: ele só escuta `wheel` no container dele, e a legenda, a
   * barra do topo e o painel do trajeto são IRMÃOS desse container, desenhados
   * por cima. Girar a roda sobre qualquer um deles nunca chegava ao mapa, e o
   * navegador rolava a página. Quem usa não distingue as duas camadas: para essa
   * pessoa o cursor está no mapa, e o que ela pede é zoom.
   *
   * O ouvinte fica na CAPTURA da moldura, que é o único ponto por onde todo giro
   * passa, seja qual for o painel embaixo do cursor.
   */
  useEffect(() => {
    const moldura = molduraDoMapa.current;
    if (!moldura) return;

    const aoGirarARoda = (evento: WheelEvent) => {
      /* O reenvio feito por `zoomComRoda` volta a passar por aqui na descida da
         captura. Só o giro de verdade é tratado, senão vira laço. */
      if (!evento.isTrusted) return;

      const alvo = evento.target;
      const noProprioMapa = alvo instanceof Element && alvo.closest('.maplibregl-map') !== null;

      /* A página não rola em ponto nenhum da moldura. Sobre o próprio mapa o
         MapLibre já faria isso; sobre um painel, não havia ninguém para fazer. */
      evento.preventDefault();
      if (!noProprioMapa) mapa.current?.zoomComRoda(evento);
    };

    moldura.addEventListener('wheel', aoGirarARoda, { passive: false, capture: true });
    return () => moldura.removeEventListener('wheel', aoGirarARoda, { capture: true });
  }, []);

  const heatQuery = useQuery({
    queryKey: ['event-heatmap'],
    queryFn: () => getEventHeatmap(7),
    enabled: showHeat,
    staleTime: 5 * 60_000,
  });

  const trackQuery = useQuery({
    queryKey: ['vehicle-track', selectedId, trackHours],
    queryFn: () => getVehicleTrack(selectedId as string, trackHours),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
  });

  const positions = useMemo(() => data ?? [], [data]);
  const staleCount = positions.filter(isStale).length;
  const idade = idadeDaLeitura(positions);
  /* Ver `idadeDaLeitura`: o que a pastilha promete é a idade do DADO, e não o
     intervalo do polling. */
  const leituraEmDia = idade != null && idade <= STALE_SYNC_MINUTES * 60_000;

  const visibleVehicles = useMemo(() => {
    const term = busca.trim().toLowerCase();

    return positions.filter((vehicle) => {
      if (situacao !== 'TODOS' && vehicle.status !== situacao) return false;
      if (!term) return true;

      return (
        vehicle.plate.toLowerCase().includes(term) ||
        (vehicle.driverName ?? '').toLowerCase().includes(term)
      );
    });
  }, [positions, busca, situacao]);

  const countByStatus = useMemo(() => {
    const counts = new Map<VehicleStatus, number>();
    for (const vehicle of positions) {
      counts.set(vehicle.status, (counts.get(vehicle.status) ?? 0) + 1);
    }
    return counts;
  }, [positions]);

  const selectedVehicle = useMemo(
    () => positions.find((vehicle) => vehicle.vehicleId === selectedId) ?? null,
    [positions, selectedId],
  );

  /* O veículo que o drawer está mostrando: continua o anterior enquanto ele
     desliza para fora. */
  const fichaVeiculo = useMemo(
    () => positions.find((vehicle) => vehicle.vehicleId === fichaId) ?? null,
    [positions, fichaId],
  );

  /*
   * ⚠️ Trocar de veículo fecha o trajeto, e isso é feito AQUI e não num efeito.
   *
   * O trajeto é de uma placa só: aberto, ele mostraria a rota da anterior
   * enquanto a nova carrega. Sincronizar isso com `useEffect` é erro de lint
   * neste projeto, e a regra tem razão (renderiza duas vezes por clique). O
   * lugar certo é o handler, que é quem sabe que houve uma troca.
   */
  const select = useCallback(
    (vehicleId: string) => {
      setSelectedId(vehicleId);
      setFichaId(vehicleId);
      if (vehicleId !== selectedId) setTrajetoAberto(false);
    },
    [selectedId],
  );

  /**
   * Fechar limpa a SELEÇÃO, e não a ficha desenhada.
   *
   * ⚠️ É o que faz o drawer ter animação de saída. Desmontando o conteúdo junto
   * com a seleção, a ficha sumia no ato e só a largura animava: pela metade, um
   * drawer que abre deslizando e fecha piscando. Quem apaga a ficha é o fim da
   * transição, lá embaixo.
   */
  const limparSelecao = useCallback(() => {
    setSelectedId(null);
    setTrajetoAberto(false);
  }, []);

  /* O `??` sai do caminho do `useMemo` abaixo: um literal `[]` novo a cada
     render invalidaria a memória em todo quadro, que é o oposto do que ela
     existe para fazer. */
  const trackPoints = useMemo(() => trackQuery.data ?? [], [trackQuery.data]);

  /*
   * A rota separada em trechos medidos e lacunas.
   *
   * ⚠️ Derivado em RENDER, e não em efeito com estado: o resultado depende só
   * dos pontos, e guardá-lo em `useState` criaria um quadro em que a linha e
   * os pontos discordam. O `useMemo` existe pelo custo, não pela correção: são
   * até milhares de leituras por abertura.
   */
  const trajeto = useMemo(() => prepararTrajeto(trackPoints), [trackPoints]);

  /**
   * O aviso de veículos mudos, flutuante.
   *
   * ⚠️ A guarda pelo número anterior é o que torna isto usável. A tela
   * repergunta a cada dez segundos, e sem ela o mesmo aviso reapareceria seis
   * vezes por minuto até virar ruído que se aprende a ignorar. Ele volta quando
   * a CONTAGEM muda, que é quando há de fato algo novo a dizer.
   */
  const avisado = useRef<number | null>(null);
  useEffect(() => {
    if (staleCount === 0) {
      avisado.current = 0;
      return;
    }
    if (avisado.current === staleCount) return;
    avisado.current = staleCount;

    toast.warning(
      staleCount === 1
        ? '1 veículo há mais de 30 minutos sem sincronizar'
        : `${staleCount} veículos há mais de 30 minutos sem sincronizar`,
      {
        description: 'Confirme as posições antes de tomar uma decisão.',
        duration: AVISO_MS,
        /* Um id fixo troca o conteúdo do aviso que já está na tela em vez de
           empilhar um segundo: a contagem pode mudar duas vezes seguidas. */
        id: 'mapa-sem-sincronizar',
      },
    );
  }, [staleCount]);

  const semSinal = countByStatus.get('SEM_SINAL') ?? 0;

  const stats: HeroStat[] = [
    {
      key: 'rastreada',
      label: 'Frota rastreada',
      value: positions.length,
      hint: 'veículos com posição conhecida',
      icon: RadarIcon,
    },
    {
      key: 'viagem',
      label: 'Em viagem',
      value: countByStatus.get('EM_VIAGEM') ?? 0,
      hint: 'rodando agora',
      icon: RouteIcon,
    },
    {
      key: 'disponiveis',
      label: 'Disponíveis',
      value: countByStatus.get('DISPONIVEL') ?? 0,
      hint: 'prontos para sair',
      icon: TruckIcon,
    },
    {
      key: 'sem-sinal',
      label: 'Sem sinal',
      value: semSinal,
      hint: 'a parte da frota sobre a qual não se sabe',
      icon: SatelliteIcon,
      tone: semSinal > 0 ? 'alert' : 'neutral',
    },
  ];

  return (
    <>
      <HeroBand
        title="Mapa ao vivo"
        description="Uma central de comando para acompanhar a frota e agir antes que a operação pare."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Situação da frota</h2>

        <QueryState isPending={isPending} isError={isError} label="as posições">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela puxaria também o estado de carregando para dentro da faixa. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 pb-24 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="as posições">
          {/*
            Os filtros de situação subiram para cá em 05/09/2026, a pedido do
            usuário: eles dividem a linha com o chip da leitura, e a lista à
            esquerda ficou só com a busca por placa.

            ⚠️ As contagens continuam sendo sobre a frota INTEIRA, e não sobre o
            que está filtrado. Seguindo o filtro, escolher "sem sinal" zeraria os
            outros números e quem opera perderia a noção do todo, que é a mesma
            regra já registrada para a fila de impedimentos.
          */}
          {/*
           * ⚠️ Mesmo desenho das abas da página (`PageTabs`), a pedido do
           * usuário em 08/09/2026: trilho de poço e o escolhido é a pastilha
           * clara que SOBE dele, com a escrita na secundária. Os dois são a
           * mesma coisa (um segmentado que filtra uma lista) e não faziam
           * sentido com desenhos diferentes na mesma tela.
           *
           * Tokens `light` e não `surface`: aqui a barra vive dentro do painel
           * branco, e o trilho do `PageTabs` mora sobre o papel.
           */}
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div
              role="group"
              aria-label="Filtrar por situação"
              className="bg-light-container rounded-pill flex w-fit max-w-full gap-1 overflow-x-auto p-1.5"
            >
              {SITUACOES.map((option) => {
                const total =
                  option.id === 'TODOS' ? positions.length : (countByStatus.get(option.id) ?? 0);
                if (total === 0 && option.id !== 'TODOS') return null;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSituacao(option.id)}
                    aria-pressed={situacao === option.id}
                    className={cn(
                      'group text-body-md rounded-pill focus-visible:ring-primary shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
                      situacao === option.id
                        ? 'bg-light text-accent font-medium shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)]'
                        : 'text-on-light-variant hover:text-on-light hover:bg-on-light/[0.06]',
                    )}
                  >
                    {option.label}
                    <span
                      className={cn(
                        'tabular ml-2 opacity-70',
                        situacao === option.id && 'opacity-100',
                      )}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>

            {/*
             * ⚠️ O frescor da leitura VOLTOU para esta linha em 09/09/2026, a
             * pedido do usuário, depois de ter morado na faixa laranja. São as
             * duas coisas que respondem "o que estou vendo agora": o filtro diz
             * qual recorte da frota, e a pastilha diz de quando é o dado. Lidas
             * juntas, uma qualifica a outra.
             *
             * ⚠️ Aqui o desenho é o do PAINEL CLARO, e não o da faixa: em dia
             * ela é LARANJA (pedido do usuário em 09/09/2026), no tom que o
             * painel usa para a marca; atrasada, vira âmbar sobre âmbar
             * transparente, que é a pastilha de alerta que o resto do painel já
             * usa. Sobre a faixa laranja nenhum dos dois se lia, que foi o
             * motivo de ela ter ido embora dali com outro desenho.
             *
             * ⚠️ O estado atrasado NÃO virou laranja junto, e a diferença é o
             * que sustenta o aviso: laranja é a cor de sempre desta tela, então
             * uma pastilha laranja não avisa nada. O âmbar é o que separa "o
             * dado é de agora" de "o dado envelheceu".
             *
             * ⚠️ O deslocamento é TRANSFORM, e não margem (pedido do usuário no
             * mesmo dia: descer só ela). Margem empurraria a linha inteira e
             * moveria o segmentado de filtros junto; `translate` não ocupa
             * espaço no layout, então nada mais sai do lugar.
             */}
            <span
              className={cn(
                'text-label-md rounded-pill ml-auto inline-flex shrink-0 translate-y-2 items-center gap-2 px-4 py-2 normal-case',
                leituraEmDia
                  ? 'bg-primary-on-light/10 text-primary-on-light'
                  : 'bg-warning-on-light/12 text-warning-on-light font-medium',
              )}
              title={`A tela confere o banco a cada ${REFETCH_MS / 1000} segundos. A posição em si só muda quando a coleta da MiX traz leitura nova, num ciclo bem mais longo.`}
            >
              <ClockIcon size={15} aria-hidden="true" />
              {idade == null
                ? 'Sem leitura recebida'
                : `Leitura mais recente ${haQuantoTempo(idade)}`}
            </span>
          </div>

          {/*
           * ⚠️ A lista à ESQUERDA e o mapa à direita, e as duas colunas com a
           * MESMA altura.
           *
           * A leitura vai do painel para o território: quem opera procura uma
           * placa na lista e confirma onde ela está, e não o contrário. Com a
           * lista à direita o olho atravessava o mapa inteiro a cada consulta.
           *
           * A altura é da LINHA do grid, e não de cada peça: `items-stretch`
           * (padrão do grid) mais `h-full` nos dois filhos. Antes o mapa tinha
           * altura própria e a lista tinha `max-h-[620px]`, então uma sobrava
           * enquanto a outra faltava, e a diferença mudava com a largura da
           * tela.
           *
           * ⚠️ A TERCEIRA coluna só existe com um veículo escolhido (pedido do
           * usuário em 30/08/2026). Os detalhes moravam dentro da lista, entre
           * os filtros e as placas, e empurravam a lista inteira para baixo toda
           * vez que alguém clicava: a placa recém-escolhida saía do campo de
           * visão no instante em que era escolhida. Sem seleção a coluna não
           * ocupa espaço, e o mapa recebe a largura de volta.
           */}
          <section
            className={cn(
              'grid gap-5 2xl:h-[clamp(32rem,calc(100dvh-30rem),52rem)]',
              /*
               * ⚠️ Duas colunas SEMPRE, desde 05/09/2026.
               *
               * A ficha era uma terceira coluna e virou drawer, a pedido do
               * usuário. Quem encolhe com o drawer aberto é o MAPA, e não a
               * lista: a lista tem largura de leitura, e espremê-la quebraria a
               * placa em duas linhas.
               */
              '2xl:grid-cols-[360px_minmax(0,1fr)]',
            )}
          >
            {/* ⚠️ SEM moldura de cartão (pedido do usuário em 05/09/2026): sem
                borda, sem canto e sem fundo próprio, a lista encosta na margem
                da tela e devolve o espaço que a caixa tomava. O que separa a
                lista do mapa é o vão do grid, e não um traço. */}
            <aside className="flex min-h-0 flex-col pr-1">
              {/* ⚠️ SEM o selo de caminhão que ficava à direita do título (pedido do
                  usuário em 05/09/2026). Ele era decoração: não clicava, não
                  informava nada que o título já não dissesse, e num cabeçalho sem
                  moldura sobrava como um botão que não é botão. */}
              <div>
                <p className="text-on-surface text-body-md font-semibold">Monitoramento da frota</p>
                <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                  {visibleVehicles.length} de {positions.length} veículos
                </p>
              </div>

              <label className="border-outline-variant bg-surface-lowest mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5">
                <SearchIcon
                  size={17}
                  className="text-on-surface-muted shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">Buscar por placa ou motorista</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Placa ou motorista"
                  className="text-on-surface placeholder:text-on-surface-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>

              <ul
                ref={listaDeVeiculos}
                className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
                aria-label="Veículos encontrados"
              >
                {visibleVehicles.map((vehicle) => {
                  const active = vehicle.vehicleId === selectedId;
                  const stale = isStale(vehicle);

                  return (
                    <li key={vehicle.vehicleId} data-vehicle-id={vehicle.vehicleId}>
                      <button
                        type="button"
                        onClick={() => select(vehicle.vehicleId)}
                        onMouseEnter={() => setHoveredId(vehicle.vehicleId)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(vehicle.vehicleId)}
                        onBlur={() => setHoveredId(null)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'border-outline-variant w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active
                            ? 'border-primary-strong bg-primary-strong text-on-primary'
                            : 'bg-surface-lowest hover:border-primary-strong/45 hover:bg-surface-high',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'tabular text-sm font-semibold',
                              active ? 'text-on-primary' : 'text-on-surface',
                            )}
                          >
                            {vehicle.plate}
                          </span>
                          {/*
                           * ⚠️ O chip aparece TAMBÉM no cartão selecionado.
                           *
                           * Ele era escondido ali, e o efeito era perder a única
                           * informação que diz o estado do veículo justamente no
                           * cartão que a pessoa está olhando. A razão de esconder
                           * era boa (as duas superfícies do chip contam com fundo
                           * neutro e somem sobre o indigo cheio), mas a solução
                           * era errada: em vez de tirar, dar a ele um fundo.
                           *
                           * Sólido, e não translúcido: um véu deixa o indigo
                           * atravessar e derruba o contraste da cor semântica,
                           * que é o que separa "em viagem" de "sem sinal".
                           */}
                          <VehicleStatusChip
                            status={vehicle.status}
                            surface={active ? 'light' : 'dark'}
                            {...(active ? { className: 'bg-surface-container' } : {})}
                          />
                        </span>

                        <span
                          className={cn(
                            'mt-2 flex items-center gap-1.5 text-xs',
                            active ? 'text-on-primary/80' : 'text-on-surface-muted',
                          )}
                        >
                          <MapPinIcon size={13} aria-hidden="true" />
                          <span className="truncate">{locationLabel(vehicle)}</span>
                        </span>

                        <span
                          className={cn(
                            'mt-2 flex items-center justify-between gap-3 text-xs',
                            active ? 'text-on-primary/80' : 'text-on-surface-muted',
                          )}
                        >
                          <span className="tabular inline-flex items-center gap-1.5">
                            <GaugeIcon size={13} aria-hidden="true" />
                            {vehicle.speedKmh.toLocaleString('pt-BR', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            km/h
                          </span>
                          <span className={cn('tabular', stale && !active && 'text-warning')}>
                            {stale ? 'sem sinal desde ' : 'às '}
                            {time.format(new Date(vehicle.lastSyncAt))}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/*
              Empilhado, o mapa vem primeiro: é o que a tela existe para
              mostrar. Lado a lado, ele vai para a direita.

              ⚠️ O mapa e o drawer são IRMÃOS numa linha flex, e não um por cima
              do outro. Foi o pedido do usuário em 05/09/2026: o mapa encolhe
              enquanto a ficha está aberta e volta a esticar quando ela fecha.
              Sobreposto, o drawer taparia justamente o caminhão que a pessoa
              acabou de escolher.
            */}
            <div className="order-first flex min-w-0 2xl:order-none">
              <div className="flex min-w-0 flex-1 flex-col">
                {/*
                ⚠️ Fundo de PAPEL, e não o grafite de antes.
                
                O container tem canto de 20px e o mapa dentro dele tinha canto
                próprio, menor: a diferença entre os dois raios deixava quatro
                lascas do fundo aparecendo nos cantos, e com o fundo escuro elas
                liam como bordas pretas enquanto o mapa carregava (relatado pelo
                usuário em 30/08/2026). O raio interno saiu, porque o
                `overflow-hidden` daqui já corta, e o que sobra do fundo agora é
                da cor do papel.
              */}
                <div
                  ref={molduraDoMapa}
                  className={cn(
                    'border-outline-variant bg-surface-lowest relative min-h-0 flex-1 overflow-hidden rounded-2xl border',
                    /* Canto reto do lado da gaveta: com o arredondado, sobrava uma
                     lasca de fundo entre o mapa e o painel, e os dois pareciam
                     duas peças soltas em vez de uma gaveta encostada. */
                    selectedVehicle && '2xl:rounded-r-none 2xl:border-r-0',
                  )}
                >
                  <FleetMap
                    ref={mapa}
                    positions={positions}
                    basemap={base}
                    selectedId={selectedId}
                    onSelect={select}
                    /*
                     * ⚠️ A rota só desce para o mapa com o painel aberto, e isso
                     * não é economia: é o `FleetMap` que enquadra o trajeto
                     * inteiro ao recebê-lo. Mandando sempre, escolher uma placa
                     * afastaria a câmera para caber o dia todo, desfazendo o foco
                     * no veículo que acabou de ser pedido.
                     */
                    track={trajetoAberto ? trajeto : undefined}
                    heat={showHeat ? heatQuery.data : undefined}
                    hoveredId={hoveredId}
                    className="h-full min-h-[560px]"
                  />

                  {/*
                   * A barra do topo (pedido do usuário em 30/08/2026): legenda à
                   * esquerda, porque ela explica o crachá e precisa estar onde o
                   * olho entra no mapa; mapa de calor à direita, que é onde o
                   * usuário pediu.
                   *
                   * ⚠️ O canto direito só ficou livre porque o zoom do MapLibre
                   * desceu para o rodapé (ver `fleet-map.tsx`). Devolver o zoom
                   * para cima traz de volta a sobreposição.
                   */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                    <div
                      className={cn(
                        SOBRE_O_MAPA,
                        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11px]',
                      )}
                    >
                      {LEGENDA.map((item) => (
                        <span key={item.status} className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.cor }}
                            aria-hidden="true"
                          />
                          {item.label}
                        </span>
                      ))}
                    </div>

                    {/*
                      Os três controles do mapa, juntos e em ÍCONE.

                      ⚠️ Eram um cartão de duas linhas (eventos), mais um grupo
                      de pastilhas e um botão no canto de baixo. Viraram uma
                      barra só, a pedido do usuário em 05/09/2026: o painel de
                      referência dele agrupa os controles do mapa num canto e
                      deixa o território livre, e três caixas em dois cantos
                      diferentes competiam com o que a tela existe para mostrar.

                      O que era legenda de duas linhas virou `title`: quem opera
                      todo dia não precisa ler "ative o mapa de calor" a cada
                      abertura da tela.
                    */}
                    <div className="pointer-events-auto flex items-center gap-2">
                      {/*
                        ⚠️ MENU, e não cinco pastilhas lado a lado.

                        Em linha, os cinco modos mais a legenda mais os dois
                        ícones não cabem na largura do mapa com a ficha aberta:
                        eles quebravam para a linha de baixo e saíam do canto.
                        Fechado, o menu ocupa a largura de um rótulo.
                      */}
                      <Popover.Root open={menuDeBase} onOpenChange={setMenuDeBase}>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className={cn(
                              SOBRE_O_MAPA,
                              'focus-visible:ring-primary-strong hover:bg-surface hover:text-on-surface flex h-9 items-center gap-1.5 px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
                            )}
                            aria-label="Modo do mapa"
                          >
                            <LayersIcon size={14} aria-hidden="true" />
                            {MAP_BASES.find((opcao) => opcao.id === base)?.label}
                          </button>
                        </Popover.Trigger>

                        <Popover.Portal>
                          <Popover.Content
                            align="end"
                            sideOffset={6}
                            className="bg-surface border-outline-variant z-50 flex w-44 flex-col rounded-md border p-1 shadow-lg"
                          >
                            {MAP_BASES.map((opcao) => (
                              <button
                                key={opcao.id}
                                type="button"
                                onClick={() => {
                                  setBase(opcao.id);
                                  setMenuDeBase(false);
                                }}
                                aria-pressed={base === opcao.id}
                                title={opcao.hint}
                                className={cn(
                                  'focus-visible:ring-primary-strong rounded px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
                                  base === opcao.id
                                    ? 'bg-primary-strong text-on-primary'
                                    : 'text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface',
                                )}
                              >
                                {opcao.label}
                              </button>
                            ))}
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>

                      <button
                        type="button"
                        onClick={() => setInclinado(mapa.current?.alternarInclinacao() ?? false)}
                        aria-pressed={inclinado}
                        className={cn(
                          'focus-visible:ring-primary-strong flex size-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2',
                          inclinado
                            ? 'border-primary-strong bg-primary-strong text-on-primary rounded-md border'
                            : cn(SOBRE_O_MAPA, 'hover:bg-surface hover:text-on-surface'),
                        )}
                        aria-label={inclinado ? 'Voltar à vista de cima' : 'Inclinar o mapa'}
                        title={inclinado ? 'Voltar à vista de cima' : 'Inclinar o mapa'}
                      >
                        <TiltIcon size={16} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowHeat((value) => !value)}
                        aria-pressed={showHeat}
                        className={cn(
                          'focus-visible:ring-primary-strong flex size-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2',
                          showHeat
                            ? 'border-primary-strong bg-primary-strong text-on-primary rounded-md border'
                            : cn(SOBRE_O_MAPA, 'hover:bg-surface hover:text-on-surface'),
                        )}
                        aria-label="Eventos na rota"
                        title={
                          showHeat
                            ? heatQuery.isPending
                              ? 'Eventos na rota: carregando concentrações'
                              : `Eventos na rota: ${(heatQuery.data ?? []).length.toLocaleString('pt-BR')} pontos nos últimos 7 dias`
                            : 'Eventos na rota: ativar o mapa de calor'
                        }
                      >
                        <RadarIcon size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Controles do canto inferior esquerdo. */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-4 sm:p-5">
                    {trajetoAberto && selectedVehicle ? (
                      <section
                        aria-label={`Trajeto de ${selectedVehicle.plate}`}
                        className={cn(SOBRE_O_MAPA, 'w-full max-w-xl p-3')}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-on-surface text-xs font-semibold">
                              Trajeto de {selectedVehicle.plate}
                            </p>
                            <p className="mt-0.5 text-[11px]">
                              {trackQuery.isPending
                                ? 'Traçando rota'
                                : trackQuery.isError
                                  ? 'Não foi possível carregar a rota'
                                  : trackPoints.length < 2
                                    ? 'Sem leituras suficientes no período'
                                    : `${trackPoints.length.toLocaleString('pt-BR')} pontos para consultar`}
                            </p>
                            {/*
                              ⚠️ A lacuna é DITA, e não só desenhada. O tracejado
                              no mapa mostra onde faltou leitura, mas só entende
                              quem já sabe o que ele significa. A frase diz
                              quantos vãos existem e o tamanho do maior, que é o
                              número que decide se a rota serve para responder
                              "por onde ele passou".
                            */}
                            {trajeto.lacunas.length > 0 ? (
                              <p className="text-on-surface-muted mt-0.5 text-[11px]">
                                {trajeto.lacunas.length === 1
                                  ? '1 trecho sem leitura'
                                  : `${trajeto.lacunas.length} trechos sem leitura`}
                                {', o maior de '}
                                {descreverLacuna(
                                  Math.max(...trajeto.lacunas.map((lacuna) => lacuna.minutos)),
                                )}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="bg-on-surface/8 flex gap-1 rounded-full p-1">
                              {TRACK_WINDOWS.map((window) => (
                                <button
                                  key={window.hours}
                                  type="button"
                                  onClick={() => setTrackHours(window.hours)}
                                  aria-pressed={trackHours === window.hours}
                                  className={cn(
                                    'focus-visible:ring-primary-strong rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
                                    trackHours === window.hours
                                      ? 'bg-primary-strong text-on-primary'
                                      : 'text-on-surface-variant hover:text-on-surface',
                                  )}
                                >
                                  {window.label}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => setTrajetoAberto(false)}
                              className="acao-neutra focus-visible:ring-primary-strong flex size-7 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2"
                              aria-label="Fechar o trajeto"
                              title="Fechar o trajeto"
                            >
                              <CloseIcon size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {trackPoints.length >= 2 ? (
                          <TrackReplay
                            key={`${selectedId}-${trackHours}`}
                            points={trackPoints}
                            onPose={(pose) => mapa.current?.setReplayPose(pose)}
                            onPlayingChange={(tocando) => mapa.current?.seguirReplay(tocando)}
                            className="border-outline-variant/60 bg-on-surface/[0.04] mt-3 rounded-md border p-2.5"
                          />
                        ) : null}
                      </section>
                    ) : null}

                    {selectedVehicle && !trajetoAberto ? (
                      <button
                        type="button"
                        onClick={() => setTrajetoAberto(true)}
                        className={cn(
                          SOBRE_O_MAPA,
                          'focus-visible:ring-primary-strong hover:text-on-surface hover:bg-surface flex size-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2',
                        )}
                        aria-label={`Ver o trajeto de ${selectedVehicle.plate}`}
                        title={`Trajeto de ${selectedVehicle.plate}`}
                      >
                        <RouteIcon size={18} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/*
                O DRAWER da ficha, e ele é um drawer de verdade.

                São duas animações ao mesmo tempo, e as duas precisam existir:

                1. A LARGURA do `aside`, que é o que faz o mapa encolher e
                   esticar. Quem avisa o MapLibre a cada passo é o
                   `ResizeObserver` do FleetMap; sem ele o canvas fica do tamanho
                   antigo e o clique sai deslocado do que se vê.
                2. O DESLIZE do painel, que entra e sai pela direita. Sem ele o
                   conteúdo aparecia de um quadro para o outro dentro de uma
                   caixa que crescia, que é meio drawer: abria deslizando e
                   fechava piscando (apontado pelo usuário em 05/09/2026).

                ⚠️ O conteúdo continua montado durante a saída, por causa do
                `fichaVeiculo`. Desmontar junto com a seleção deixava a caixa
                encolher vazia, e a animação de saída não existia de fato. Quem
                apaga a ficha é o `onTransitionEnd`, depois que ela terminou.
              */}
              <aside
                aria-label={fichaVeiculo ? `Detalhes de ${fichaVeiculo.plate}` : undefined}
                aria-hidden={selectedVehicle ? undefined : true}
                onTransitionEnd={(evento) => {
                  /* Só a transição de LARGURA deste elemento encerra a ficha: o
                     deslize do painel de dentro também borbulha até aqui, e sem
                     o filtro a ficha sumiria no meio da animação. */
                  if (evento.target === evento.currentTarget && evento.propertyName === 'width') {
                    if (!selectedId) setFichaId(null);
                  }
                }}
                className={cn(
                  'relative hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-out 2xl:block',
                  /*
                   * ⚠️ A margem NEGATIVA é o que leva a gaveta até a borda da
                   * tela (pedido do usuário em 05/09/2026): a página tem
                   * `xl:px-10`, e sem cancelar esse respiro sobrava uma faixa de
                   * fundo à direita, como se a gaveta tivesse parado antes de
                   * chegar. Ela entra na MESMA transição da largura, senão os 40
                   * pixels apareceriam de um quadro para o outro.
                   *
                   * O 40 é literal de propósito: a gaveta só existe a partir de
                   * 2xl, e nessa largura o respiro da página é sempre o
                   * `xl:px-10`. Mudar o padding da página pede mudar aqui.
                   */
                  selectedVehicle ? 'w-[380px] -mr-10' : 'mr-0 w-0',
                )}
              >
                {/*
                  ⚠️ O painel fica SEMPRE montado, ancorado na direita.

                  Montado só quando há ficha, ele nasceria já na posição aberta e
                  a entrada não animaria: transição precisa de um estado anterior
                  para sair dele. Ancorado à direita, ele desliza para dentro
                  enquanto a caixa abre, e para fora enquanto ela fecha, que é o
                  movimento de um drawer.
                */}
                <div
                  className={cn(
                    'absolute inset-y-0 right-0 w-[380px] transition-transform duration-300 ease-out',
                    selectedVehicle ? 'translate-x-0' : 'translate-x-full',
                  )}
                >
                  {fichaVeiculo ? (
                    <VehicleDrawer
                      vehicle={fichaVeiculo}
                      onClose={limparSelecao}
                      trajetoAberto={trajetoAberto}
                      onToggleTrajeto={() => setTrajetoAberto((aberto) => !aberto)}
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        </QueryState>
      </PageContent>
    </>
  );
}
