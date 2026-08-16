import { describe, expect, it } from 'vitest';

import { buildVehicleMarker, VEHICLES } from './vehicles';

describe('buildVehicleMarker', () => {
  const markers = VEHICLES.filter((v) => v.lastPosition).map(buildVehicleMarker);

  it('usa coordenadas reais, nunca a ilha nula', () => {
    for (const marker of markers) {
      expect(marker.position.lat).not.toBe(0);
      expect(marker.position.lng).not.toBe(0);
      expect(marker.position.lat).toBeGreaterThan(-35);
      expect(marker.position.lat).toBeLessThan(6);
      expect(marker.position.lng).toBeGreaterThan(-75);
      expect(marker.position.lng).toBeLessThan(-33);
    }
  });

  it('anexa origem e destino aos veículos com viagem ativa', () => {
    const comRota = markers.filter((m) => m.route);
    expect(comRota.length).toBeGreaterThan(0);

    for (const marker of comRota) {
      expect(marker.route?.origin.city).toBeTruthy();
      expect(marker.route?.destination.city).toBeTruthy();
      expect(marker.route?.origin.lat).not.toBe(marker.route?.destination.lat);
    }
  });

  it('traz o traçado rodoviário pré-calculado das viagens conhecidas', () => {
    const comTracado = markers.filter((m) => m.route?.path);
    expect(comTracado.length).toBeGreaterThan(0);

    for (const marker of comTracado) {
      const path = marker.route!.path!;
      // Um traçado por estrada tem vários vértices; um arco reto teria poucos.
      expect(path.length).toBeGreaterThan(10);
      expect(marker.route!.distanceKm).toBeGreaterThan(0);

      const [primeiroLng, primeiroLat] = path[0]!;
      expect(primeiroLng).toBeCloseTo(marker.route!.origin.lng, 0);
      expect(primeiroLat).toBeCloseTo(marker.route!.origin.lat, 0);
    }
  });

  it('não inventa rota para veículo parado ou em manutenção', () => {
    const parados = markers.filter((m) => m.status === 'stopped' || m.status === 'maintenance');
    for (const marker of parados) {
      expect(marker.route).toBeUndefined();
    }
  });
});
