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

export interface FleetMapProps {
  positions: VehiclePosition[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
  className?: string | undefined;
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
export function FleetMap({ positions, selectedId, onSelect, className }: FleetMapProps) {
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
