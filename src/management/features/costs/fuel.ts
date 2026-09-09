import type { VehiclePerformance } from '@/management/lib/fleet-api';

/**
 * O agrupamento do consumo, fora da árvore de componentes.
 *
 * Mora aqui porque a página precisa dos MESMOS números nos cards que encostam na
 * faixa e a lista precisa dos grupos: recontar nos dois lugares abriria espaço
 * para eles divergirem. Mesmo arranjo de `maintenance/alerts.ts`.
 */

/** Onde caem os veículos sem categoria no cadastro. */
export const SEM_CATEGORIA = 'sem-categoria';

/** O rótulo do tipo, com o cru do cadastro como reserva. */
const TIPO: Record<string, string> = {
  van: 'Van',
  truck: 'Caminhão',
  tractor_unit: 'Cavalo',
  trailer: 'Carreta',
  light: 'Leve',
  [SEM_CATEGORIA]: 'Sem categoria',
};

export function rotuloDoTipo(categoria: string): string {
  return TIPO[categoria] ?? categoria;
}

export interface GrupoDeConsumo {
  categoria: string;
  itens: VehiclePerformance[];
  /** Média ponderada pelos quilômetros, ou `null` sem litro nenhum. */
  media: number | null;
}

export interface ResumoDeConsumo {
  grupos: GrupoDeConsumo[];
  /** Quem rodou E informa combustível, do mais econômico para o menos. */
  medidos: VehiclePerformance[];
  /** Quem rodou sem informar litro. ⚠️ Nunca vira zero. */
  semMedicao: VehiclePerformance[];
  kmTotal: number;
}

/**
 * Agrupa o desempenho por categoria de veículo.
 *
 * ⚠️ **Van não se compara com compactador.** Medido em produção em 06/09/2026:
 * as vans fazem de 8,7 a 15,3 km/l e os compactadores de 1,7 a 3,5. Um ranking
 * único premiaria as vans todo mês, e o gestor concluiria que os compactadores
 * estão sendo mal dirigidos. Por isso a comparação acontece DENTRO do grupo, e
 * cada grupo traz a própria média.
 *
 * A média do grupo é ponderada pela QUILOMETRAGEM, e não a média das médias: um
 * veículo que rodou 200 km não pode pesar igual a um que rodou 3.000.
 */
export function aggregateFuel(vehicles: VehiclePerformance[]): ResumoDeConsumo {
  /* Só entra quem rodou: veículo parado o período inteiro não tem consumo para
     comparar, e ocuparia a lista sem dizer nada. */
  const rodaram = vehicles.filter((v) => (v.distanceKm ?? 0) > 0);
  const comConsumo = rodaram
    .filter((v) => v.fuelEfficiency != null)
    .sort((a, b) => (b.fuelEfficiency ?? 0) - (a.fuelEfficiency ?? 0));

  const porCategoria = new Map<string, VehiclePerformance[]>();
  for (const veiculo of comConsumo) {
    const chave = veiculo.type ?? SEM_CATEGORIA;
    const atual = porCategoria.get(chave);
    if (atual) atual.push(veiculo);
    else porCategoria.set(chave, [veiculo]);
  }

  return {
    grupos: [...porCategoria.entries()]
      .map(([categoria, itens]) => {
        const km = itens.reduce((soma, v) => soma + (v.distanceKm ?? 0), 0);
        const litros = itens.reduce(
          (soma, v) => soma + (v.distanceKm ?? 0) / (v.fuelEfficiency || 1),
          0,
        );
        return { categoria, itens, media: litros > 0 ? km / litros : null };
      })
      /* O grupo maior primeiro: é onde está a operação. */
      .sort((a, b) => b.itens.length - a.itens.length),
    medidos: comConsumo,
    semMedicao: rodaram.filter((v) => v.fuelEfficiency == null),
    kmTotal: rodaram.reduce((soma, v) => soma + (v.distanceKm ?? 0), 0),
  };
}
