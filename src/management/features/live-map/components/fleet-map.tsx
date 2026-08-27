import type { VehiclePosition, VehicleStatus } from '@/management/types';
import type { FeatureCollection, Point } from 'geojson';
import { cn } from '@/management/ui';
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Estilo escuro gratuito e sem chave de API.
 *
 * O documento especifica Mapbox (FE-10), mas Mapbox exige conta e token. O
 * próprio doc já prevê esta troca em `RT-02`: a API do MapLibre é praticamente
 * idêntica, então migrar depois é trocar o import e esta URL.
 */
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/*
 * O `setWorkerUrl` que este arquivo trazia do monorepo **não existe aqui**: lá o
 * MapLibre era o 6, que publica o worker num arquivo à parte; o System-web está
 * no 5, que embute o worker no próprio bundle — é o mesmo que a tela de
 * rastreamento já usa. Reintroduzir o import quebra o servidor de dev.
 */

const SOURCE_ID = 'fleet';
const LAYER_CIRCLE = 'fleet-circle';
const LAYER_LABEL = 'fleet-label';

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

/** Cores por status, espelhando `features/trucks/vehicle-status.tsx`. */
const STATUS_COLOR: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  /* Cinza de propósito: o ponto está no último lugar conhecido, que pode ser de
     ontem. Pintá-lo com a mesma saturação dos demais faria parecer atual. */
  SEM_SINAL: '#94A3B8',
};

function toGeoJson(positions: VehiclePosition[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: positions.map((vehicle) => ({
      type: 'Feature',
      id: vehicle.vehicleId,
      geometry: { type: 'Point', coordinates: vehicle.coordinates },
      properties: {
        vehicleId: vehicle.vehicleId,
        plate: vehicle.plate,
        color: STATUS_COLOR[vehicle.status],
      },
    })),
  };
}

/**
 * A rota percorrida pelo veículo selecionado, em [longitude, latitude].
 *
 * Chega pronta de fora: o mapa desenha, não busca. Quem decide a janela de horas
 * é a tela, que tem o seletor.
 */
export interface FleetMapProps {
  positions: VehiclePosition[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
  track?: [number, number][] | undefined;
  /** Células do mapa de calor. Vazio ou ausente esconde a camada. */
  heat?: { coordinates: [number, number]; total: number }[] | undefined;
  /** Onde o replay está agora. Nulo esconde o marcador. */
  playhead?: [number, number] | null | undefined;
  className?: string | undefined;
}

/** Uma linha com menos de dois pontos não é linha: o MapLibre recusa. */
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
 * cobriria a linha inteira e derrubaria o quadro. O que o gestor precisa ver é
 * onde começou e onde está.
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
        properties: { ponta: 'inicio', color: '#94A3B8' },
        geometry: { type: 'Point', coordinates: inicio },
      },
      {
        type: 'Feature',
        properties: { ponta: 'fim', color: '#38BDF8' },
        geometry: { type: 'Point', coordinates: fim },
      },
    ],
  };
}

/**
 * Mapa da frota em tempo real.
 *
 * ⚠️ Duas regras do `RT-02`, que valem igual para MapLibre e existem porque o
 * custo destas bibliotecas é cobrado por carregamento de mapa:
 *
 *  1. **Uma única instância por sessão** — o mapa é criado uma vez e nunca
 *     remontado. Por isso o `useEffect` de criação tem lista de dependências
 *     vazia e a instância vive num `ref`.
 *  2. **Atualização por `setData`** — posição nova reescreve a fonte GeoJSON.
 *     Nunca recriar a fonte, a camada ou o mapa a cada tick.
 */
