import type { MechanicalAlert } from '@/management/lib/fleet-api';

/**
 * O agrupamento dos alertas mecânicos, fora da árvore de componentes.
 *
 * Mora aqui, e não dentro da fila, porque a página precisa dos MESMOS números
 * nos cards que encostam na faixa: recontar lá dentro abriria espaço para os
 * dois divergirem. É o mesmo arranjo de `overview/blockers.ts` para a tela de
 * impedimentos.
 */

export interface VeiculoComAlerta {
  vehicleId: string;
  plate: string;
  model?: string | undefined;
  /** Unidade/filial do veículo, quando o rastreador informa. */
  unidade?: string | undefined;
  total: number;
  ultimo: string;
  odometro?: number | undefined;
  tipos: MechanicalAlert[];
}

export interface ResumoMecanico {
  /** Veículos do mais barulhento para o mais quieto. */
  veiculos: VeiculoComAlerta[];
  /** Tipos de alerta e quanto cada um somou, do maior para o menor. */
  porTipo: [string, number][];
  /** Ocorrências somadas na janela inteira. */
  total: number;
  /** A ocorrência mais recente da frota, ou `null` quando não há alerta. */
  ultimo: string | null;
  /** As unidades presentes no recorte, em ordem alfabética, para o seletor. */
  unidades: string[];
}

/**
 * O nome do tipo como o fornecedor o cadastrou, em caixa de frase.
 *
 * ⚠️ O rastreador manda TUDO EM MAIÚSCULA ("PRESSÃO BAIXA DO ÓLEO EURO 5"), e
 * numa fileira de pastilhas isso vira um paredão que ninguém varre com o olho:
 * caixa alta tira o contorno das palavras, que é por onde a leitura rápida
 * acontece. O `normal-case` do CSS não resolve: a maiúscula está no DADO.
 *
 * A conversão só acontece quando o texto é INTEIRO maiúsculo. Se o fornecedor
 * um dia mandar "Pressão baixa do óleo Euro 5", ela não mexe, e quem mexesse
 * estragaria a caixa que já estava certa. "Euro" volta com inicial porque é
 * nome de norma, e não palavra comum.
 */
export function formatAlertDescription(description: string): string {
  const texto = description.trim();
  if (texto !== texto.toLocaleUpperCase('pt-BR')) return texto;

  const minusculo = texto.toLocaleLowerCase('pt-BR');

  return (
    minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1).replace(/\beuro\b/g, 'Euro')
  );
}

/**
 * Agrupa a resposta do backend por veículo.
 *
 * A API devolve por veículo E tipo, que é a granularidade certa para a oficina.
 * A tela agrupa por veículo porque a pergunta de quem lê é "qual caminhão
 * levar", e não "qual sensor dispara mais".
 *
 * Exportado porque a página precisa dos mesmos números nos cards que encostam na
 * faixa: recontar lá dentro abriria espaço para os dois divergirem.
 */
export function aggregateMechanicalAlerts(alerts: MechanicalAlert[]): ResumoMecanico {
  const mapa = new Map<string, VeiculoComAlerta>();
  const tipos = new Map<string, number>();
  const unidades = new Set<string>();
  let ultimo: string | null = null;

  for (const alerta of alerts) {
    tipos.set(alerta.description, (tipos.get(alerta.description) ?? 0) + alerta.occurrences);
    if (ultimo === null || alerta.lastAt > ultimo) ultimo = alerta.lastAt;
    if (alerta.unit) unidades.add(alerta.unit);

    const atual = mapa.get(alerta.vehicleId);
    if (!atual) {
      mapa.set(alerta.vehicleId, {
        vehicleId: alerta.vehicleId,
        plate: alerta.plate,
        model: alerta.model,
        unidade: alerta.unit,
        total: alerta.occurrences,
        ultimo: alerta.lastAt,
        odometro: alerta.lastOdometerKm,
        tipos: [alerta],
      });
      continue;
    }

    atual.total += alerta.occurrences;
    atual.tipos.push(alerta);
    /* A data e o odômetro são os da ocorrência MAIS RECENTE entre os tipos. */
    if (alerta.lastAt > atual.ultimo) {
      atual.ultimo = alerta.lastAt;
      atual.odometro = alerta.lastOdometerKm;
    }
  }

  return {
    veiculos: [...mapa.values()].sort((a, b) => b.total - a.total),
    porTipo: [...tipos.entries()].sort((a, b) => b[1] - a[1]),
    total: alerts.reduce((soma, a) => soma + a.occurrences, 0),
    ultimo,
    unidades: [...unidades].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}
