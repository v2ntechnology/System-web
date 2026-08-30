import type { VehiclePosition, VehicleStatus } from '@/management/types';
import type { FeatureCollection, Point } from 'geojson';
import { cn } from '@/management/ui';
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  NavigationControl,
  Popup,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import { MAP_STYLE, mapStyleUrlNow } from '@/components/shared/map-style';
import { useThemeStore } from '@/stores/theme-store';

import { SETA_ESCALA, headingIdFor, iconIdFor, loadVehicleIcons } from './vehicle-icons';

/*
 * A base saiu daqui e virou `@/components/shared/map-style`, comum aos três
 * mapas da aplicação. O motivo e a escolha do Liberty estão documentados lá.
 */

/*
 * O `setWorkerUrl` que este arquivo trazia do monorepo **não existe aqui**: lá o
 * MapLibre era o 6, que publica o worker num arquivo à parte; o System-web está
 * no 5, que embute o worker no próprio bundle. Reintroduzir o import quebra o
 * servidor de desenvolvimento.
 */

const SOURCE_ID = 'fleet';
const LAYER_HALO = 'fleet-halo';
/* A seta de direção é uma camada própria porque GIRA, e o crachá não pode girar:
   o caminhão desenhado dentro dele ficaria de cabeça para baixo. */
const LAYER_HEADING = 'fleet-heading';
const LAYER_ICON = 'fleet-icon';
const LAYER_LABEL = 'fleet-label';

/**
 * Tamanho do marcador conforme o zoom, em fração da imagem de 64 pixels.
 *
 * Calibrado para o DISCO, e não para o canvas: o crachá ocupa cerca de 70% do
 * lado, então estes fatores dão um disco de 26 pixels no zoom em que a tela
 * abre, 32 na cidade e 40 na rua. Abaixo de 24 pixels a silhueta dentro do
 * crachá deixa de ser reconhecível, que é exatamente o defeito da primeira
 * versão.
 *
 * Nenhum ponto passa de 1: acima disso o MapLibre amplia a imagem e a borda
 * embaça.
 */
const TAMANHO_POR_ZOOM: ['interpolate', ['linear'], ['zoom'], ...number[]] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  0.56,
  11,
  0.7,
  16,
  0.88,
];

/** A mesma curva, ampliada. Ver `SETA_ESCALA` em `vehicle-icons`. */
const TAMANHO_DA_SETA: ['interpolate', ['linear'], ['zoom'], ...number[]] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  0.56 * SETA_ESCALA,
  11,
  0.7 * SETA_ESCALA,
  16,
  0.88 * SETA_ESCALA,
];

/* Camadas da rota do veículo selecionado. */
const SOURCE_TRACK = 'track';
const LAYER_TRACK = 'track-line';
const LAYER_TRACK_GLOW = 'track-glow';
const SOURCE_TRACK_ENDS = 'track-ends';
const LAYER_TRACK_ENDS = 'track-ends-circle';

/* Mapa de calor de eventos e o marcador do replay. */
const SOURCE_HEAT = 'heat';
const LAYER_HEAT = 'heat-layer';
const SOURCE_PLAYHEAD = 'playhead';
const LAYER_PLAYHEAD = 'playhead-circle';

/**
 * Duração do deslize entre uma leitura e a seguinte.
 *
 * Menor que o intervalo do polling, de propósito: a animação precisa terminar
 * antes da próxima posição chegar, senão o caminhão nunca alcança o alvo e fica
 * permanentemente atrasado em relação ao dado.
 */
const DESLIZE_MS = 1600;

const STATUS_COLOR: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  SEM_SINAL: '#94A3B8',
};

interface Desenhado {
  lng: number;
  lat: number;
  heading: number;
}

