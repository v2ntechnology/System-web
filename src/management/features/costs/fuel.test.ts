import type { VehiclePerformance } from '@/management/lib/fleet-api';
import { describe, expect, it } from 'vitest';

import { SEM_CATEGORIA, aggregateFuel } from './fuel';

/**
 * A régua do consumo, que precisa ser a MESMA em toda tela que compara veículo.
 *
 * ⚠️ Estes casos existem porque a divergência já aconteceu: até 09/09/2026 o
 * card do dono (`owner/components/vehicle-performance-card.tsx`) tinha cálculo
 * próprio, por média das médias. Medido nos dados de produção do dia, ele dava
 * 4,55 km/l para "truck" onde a régua ponderada dá 3,56, uma superestimação de
 * 27,7%. Quem mexer aqui está mexendo no número de todas essas telas.
 */

const veiculo = (
  plate: string,
  distanceKm: number | undefined,
  fuelEfficiency: number | undefined,
  type?: string,
): VehiclePerformance => ({
  vehicleId: plate,
  plate,
  model: 'MODELO',
  ...(type != null ? { type } : {}),
  ...(distanceKm != null ? { distanceKm } : {}),
  ...(fuelEfficiency != null ? { fuelEfficiency } : {}),
  journeys: 1,
  daysUsed: 1,
  events: 0,
});

describe('aggregateFuel', () => {
  it('pondera a média pela quilometragem, e não é a média das médias', () => {
    /* Um que quase não saiu e um que rodou o mês. A média das médias daria
       (10 + 2) / 2 = 6 km/l, número que não descreve frota nenhuma. */
    const { grupos } = aggregateFuel([
      veiculo('CURTO', 200, 10, 'truck'),
      veiculo('LONGO', 3000, 2, 'truck'),
    ]);

    const truck = grupos.find((g) => g.categoria === 'truck');
    /* 3.200 km rodados sobre 20 + 1.500 = 1.520 litros. */
    expect(truck?.media).toBeCloseTo(3200 / 1520, 4);
    expect(truck?.media).toBeLessThan(6);
  });

  it('deixa de fora quem rodou sem informar litro, e nunca o conta como zero', () => {
    const resumo = aggregateFuel([
      veiculo('MEDE', 1000, 4, 'truck'),
      veiculo('NAOMEDE', 1000, undefined, 'truck'),
    ]);

    expect(resumo.semMedicao.map((v) => v.plate)).toEqual(['NAOMEDE']);
    expect(resumo.grupos[0]?.itens.map((v) => v.plate)).toEqual(['MEDE']);
    /* Contado como zero, a média cairia para 2. */
    expect(resumo.grupos[0]?.media).toBeCloseTo(4, 4);
  });

  it('ignora veículo parado no período', () => {
    const resumo = aggregateFuel([
      veiculo('RODOU', 1000, 3, 'truck'),
      veiculo('PARADO', 0, 12, 'truck'),
    ]);

    expect(resumo.medidos.map((v) => v.plate)).toEqual(['RODOU']);
    expect(resumo.grupos[0]?.media).toBeCloseTo(3, 4);
  });

  it('separa por categoria, para van não ser comparada com compactador', () => {
    const { grupos } = aggregateFuel([
      veiculo('CAM1', 1000, 3, 'truck'),
      veiculo('CAM2', 1000, 3, 'truck'),
      veiculo('VAN1', 1000, 12, 'van'),
    ]);

    expect(grupos.map((g) => g.categoria)).toEqual(['truck', 'van']);
    expect(grupos.find((g) => g.categoria === 'truck')?.media).toBeCloseTo(3, 4);
    expect(grupos.find((g) => g.categoria === 'van')?.media).toBeCloseTo(12, 4);
  });

  it('joga quem não tem categoria no grupo próprio, e não em caminhão', () => {
    /* ⚠️ O card do dono mandava estes para `truck`, e o mesmo veículo caía em
       grupos diferentes conforme a tela. */
    const { grupos } = aggregateFuel([veiculo('SEMTIPO', 1000, 5, undefined)]);

    expect(grupos[0]?.categoria).toBe(SEM_CATEGORIA);
  });
});
