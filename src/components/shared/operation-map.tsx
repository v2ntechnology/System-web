import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { VEHICLE_STATUS_LABEL } from '@/mocks/fleet/vehicles';
import { useThemeStore } from '@/stores/theme-store';
import type { MapVehicleMarker, VehicleStatus } from '@/types';

/**
 * Mapa vetorial real (MapLibre GL + OpenFreeMap). O provedor é gratuito,
 * sem chave de API e sem limite declarado; a atribuição do OpenStreetMap é
 * inserida automaticamente pela própria biblioteca.
 */
const STYLE_URL = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

/** Centro aproximado do Sudeste, onde a frota simulada se concentra. */
const INITIAL_CENTER: [number, number] = [-46.6333, -20.5];
const INITIAL_ZOOM = 4.2;

const ROUTES_SOURCE = 'rookhub-routes';
const ROUTE_LINE_LAYER = 'rookhub-routes-line';
const ROUTE_GLOW_LAYER = 'rookhub-routes-glow';

const STATUS_COLOR: Record<VehicleStatus, string> = {
  on_trip: 'var(--color-info)',
  available: 'var(--color-success)',
  maintenance: 'var(--color-warning)',
  stopped: 'var(--color-muted-foreground)',
  alert: 'var(--color-destructive)',
};

const LEGEND_CLASS: Record<VehicleStatus, string> = {
  on_trip: 'bg-info',
  available: 'bg-success',
  maintenance: 'bg-warning',
  stopped: 'bg-muted-foreground',
  alert: 'bg-destructive',
};

const LEGEND: VehicleStatus[] = ['on_trip', 'available', 'alert', 'maintenance', 'stopped'];

/** Ícone do caminhão (lucide "truck"), desenhado dentro do marcador. */
const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

interface OperationMapProps {
  markers: MapVehicleMarker[];
  selectedId?: string | null | undefined;
  onSelect?: ((marker: MapVehicleMarker) => void) | undefined;
  className?: string | undefined;
  heightClassName?: string | undefined;
}

/**
 * Curva de apoio para trechos sem traçado rodoviário pré-calculado. Melhor que
 * uma reta, mas não representa as estradas.
 */
function arcBetween(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
): [number, number][] {
  const steps = 48;
  const midLng = (origin.lng + destination.lng) / 2;
  const midLat = (origin.lat + destination.lat) / 2;
  // Desloca o ponto de controle perpendicularmente à linha, gerando a curvatura.
  const controlLng = midLng + (destination.lat - origin.lat) * 0.12;
  const controlLat = midLat - (destination.lng - origin.lng) * 0.12;

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const inv = 1 - t;
    const lng = inv * inv * origin.lng + 2 * inv * t * controlLng + t * t * destination.lng;
    const lat = inv * inv * origin.lat + 2 * inv * t * controlLat + t * t * destination.lat;
    return [lng, lat] as [number, number];
  });
}

function routesGeoJson(markers: MapVehicleMarker[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markers
      .filter((marker) => marker.route)
      .map((marker) => ({
        type: 'Feature' as const,
        properties: {
          plate: marker.plate,
          alert: marker.status === 'alert',
        },
        geometry: {
          type: 'LineString' as const,
          // Traçado rodoviário quando disponível; senão, o arco de apoio.
          coordinates:
            marker.route!.path ?? arcBetween(marker.route!.origin, marker.route!.destination),
        },
      })),
  };
}

/** Marcador do veículo: pino redondo colorido por status com o caminhão dentro. */
function buildMarkerElement(marker: MapVehicleMarker, isSelected: boolean): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'group relative block h-7 w-7 cursor-pointer border-0 bg-transparent p-0';
  el.setAttribute('aria-label', `${marker.plate} — ${VEHICLE_STATUS_LABEL[marker.status]}`);

  const color = STATUS_COLOR[marker.status];

  if (marker.status === 'on_trip' || marker.status === 'alert') {
    const pulse = document.createElement('span');
    pulse.className = 'absolute inset-0 rounded-full opacity-40 animate-pulse-marker';
    pulse.style.backgroundColor = color;
    el.appendChild(pulse);
  }

  const badge = document.createElement('span');
  badge.className = cn(
    'absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2',
    'items-center justify-center rounded-full text-white shadow-md ring-2',
    'transition-transform group-hover:scale-110',
    isSelected && 'scale-125',
  );
  badge.style.backgroundColor = color;
  badge.style.setProperty(
    '--tw-ring-color',
    isSelected ? 'var(--color-primary)' : 'var(--color-background)',
  );
  badge.innerHTML = TRUCK_SVG;
  el.appendChild(badge);

  return el;
}

export function OperationMap({
  markers,
  selectedId,
  onSelect,
  className,
  heightClassName = 'h-[320px]',
}: OperationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // Mantido em ref porque as camadas são recriadas a cada troca de estilo,
  // fora do ciclo de render do React.
  const routesRef = useRef<FeatureCollection>({ type: 'FeatureCollection', features: [] });

  const theme = useThemeStore((s) => s.theme);

  // Cria o mapa uma única vez e o destrói ao desmontar.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL[theme],
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: 45,
      bearing: -12,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    // As camadas de rota precisam ser recriadas sempre que o estilo é trocado.
    const addRouteLayers = () => {
      if (map.getSource(ROUTES_SOURCE)) return;

      map.addSource(ROUTES_SOURCE, { type: 'geojson', data: routesRef.current });

      map.addLayer({
        id: ROUTE_GLOW_LAYER,
        type: 'line',
        source: ROUTES_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'alert'], '#ef4444', '#06b6d4'],
          'line-width': 7,
          'line-blur': 6,
          'line-opacity': 0.35,
        },
      });

      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: 'line',
        source: ROUTES_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'alert'], '#ef4444', '#22d3ee'],
          'line-width': 2.5,
        },
      });
    };

    map.on('load', addRouteLayers);
    map.on('styledata', addRouteLayers);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // O tema inicial é lido só na criação; trocas são tratadas no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca o estilo quando o tema muda, preservando a posição da câmera.
  useEffect(() => {
    mapRef.current?.setStyle(STYLE_URL[theme]);
  }, [theme]);

  // Sincroniza rotas e marcadores com a lista recebida.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routesRef.current = routesGeoJson(markers);
    map.getSource<maplibregl.GeoJSONSource>(ROUTES_SOURCE)?.setData(routesRef.current);

    for (const marker of markersRef.current) marker.remove();

    markersRef.current = markers.map((item) => {
      const element = buildMarkerElement(item, selectedId === item.id);
      element.addEventListener('click', () => onSelect?.(item));

      return new maplibregl.Marker({ element })
        .setLngLat([item.position.lng, item.position.lat])
        .addTo(map);
    });

    return () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    };
  }, [markers, selectedId, onSelect]);

  const routeCount = markers.filter((marker) => marker.route).length;

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border', className)}>
      <div ref={containerRef} className={cn('w-full', heightClassName)} />

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-border bg-background/80 px-3 py-2 backdrop-blur">
        {LEGEND.map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className={cn('h-2 w-2 rounded-full', LEGEND_CLASS[status])} />
            {VEHICLE_STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {markers.length} veículos
        {routeCount > 0 && <span className="text-muted-foreground/70">· {routeCount} em rota</span>}
      </div>
    </div>
  );
}
