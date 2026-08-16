import type { GeoPosition } from '@/types';

/** Coordenadas reais das cidades onde a frota simulada opera. */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
  'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
  Curitiba: { lat: -25.4284, lng: -49.2733 },
  Campinas: { lat: -22.9056, lng: -47.0608 },
  Goiânia: { lat: -16.6869, lng: -49.2643 },
  Brasília: { lat: -15.7939, lng: -47.8828 },
  'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
  Florianópolis: { lat: -27.5954, lng: -48.548 },
  Salvador: { lat: -12.9777, lng: -38.5014 },
  Aracaju: { lat: -10.9472, lng: -37.0731 },
  Recife: { lat: -8.0476, lng: -34.877 },
  'João Pessoa': { lat: -7.115, lng: -34.8631 },
  Londrina: { lat: -23.3045, lng: -51.1628 },
  Uberlândia: { lat: -18.9186, lng: -48.2772 },
  'Ribeirão Preto': { lat: -21.1704, lng: -47.8103 },
  Vitória: { lat: -20.3155, lng: -40.3128 },
};

/** Centro do país, usado quando a cidade não está mapeada. */
const FALLBACK = { lat: -15.7939, lng: -47.8828 };

/** Resolve "São Paulo, SP" (ou só "São Paulo") em uma posição geográfica. */
export function coordsForPlace(place: string): GeoPosition {
  const [cityPart, statePart] = place.split(',').map((part) => part.trim());
  const city = cityPart ?? place;
  const base = CITY_COORDS[city] ?? FALLBACK;
  return { ...base, city, state: statePart ?? '' };
}