export function FleetMap({
  positions,
  selectedId,
  onSelect,
  track,
  heat,
  playhead,
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

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [-43.25, -22.88],
      zoom: 9.4,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    instance.on('load', () => {
      instance.addSource(SOURCE_ID, { type: 'geojson', data: toGeoJson([]) });

      /*
       * A rota entra ANTES dos pontos da frota.
       *
       * O MapLibre desenha na ordem em que as camadas foram adicionadas, e uma
       * linha por cima dos círculos passaria em cima do caminhão. A ordem aqui é
       * a ordem visual.
       */
      /* O calor entra por baixo de tudo: ele é fundo, não informação pontual. */
      instance.addSource(SOURCE_HEAT, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: LAYER_HEAT,
        type: 'heatmap',
        source: SOURCE_HEAT,
        paint: {
          /* O peso vem da contagem da célula, limitado a 10: uma esquina com
             200 ocorrências apagaria todas as outras da escala de cor. */
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

      instance.addSource(SOURCE_TRACK, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addSource(SOURCE_TRACK_ENDS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      /* Halo largo e transparente: dá contraste sobre o mapa escuro sem
         engrossar a linha, que precisa seguir a rua. */
      instance.addLayer({
        id: LAYER_TRACK_GLOW,
        type: 'line',
        source: SOURCE_TRACK,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#38BDF8', 'line-width': 8, 'line-opacity': 0.18 },
      });

      instance.addLayer({
        id: LAYER_TRACK,
        type: 'line',
        source: SOURCE_TRACK,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#38BDF8', 'line-width': 2.5, 'line-opacity': 0.9 },
      });

      instance.addSource(SOURCE_PLAYHEAD, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: LAYER_PLAYHEAD,
        type: 'circle',
        source: SOURCE_PLAYHEAD,
        paint: {
          'circle-radius': 7,
          'circle-color': '#FBBF24',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#171717',
        },
      });

      instance.addLayer({
        id: LAYER_TRACK_ENDS,
        type: 'circle',
        source: SOURCE_TRACK_ENDS,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#171717',
        },
      });

      instance.addLayer({
        id: LAYER_CIRCLE,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#171717',
        },
      });

      instance.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'plate'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#F0F0F2',
          'text-halo-color': '#171717',
          'text-halo-width': 1.4,
        },
      });

      instance.on('click', LAYER_CIRCLE, (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.vehicleId;
        if (typeof id === 'string') onSelectRef.current(id);
      });

      instance.on('mouseenter', LAYER_CIRCLE, () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', LAYER_CIRCLE, () => {
        instance.getCanvas().style.cursor = '';
      });

      setReady(true);
    });

    /* Sem tiles a tela cai para a lista, em vez de mostrar um retângulo cinza. */
    instance.on('error', () => setFailed(true));

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  /* Posição nova → `setData`. Nunca recriar fonte, camada ou mapa. */
  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toGeoJson(positions));
  }, [positions, ready]);

  /*
   * Enquadra a frota no primeiro carregamento.
   *
   * O centro fixo era do Rio, herdado dos mocks, e com frota real a tela abria
   * numa região vazia: os caminhões existiam e estavam fora do campo de visão.
   * Cada cliente opera onde opera, e nenhuma coordenada fixa serve para todos.
   *
   * Só na primeira vez: refazer o enquadramento a cada polling de quatro
   * segundos arrancaria o mapa da mão de quem estivesse navegando nele.
   */
  const framed = useRef(false);
  useEffect(() => {
    if (!ready || !map.current || framed.current || positions.length === 0) return;

    const [oeste, sul, leste, norte] = positions.reduce(
      (limites, vehicle) => {
        const [lng, lat] = vehicle.coordinates;
        return [
          Math.min(limites[0], lng),
          Math.min(limites[1], lat),
          Math.max(limites[2], lng),
          Math.max(limites[3], lat),
        ] as [number, number, number, number];
      },
      [180, 90, -180, -90] as [number, number, number, number],
    );

    framed.current = true;
    map.current.fitBounds(
      [
        [oeste, sul],
        [leste, norte],
      ],
      /* `maxZoom` impede que uma frota inteira num pátio jogue o zoom no telhado. */
      { padding: 64, maxZoom: 12, duration: 0 },
    );
  }, [positions, ready]);

  /* Selecionar na lista centraliza o mapa no veículo. */
  useEffect(() => {
    if (!ready || !map.current || !selectedId) return;
    const target = positions.find((vehicle) => vehicle.vehicleId === selectedId);
    if (!target) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.current.easeTo({
      center: target.coordinates,
      zoom: Math.max(map.current.getZoom(), 11),
      duration: reduced ? 0 : 600,
    });
  }, [selectedId, ready, positions]);

  /**
   * Desenha a rota do veículo selecionado, e a enquadra.
   *
   * O enquadramento é o que faz a rota servir: sem ele, um caminhão que rodou
   * 90 km some da tela assim que a linha é desenhada, porque o mapa continua
   * centrado no ponto atual com zoom de bairro.
   */
  useEffect(() => {
    if (!ready || !map.current) return;

    const linha = map.current.getSource(SOURCE_TRACK) as GeoJSONSource | undefined;
    const pontas = map.current.getSource(SOURCE_TRACK_ENDS) as GeoJSONSource | undefined;

    if (!temRota(track)) {
      linha?.setData({ type: 'FeatureCollection', features: [] });
      pontas?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    linha?.setData(toTrackLine(track));
    pontas?.setData(toTrackEnds(track));

    const [oeste, sul, leste, norte] = track.reduce(
      (limites, [lng, lat]) =>
        [
          Math.min(limites[0], lng),
          Math.min(limites[1], lat),
          Math.max(limites[2], lng),
          Math.max(limites[3], lat),
        ] as [number, number, number, number],
      [180, 90, -180, -90] as [number, number, number, number],
    );

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.current.fitBounds(
      [
        [oeste, sul],
        [leste, norte],
      ],
      /* `maxZoom` alto porque uma rota curta, de entrega urbana, precisa de zoom
         de rua para a linha não virar um borrão de dois pixels. */
      { padding: 72, maxZoom: 15, duration: reduced ? 0 : 700 },
    );
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
   * sozinho enquanto o gestor tenta olhar um cruzamento específico. Quem quiser
   * acompanhar arrasta o mapa; quem quiser examinar fica onde está.
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
      data-map-state={failed ? 'failed' : ready ? 'ready' : 'loading'}
      role="application"
      aria-label="Mapa da frota em tempo real"
      className={cn('ring-outline-variant overflow-hidden rounded-xl ring-1', className)}
    />
  );
}
