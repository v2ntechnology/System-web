import { Spinner, cn } from '@/management/ui';
import type { FeatureCollection } from 'geojson';
import { Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { MAP_STYLE, mapStyleUrlNow } from '@/components/shared/map-style';
import { useThemeStore } from '@/stores/theme-store';

import type { ActiveTrip } from '../types';

import 'maplibre-gl/dist/maplibre-gl.css';

/* A base é a mesma dos outros mapas do produto e sai de um lugar só: duas bases
   diferentes na mesma sessão fazem o usuário achar que mudou de cidade. Ver
   `@/components/shared/map-style`. */

const SOURCE = 'overview-fleet';
const LAYER_HALO = 'overview-fleet-halo';
const LAYER_DOT = 'overview-fleet-dot';
const LAYER_LABEL = 'overview-fleet-label';

/* Cor literal porque o MapLibre pinta em canvas e não enxerga token de CSS.
   São as mesmas âncoras da paleta: indigo da marca e o âmbar de atenção. */
const INDIGO = '#6366F1';
const AMBER = '#D97706';

export interface FleetMiniMapProps {
  trips: ActiveTrip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string | undefined;
}

/**
 * Mapa de consulta rápida da visão geral.
 *
 * Responde a uma pergunta só: **onde está aquele caminhão agora**. Não tem
 * filtro, camada, histórico nem 3D, que é o que a central de comando de
 * `/gestao/mapa` faz; aqui o gestor confere um ponto e volta ao trabalho. O
 * botão do card leva à tela cheia quando a consulta vira investigação.
 *
 * O ponto âmbar é a viagem atrasada, mesma leitura do card ao lado.
 */
export function FleetMiniMap({ trips, selectedId, onSelect, className }: FleetMiniMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Handler em ref: trocar o caminhão selecionado não pode recriar o ouvinte. */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyleUrlNow(),
      center: [-47.9, -20.5],
      zoom: 3.6,
      /* Sempre aberta, nunca em botão: a atribuição do OpenStreetMap é
         obrigatória, e no modo compacto ela saltava a cada clique. */
      attributionControl: { compact: false },
      /* Card de consulta, não de navegação: girar e inclinar aqui só faria o
         gestor precisar de um botão para voltar ao normal. */
      pitchWithRotate: false,
      dragRotate: false,
    });

    /**
     * ⚠️ Roda de novo a cada troca de estilo. `setStyle` descarta fonte e
     * camada: sem a segunda passada, mudar de tema deixaria a base nova sem
     * caminhão nenhum desenhado.
     */
    function montarCamadas() {
      const claro = useThemeStore.getState().theme === 'light';
      instance.addSource(SOURCE, { type: 'geojson', data: vazio() });

      /* Halo só sob o caminhão escolhido, para a lista e o mapa apontarem
         visivelmente para o mesmo ponto. */
      instance.addLayer({
        id: LAYER_HALO,
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['get', 'destacado'], true],
        paint: {
          'circle-radius': 16,
          'circle-color': ['get', 'cor'],
          'circle-opacity': 0.22,
        },
      });

      instance.addLayer({
        id: LAYER_DOT,
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'cor'],
          'circle-stroke-width': 2,
          'circle-stroke-color': claro ? '#FFFFFF' : '#0F172A',
        },
      });

      instance.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE,
        layout: {
          'text-field': ['get', 'placa'],
          /* Família publicada pelo provedor. Sem isto, o padrão da especificação
             pede a fonte do CARTO e cada faixa de glifo vira um 404. */
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          /* O halo é sempre o oposto do texto: é ele que separa a placa da rua
             desenhada por baixo. */
          'text-color': claro ? '#141416' : '#E2E8F0',
          'text-halo-color': claro ? '#FFFFFF' : '#0F172A',
          'text-halo-width': 1.6,
        },
      });
    }

    /* Ouvinte é do mapa e sobrevive à troca de estilo: registrá-lo dentro da
       montagem faria um clique valer dois depois do primeiro tema novo. */
    function ligarInteracoes() {
      instance.on('click', LAYER_DOT, (evento) => {
        const id = evento.features?.[0]?.properties?.['id'];
        if (typeof id === 'string') onSelectRef.current(id);
      });

      instance.on('mouseenter', LAYER_DOT, () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', LAYER_DOT, () => {
        instance.getCanvas().style.cursor = '';
      });
    }

    instance.on('load', () => {
      montarCamadas();
      ligarInteracoes();
      setReady(true);
    });

    /* A remontagem depois de `setStyle`. `load` dispara uma vez na vida do mapa;
       `styledata` dispara a cada base nova. A guarda evita redesenhar a cada
       tile que chega. */
    instance.on('styledata', () => {
      if (!instance.isStyleLoaded() || instance.getSource(SOURCE)) return;
      montarCamadas();
    });

    instance.on('error', () => setFailed(true));

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  /* Troca a base quando o tema muda, preservando a câmera. O que estava
     desenhado por cima volta pelo ouvinte de `styledata`. */
  const theme = useThemeStore((state) => state.theme);
  useEffect(() => {
    map.current?.setStyle(MAP_STYLE[theme]);
  }, [theme]);

  /* Dados novos reescrevem a fonte. Nunca recriar a camada. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;

    const fonte = instance.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!fonte) return;

    fonte.setData({
      type: 'FeatureCollection',
      features: trips.map((trip) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: trip.position },
        properties: {
          id: trip.id,
          placa: trip.plate,
          cor: trip.delayMinutes > 0 ? AMBER : INDIGO,
          destacado: trip.id === selectedId,
        },
      })),
    });
  }, [trips, selectedId, ready]);

  /* Enquadra a frota uma vez. Refazer o enquadramento a cada clique tiraria o
     mapa do lugar para onde o gestor acabou de olhar. */
  const enquadradasRef = useRef(-1);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || trips.length === 0) return;
    if (enquadradasRef.current === trips.length) return;
    enquadradasRef.current = trips.length;

    instance.fitBounds(envolver(trips.map((trip) => trip.position)), {
      padding: 48,
      maxZoom: 9,
      duration: 600,
    });
  }, [trips, ready]);

  /* Escolher na lista leva o mapa até o caminhão, aproximando só quando ainda
     está longe: puxar o zoom a cada clique faria perder a noção de onde se está. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || selectedId === null) return;

    const trip = trips.find((item) => item.id === selectedId);
    if (!trip) return;

    instance.easeTo({
      center: trip.position,
      zoom: Math.max(instance.getZoom(), 7),
      duration: 650,
    });
  }, [selectedId, trips, ready]);

  if (failed) {
    return (
      <div
        className={cn(
          'bg-surface-lowest flex items-center justify-center rounded-lg p-6',
          className,
        )}
      >
        <p className="text-on-surface-muted text-body-md text-center">
          O mapa não carregou. O mapa ao vivo, no botão acima, tem os mesmos caminhões.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative isolate', className)}>
      <div
        ref={container}
        className="h-full w-full overflow-hidden rounded-lg"
        role="region"
        aria-label="Mapa da frota em viagem"
      />

      {/* A tampa enquanto a base carrega: o elemento precisa existir para o
          MapLibre se instalar, então o aviso cobre em vez de adiar a montagem. */}
      {ready ? null : (
        <div
          className="bg-surface-lowest absolute inset-0 z-10 flex items-center justify-center rounded-lg"
          role="status"
          aria-live="polite"
        >
          <Spinner className="text-on-surface-muted size-5" label="Carregando o mapa" />
        </div>
      )}
    </div>
  );
}

const vazio = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

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