export interface FleetMapProps {
  positions: VehiclePosition[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
  track?: [number, number][] | undefined;
  /** Células do mapa de calor. Vazio ou ausente esconde a camada. */
  heat?: { coordinates: [number, number]; total: number }[] | undefined;
  /** Onde o replay está agora. Nulo esconde o marcador. */
  playhead?: [number, number] | null | undefined;
  /**
   * Veículo sob o cursor na lista ao lado.
   *
   * Apontar na lista destaca no mapa sem selecionar: o gestor percorre doze
   * placas procurando uma, e clicar em cada uma para descobrir onde está
   * arrastaria a câmera doze vezes.
   */
  hoveredId?: string | null | undefined;
  className?: string | undefined;
}

/* -------------------------------------------------------------------------- */
/* Geometria                                                                   */
/* -------------------------------------------------------------------------- */

function toGeoJson(
  positions: VehiclePosition[],
  desenhado: Map<string, Desenhado>,
  selectedId: string | null,
  hoveredId?: string | null,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: positions.map((vehicle) => {
      const atual = desenhado.get(vehicle.vehicleId);
      return {
        type: 'Feature',
        id: vehicle.vehicleId,
        geometry: {
          type: 'Point',
          coordinates: atual ? [atual.lng, atual.lat] : vehicle.coordinates,
        },
        properties: {
          vehicleId: vehicle.vehicleId,
          plate: vehicle.plate,
          driverName: vehicle.driverName ?? '',
          speedKmh: Math.round(vehicle.speedKmh),
          status: vehicle.status,
          color: STATUS_COLOR[vehicle.status],
          icon: iconIdFor(vehicle.type, vehicle.status),
          'heading-icon': headingIdFor(vehicle.status),
          heading: atual ? atual.heading : vehicle.heading,
          selected: vehicle.vehicleId === selectedId,
          destacado: vehicle.vehicleId === selectedId || vehicle.vehicleId === hoveredId,
          /* Parado não ganha seta: com velocidade zero o GPS oscila a direção, e
             a seta ficaria rodopiando no pátio apontando para lugar nenhum. */
          parado: vehicle.speedKmh <= 3,
          /* Veículo mudo há mais de um dia fica para trás no empilhamento
             visual. Ele continua na tela, mas não disputa atenção com quem está
             rodando agora. */
          opacidade: vehicle.status === 'SEM_SINAL' ? 0.62 : 1,
        },
      };
    }),
  };
}

/**
 * O caminho angular mais curto entre duas direções.
 *
 * De 350 para 10 graus são 20 graus para a direita, e não 340 para a esquerda.
 * Sem isso, todo cruzamento do norte faria o ícone dar um giro completo.
 */
function interpolarAngulo(de: number, para: number, fracao: number): number {
  const diferenca = ((((para - de) % 360) + 540) % 360) - 180;
  return (de + diferenca * fracao + 360) % 360;
}

/** Suaviza a ponta da animação: começa e termina devagar. */
const suavizar = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const temRota = (track: [number, number][] | undefined): track is [number, number][] =>
  Array.isArray(track) && track.length >= 2;

function toTrackLine(track: [number, number][]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: track } },
    ],
  };
}

/**
 * Só as duas pontas da rota, e não um ponto por leitura.
 *
 * São 2.863 posições por veículo por dia: desenhar um círculo em cada uma
 * cobriria a linha inteira e derrubaria o quadro.
 */
