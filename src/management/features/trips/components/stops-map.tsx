import type { FrequentStop } from '@/management/lib/fleet-api';
import { cn } from '@/management/ui';
import type { FeatureCollection } from 'geojson';
import { type GeoJSONSource, Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

/* Mesmo estilo do mapa ao vivo: dois mapas com bases diferentes na mesma
   sessão fazem o usuário achar que está olhando cidades diferentes. */
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const SOURCE = 'stops';
const LAYER_HALO = 'stops-halo';
const LAYER_CIRCLE = 'stops-circle';
const LAYER_LABEL = 'stops-label';

export interface StopsMapProps {
  stops: FrequentStop[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  className?: string | undefined;
}

/**
 * Onde a frota fica parada.
 *
 * <h2>O raio é a raiz do tempo, e não o tempo</h2>
 *
 * A base concentra 122 horas e o segundo lugar tem 30. Em escala linear o
 * primeiro círculo cobriria a cidade inteira e todos os outros virariam pontos
 * idênticos. Com a raiz quadrada a diferença continua legível e o resto do mapa
 * continua existindo.
 *
 * <h2>Por que um mapa próprio, e não o da frota</h2>
 *
 * O mapa ao vivo responde "onde está cada caminhão agora" e se atualiza a cada
 * quatro segundos. Este responde "onde a frota perde tempo" e olha trinta dias
 * para trás. Misturar os dois numa camada opcional deixaria um componente com
 * duas noções de tempo e nenhuma delas clara na tela.
 */
export function StopsMap({ stops, selectedIndex, onSelect, className }: StopsMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Handler em ref: trocar a parada selecionada não pode recriar o listener. */
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
      zoom: 8.6,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: 'fleet-popup',
    });

    instance.on('load', () => {
      instance.addSource(SOURCE, { type: 'geojson', data: vazio() });

      /* Halo só sob a parada selecionada, para a lista e o mapa apontarem
         visivelmente para o mesmo lugar. */
      instance.addLayer({
        id: LAYER_HALO,
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['get', 'destacada'], true],
        paint: {
          'circle-radius': ['+', ['get', 'raio'], 9],
          'circle-color': '#F8FAFC',
          'circle-opacity': 0.22,
        },
      });

      instance.addLayer({
        id: LAYER_CIRCLE,
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': ['get', 'raio'],
          /* Do azul (passagem rápida) ao âmbar (o veículo dorme ali). A escala é
             a média por parada: um lugar com muitas paradas curtas não é o mesmo
             problema que um com poucas paradas longas. */
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'mediaHoras'],
            0.5,
            '#38BDF8',
            3,
            '#818CF8',
            8,
            '#FBBF24',
          ],
          'circle-opacity': 0.78,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0F172A',
          'circle-stroke-opacity': 0.55,
        },
      });

      instance.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE,
        /* Só os lugares com peso ganham rótulo: etiquetar quarenta paradas
           empilharia texto sobre texto e nenhuma ficaria legível. */
        filter: ['>=', ['get', 'horas'], 4],
        layout: {
          'text-field': ['get', 'rotulo'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#E2E8F0',
          'text-halo-color': '#0F172A',
          'text-halo-width': 1.4,
        },
      });

      instance.on('click', LAYER_CIRCLE, (evento) => {
        const indice = evento.features?.[0]?.properties?.['indice'];
        if (typeof indice === 'number') onSelectRef.current(indice);
      });

      instance.on('mouseenter', LAYER_CIRCLE, (evento) => {
        instance.getCanvas().style.cursor = 'pointer';
        const feature = evento.features?.[0];
        if (!feature) return;

        const propriedades = feature.properties ?? {};
        popup
          .setLngLat(evento.lngLat)
          .setHTML(
            `<strong>${escapar(String(propriedades['lugar'] ?? 'Sem endereço'))}</strong>` +
              `<span>${escapar(String(propriedades['resumo'] ?? ''))}</span>`,
          )
          .addTo(instance);
      });

      instance.on('mouseleave', LAYER_CIRCLE, () => {
        instance.getCanvas().style.cursor = '';
        popup.remove();
      });

      setReady(true);
    });

    instance.on('error', () => setFailed(true));
    map.current = instance;

    return () => {
      popup.remove();
      instance.remove();
      map.current = null;
    };
  }, []);

  /* Dados novos reescrevem a fonte. Nunca recriar a camada. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;

    const fonte = instance.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!fonte) return;

    const maior = stops.reduce((maximo, parada) => Math.max(maximo, parada.totalHours), 0);

    fonte.setData({
      type: 'FeatureCollection',
      features: stops.map((parada, indice) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: parada.coordinates },
        properties: {
          indice,
          horas: parada.totalHours,
          mediaHoras: parada.stops > 0 ? parada.totalHours / parada.stops : 0,
          raio: raio(parada.totalHours, maior),
          destacada: indice === selectedIndex,
          lugar: encurtar(parada.address),
          rotulo: `${Math.round(parada.totalHours)} h`,
          resumo:
            `${parada.stops} ${parada.stops === 1 ? 'parada' : 'paradas'} · ` +
            `${parada.vehicles} ${parada.vehicles === 1 ? 'veículo' : 'veículos'} · ` +
            `${parada.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h no total`,
        },
      })),
    });
  }, [stops, selectedIndex, ready]);

  /* Enquadrar só quando o conjunto muda de tamanho: refazer o enquadramento a
     cada clique tiraria o mapa do lugar onde o usuário acabou de olhar. */
  const enquadradasRef = useRef(-1);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || stops.length === 0) return;
    if (enquadradasRef.current === stops.length) return;
    enquadradasRef.current = stops.length;

    instance.fitBounds(envolver(stops.map((parada) => parada.coordinates)), {
      padding: 70,
      maxZoom: 12,
      duration: 700,
    });
  }, [stops, ready]);

  /* Selecionar na lista leva o mapa até o ponto, sem trocar o nível de zoom:
     aproximar sozinho faria o usuário perder a noção de onde estava. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || selectedIndex == null) return;

    const parada = stops[selectedIndex];
    if (!parada) return;

    instance.easeTo({
      center: parada.coordinates,
      zoom: Math.max(instance.getZoom(), 11),
      duration: 650,
    });
  }, [selectedIndex, stops, ready]);

  if (failed) {
    return (
      <div
        className={cn(
          'bg-surface-lowest flex items-center justify-center rounded-xl p-6',
          className,
        )}
      >
        <p className="text-on-surface-muted text-body-md text-center">
          O mapa não carregou. A lista ao lado tem os mesmos lugares, na mesma ordem.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={container}
      className={cn('overflow-hidden rounded-xl', className)}
      role="region"
      aria-label="Mapa das paradas frequentes"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Apoio                                                                       */
/* -------------------------------------------------------------------------- */

const vazio = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Raiz quadrada do tempo, entre 7 e 34 pixels. Ver a nota do componente. */
function raio(horas: number, maior: number): number {
  if (maior <= 0) return 7;
  return 7 + Math.sqrt(horas / maior) * 27;
}

/** O endereço da MiX vem com CEP e país, que não cabem num rótulo de mapa. */
function encurtar(endereco: string | undefined): string {
  if (!endereco) return 'Endereço não informado';
  const partes = endereco.split(',').map((parte) => parte.trim());
  return partes.slice(0, 3).join(', ');
}

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

/** Endereço vem do cliente e entra como HTML no popup. Escapar não é paranoia. */
function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