function toTrackEnds(track: [number, number][]): FeatureCollection<Point> {
  const inicio = track[0];
  const fim = track[track.length - 1];
  if (!inicio || !fim) return { type: 'FeatureCollection', features: [] };

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { color: '#94A3B8' },
        geometry: { type: 'Point', coordinates: inicio },
      },
      {
        type: 'Feature',
        properties: { color: '#38BDF8' },
        geometry: { type: 'Point', coordinates: fim },
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Componente                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mapa da frota em tempo real.
 *
 * ⚠️ Duas regras do `RT-02`, que valem igual para MapLibre e existem porque o
 * custo destas bibliotecas é cobrado por carregamento de mapa:
 *
 *  1. **Uma única instância por sessão.** O mapa é criado uma vez e nunca
 *     remontado. Por isso o `useEffect` de criação tem lista de dependências
 *     vazia e a instância vive num `ref`.
 *  2. **Atualização por `setData`.** Posição nova reescreve a fonte GeoJSON.
 *     Nunca recriar a fonte, a camada ou o mapa a cada tick.
 *
 * <h2>O caminhão desliza, não pula</h2>
 *
 * O polling traz uma posição nova a cada quatro segundos. Escrever direto faria
 * o ícone saltar de um ponto a outro, o que num mapa de frota lê como falha de
 * dado. A cada leitura nova o componente anima da posição desenhada até a
 * recebida, e o resultado é um veículo que anda.
 */
export function FleetMap({
  positions,
  selectedId,
  onSelect,
  track,
  heat,
  playhead,
  hoveredId,
  className,
}: FleetMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Handler em ref: trocar de veículo selecionado não pode recriar o listener. */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /* O que está desenhado agora, que não é o que chegou do backend enquanto a
     animação corre. */
  const desenhadoRef = useRef<Map<string, Desenhado>>(new Map());
  const animacaoRef = useRef<number | null>(null);
  const selectedRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  /* Em ref porque o laço de animação lê fora do render. */
  const hoveredRef = useRef<string | null | undefined>(hoveredId);
  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyleUrlNow(),
      center: [-43.25, -22.88],
      zoom: 9.4,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      className: 'fleet-popup',
    });

    /**
     * Desenha o conteúdo da RookHub por cima da base.
     *
     * ⚠️ As imagens PRECISAM existir antes da camada que as usa. Registrar a
     * camada primeiro faz o MapLibre avisar "image not found" e simplesmente
     * não desenhar: o mapa fica vazio sem erro na aplicação.
     *
     * ⚠️ Roda de novo a cada troca de estilo, e não só na criação. `setStyle`
     * descarta fonte, camada E imagem registradas: sem esta segunda passada,
     * mudar de tema deixaria a base nova sem caminhão nenhum em cima.
     */
    async function desenharConteudo() {
      const imagens = await loadVehicleIcons();
      for (const [id, imagem] of Object.entries(imagens)) {
        if (!instance.hasImage(id)) instance.addImage(id, imagem, { pixelRatio: 2 });
      }
      montarCamadas(instance);
    }

    instance.on('load', () => {
      void desenharConteudo()
        .then(() => {
          ligarInteracoes(instance);
          setReady(true);
        })
        .catch(() => setFailed(true));
    });

    /*
     * A remontagem depois de `setStyle`. O evento certo é `styledata`, e não
     * `load`: `load` dispara uma vez na vida do mapa e nunca mais, então um
     * mapa que troca de base ficaria vazio para sempre.
     *
     * A guarda do `getSource` existe porque `styledata` também dispara em
     * carregamento de tile: sem ela, o desenho seria refeito a cada rolagem.
     */
    instance.on('styledata', () => {
      if (!instance.isStyleLoaded() || instance.getSource(SOURCE_ID)) return;
      setReady(false);
      void desenharConteudo()
        .then(() => setReady(true))
        .catch(() => setFailed(true));
    });

    function montarCamadas(mapa: MapLibreMap) {
      /* Lido aqui, e não capturado do render: `montarCamadas` roda de novo a
         cada troca de base, e precisa do tema do momento. */
      const claro = useThemeStore.getState().theme === 'light';
      /* O calor entra por baixo de tudo: ele é fundo, não informação pontual. */
      mapa.addSource(SOURCE_HEAT, { type: 'geojson', data: vazio() });
      mapa.addLayer({
        id: LAYER_HEAT,
        type: 'heatmap',
        source: SOURCE_HEAT,
        paint: {
          /* Peso limitado a 10: uma esquina com 200 ocorrências apagaria todas
             as outras da escala de cor. */
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'total'], 0, 0, 10, 1],
          'heatmap-intensity': 1.1,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 14, 26],
          'heatmap-opacity': 0.65,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(56,189,248,0)',
            0.25,
            'rgba(56,189,248,0.55)',
            0.5,
            'rgba(251,191,36,0.65)',
            0.75,
            'rgba(251,146,60,0.75)',
            1,
            'rgba(244,63,94,0.85)',
          ],
        },
      });

      /* A rota entra antes dos veículos: o MapLibre desenha na ordem de
         inserção, e a linha por cima passaria em cima do caminhão. */
      mapa.addSource(SOURCE_TRACK, { type: 'geojson', data: vazio() });
      mapa.addSource(SOURCE_TRACK_ENDS, { type: 'geojson', data: vazio() });
      mapa.addSource(SOURCE_PLAYHEAD, { type: 'geojson', data: vazio() });

      mapa.addLayer({
        id: LAYER_TRACK_GLOW,
        type: 'line',
        source: SOURCE_TRACK,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#38BDF8', 'line-width': 8, 'line-opacity': 0.18 },
      });
      mapa.addLayer({
        id: LAYER_TRACK,
        type: 'line',
        source: SOURCE_TRACK,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#38BDF8', 'line-width': 2.5, 'line-opacity': 0.9 },
      });
      mapa.addLayer({
        id: LAYER_TRACK_ENDS,
        type: 'circle',
        source: SOURCE_TRACK_ENDS,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': claro ? '#FFFFFF' : '#0B0B0E',
        },
      });
      mapa.addLayer({
        id: LAYER_PLAYHEAD,
        type: 'circle',
        source: SOURCE_PLAYHEAD,
        paint: {
          'circle-radius': 7,
          'circle-color': '#FBBF24',
          'circle-stroke-width': 3,
          'circle-stroke-color': claro ? '#FFFFFF' : '#0B0B0E',
        },
      });

      mapa.addSource(SOURCE_ID, { type: 'geojson', data: vazio() });

      /* Halo do selecionado: um anel por baixo do marcador. Destacar mudando a
         cor do próprio veículo apagaria o status, que é o que a cor significa. */
      mapa.addLayer({
        id: LAYER_HALO,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'destacado'], true],
        paint: {
          /* Acompanha o marcador: anel de raio fixo ficaria maior que o crachá
             de longe e escondido atrás dele de perto. */
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 21, 11, 26, 16, 33],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.16,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.55,
        },
      });

      /* Seta de direção, por baixo do crachá. Só para quem está andando: com
         velocidade zero o GPS oscila a direção, e a seta ficaria rodopiando no
         pátio apontando para lugar nenhum. */
      mapa.addLayer({
        id: LAYER_HEADING,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'parado'], false],
        layout: {
          'icon-image': ['get', 'heading-icon'],
          'icon-size': TAMANHO_DA_SETA,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': ['get', 'opacidade'] },
      });

      mapa.addLayer({
        id: LAYER_ICON,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': TAMANHO_POR_ZOOM,
          /* ⚠️ SEM `icon-rotate`. O crachá tem um caminhão desenhado dentro, e
             girar a imagem deixaria o caminhão de cabeça para baixo metade do
             tempo. Quem gira é a seta, na camada de baixo. */
          'icon-rotation-alignment': 'viewport',
          /* Frota parada num pátio sobrepõe: esconder metade dos veículos por
             colisão de ícone seria pior que a sobreposição. */
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          /* Quem não reporta há um dia não pode ter o mesmo peso visual de quem
             está rodando agora. O olho precisa cair no que está acontecendo. */
          'icon-opacity': ['get', 'opacidade'],
        },
      });

      mapa.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'plate'],
          /*
           * ⚠️ A família PRECISA estar declarada, e precisa ser uma que o
           * provedor publique.
           *
           * Sem `text-font`, o MapLibre usa o padrão da especificação, que é
           * "Open Sans Regular, Arial Unicode MS Regular": família do CARTO, que
           * era a base antiga. O OpenFreeMap não a serve, e cada faixa de glifo
           * virava um 404 no console. O rótulo ainda aparecia por causa do
           * recurso alternativo do MapLibre, e é isso que torna o defeito fácil
           * de não ver: falha silenciosa com aparência de sucesso.
           */
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          /*
           * ⚠️ A placa inverte com a base, e não é enfeite: sobre o mapa claro,
           * texto branco com contorno preto lê como adesivo mal recortado, e o
           * contorno come a letra em corpo pequeno. O halo é o oposto do texto,
           * sempre, porque é ele que separa a placa da rua desenhada por baixo.
           */
          'text-color': claro ? '#141416' : '#F0F0F2',
          'text-halo-color': claro ? '#FFFFFF' : '#0B0B0E',
          'text-halo-width': 1.6,
        },
      });
    }

    /**
     * Os ouvintes de ponteiro, registrados UMA vez.
     *
     * ⚠️ Separados de `montarCamadas` de propósito. Trocar o estilo obriga a
     * remontar fonte e camada, mas ouvinte é do mapa e não do estilo: sobrevive
     * à troca. Se estivessem juntos, cada mudança de tema registraria um
     * conjunto novo e um clique passaria a selecionar o veículo duas vezes.
     */
    function ligarInteracoes(mapa: MapLibreMap) {
      mapa.on('click', LAYER_ICON, (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.vehicleId;
        if (typeof id === 'string') onSelectRef.current(id);
      });

      /* Passar o mouse já responde a pergunta mais comum, sem exigir clique e
         sem tirar o gestor de onde ele estava olhando. */
      mapa.on('mousemove', LAYER_ICON, (event: MapLayerMouseEvent) => {
        mapa.getCanvas().style.cursor = 'pointer';

        const feature = event.features?.[0];
        if (!feature) return;
        const p = feature.properties ?? {};
        const coordenadas = (feature.geometry as Point).coordinates.slice() as [number, number];

        popup
          .setLngLat(coordenadas)
          .setHTML(
            `<strong>${escapar(String(p.plate ?? ''))}</strong>` +
              `<span>${Number(p.speedKmh ?? 0)} km/h</span>` +
              (p.driverName ? `<em>${escapar(String(p.driverName))}</em>` : ''),
          )
          .addTo(mapa);
      });

      mapa.on('mouseleave', LAYER_ICON, () => {
        mapa.getCanvas().style.cursor = '';
        popup.remove();
      });
    }

    /* Sem tiles a tela cai para a lista, em vez de mostrar um retângulo cinza. */
    instance.on('error', () => setFailed(true));

    map.current = instance;

    return () => {
      if (animacaoRef.current !== null) cancelAnimationFrame(animacaoRef.current);
      popup.remove();
      instance.remove();
      map.current = null;
    };
    /* Lista vazia de propósito: o mapa é criado uma vez. O tema entra por
       `mapStyleUrlNow()` na criação e pelo efeito abaixo nas trocas. */
  }, []);

  /**
   * Troca a base quando o tema muda, preservando a câmera.
   *
   * O que estava desenhado por cima volta pelo ouvinte de `styledata` do
   * efeito acima. Enquanto o modo escuro está desligado, isto nunca dispara,
   * e é justamente por isso que precisa estar certo: quem religar o escuro
   * não vai descobrir sozinho que `setStyle` apaga as camadas.
   */
  const theme = useThemeStore((state) => state.theme);
  useEffect(() => {
    map.current?.setStyle(MAP_STYLE[theme]);
  }, [theme]);

  /**
   * Posição nova: anima do desenhado até o recebido.
   *
   * Veículo que aparece pela primeira vez entra direto no lugar certo, sem
   * deslizar do nada: um caminhão surgindo do meio do oceano e correndo até o
   * Rio seria bonito e mentiroso.
   */
  useEffect(() => {
    if (!ready || !map.current || positions.length === 0) return;

    const fonte = map.current.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!fonte) return;

    const de = new Map(desenhadoRef.current);
    const para = new Map<string, Desenhado>();
    for (const vehicle of positions) {
      para.set(vehicle.vehicleId, {
        lng: vehicle.coordinates[0],
        lat: vehicle.coordinates[1],
        heading: vehicle.heading,
      });
      if (!de.has(vehicle.vehicleId)) {
        de.set(vehicle.vehicleId, {
          lng: vehicle.coordinates[0],
          lat: vehicle.coordinates[1],
          heading: vehicle.heading,
        });
      }
    }

    if (animacaoRef.current !== null) cancelAnimationFrame(animacaoRef.current);
    const inicio = performance.now();

    const passo = (agora: number) => {
      const fracao = Math.min(1, (agora - inicio) / DESLIZE_MS);
      const suave = suavizar(fracao);

      const atual = new Map<string, Desenhado>();
      for (const [id, alvo] of para) {
        const origem = de.get(id) ?? alvo;
        atual.set(id, {
          lng: origem.lng + (alvo.lng - origem.lng) * suave,
          lat: origem.lat + (alvo.lat - origem.lat) * suave,
          heading: interpolarAngulo(origem.heading, alvo.heading, suave),
        });
      }

      desenhadoRef.current = atual;
      fonte.setData(toGeoJson(positions, atual, selectedRef.current, hoveredRef.current));

      if (fracao < 1) {
        animacaoRef.current = requestAnimationFrame(passo);
      } else {
        animacaoRef.current = null;
      }
    };

    animacaoRef.current = requestAnimationFrame(passo);
  }, [positions, ready]);

  /* Seleção e destaque mudam só uma propriedade: não precisam reanimar nada. */
  useEffect(() => {
    if (!ready || !map.current) return;
    const fonte = map.current.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    fonte?.setData(toGeoJson(positions, desenhadoRef.current, selectedId, hoveredId));
  }, [selectedId, hoveredId, ready, positions]);

  /**
   * Enquadra a frota no primeiro carregamento.
   *
   * O centro fixo era do Rio, herdado dos mocks, e com frota real a tela abria
   * numa região vazia: os caminhões existiam e estavam fora do campo de visão.
   * Só na primeira vez: refazer a cada polling arrancaria o mapa da mão de quem
   * estivesse navegando nele.
   */
  const enquadrado = useRef(false);
  useEffect(() => {
    if (!ready || !map.current || enquadrado.current || positions.length === 0) return;

    const limites = envolver(positions.map((v) => v.coordinates));
    enquadrado.current = true;
    map.current.fitBounds(limites, { padding: 64, maxZoom: 12, duration: 0 });
  }, [positions, ready]);

  /* Rota do veículo selecionado, enquadrada ao aparecer. */
  useEffect(() => {
    if (!ready || !map.current) return;

    const linha = map.current.getSource(SOURCE_TRACK) as GeoJSONSource | undefined;
    const pontas = map.current.getSource(SOURCE_TRACK_ENDS) as GeoJSONSource | undefined;

    if (!temRota(track)) {
      linha?.setData(vazio());
      pontas?.setData(vazio());
      return;
    }

    linha?.setData(toTrackLine(track));
    pontas?.setData(toTrackEnds(track));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.current.fitBounds(envolver(track), {
      /* `maxZoom` alto porque uma rota curta, de entrega urbana, precisa de zoom
         de rua para a linha não virar um borrão de dois pixels. */
      padding: 72,
      maxZoom: 15,
      duration: reduced ? 0 : 700,
    });
  }, [track, ready]);

  /* Mapa de calor: só reescreve a fonte, nunca recria a camada. */
  useEffect(() => {
    if (!ready || !map.current) return;
    const fonte = map.current.getSource(SOURCE_HEAT) as GeoJSONSource | undefined;

    fonte?.setData({
      type: 'FeatureCollection',
      features: (heat ?? []).map((celula) => ({
        type: 'Feature',
        properties: { total: celula.total },
        geometry: { type: 'Point', coordinates: celula.coordinates },
      })),
    });
  }, [heat, ready]);

  /**
   * O marcador do replay.
   *
   * Não move a câmera junto, de propósito: seguir o ponto faria o mapa correr
   * sozinho enquanto o gestor tenta olhar um cruzamento específico.
   */
  useEffect(() => {
    if (!ready || !map.current) return;
    const fonte = map.current.getSource(SOURCE_PLAYHEAD) as GeoJSONSource | undefined;

    fonte?.setData({
      type: 'FeatureCollection',
      features: playhead
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: playhead } }]
        : [],
    });
  }, [playhead, ready]);

  if (failed) {
    return (
      <div
        className={cn(
          'bg-surface-lowest ring-outline-variant flex items-center justify-center rounded-xl p-6 ring-1',
          className,
        )}
      >
        <p className="text-on-surface-variant text-body-md max-w-sm text-center">
          Não foi possível carregar o mapa. A posição de cada veículo continua na lista ao lado.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={container}
      /* Estado exposto no DOM: serve para teste E2E sem precisar da instância. */
      data-map-ready={ready ? 'true' : 'false'}
      className={cn('overflow-hidden rounded-xl', className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Apoio                                                                       */
/* -------------------------------------------------------------------------- */

const vazio = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Caixa que contém todos os pontos, no formato que o `fitBounds` espera. */
function envolver(pontos: [number, number][]): [[number, number], [number, number]] {
  const [oeste, sul, leste, norte] = pontos.reduce(
    (limites, [lng, lat]) =>
      [
        Math.min(limites[0], lng),
        Math.min(limites[1], lat),
        Math.max(limites[2], lng),
        Math.max(limites[3], lat),
      ] as [number, number, number, number],
    [180, 90, -180, -90] as [number, number, number, number],
  );
  return [
    [oeste, sul],
    [leste, norte],
  ];
}

/**
 * O nome do motorista e a placa vêm do cliente e entram como HTML no popup.
 *
 * Nome com `<` ou `&` quebraria a marcação, e nome com `<script>` seria bem
 * pior. É dado de terceiro chegando por API: escapar não é paranoia.
 */
function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
