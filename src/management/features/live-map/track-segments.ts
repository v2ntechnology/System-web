import type { TrackPoint } from '@/management/lib/fleet-api';

/**
 * Prepara a rota bruta da telemetria para virar linha no mapa.
 *
 * <h2>O problema, medido antes de escrever</h2>
 *
 * O mapa ligava leitura a leitura, sem perguntar quanto tempo passou entre uma e
 * outra. Numa base local com coleta intermitente, isso desenhou o RDU8D06
 * cruzando 20,9 km em linha reta sobre um trecho sem estrada, porque entre as
 * duas leituras houve **11 horas e 25 minutos sem nenhum dado**. A linha não
 * mentia por defeito de desenho: ela afirmava um percurso que ninguém mediu.
 *
 * <h2>O que o mercado faz, e por que copiamos</h2>
 *
 * É o mesmo problema que os motores de map matching resolvem com o parâmetro
 * `gaps=split` do OSRM. A documentação deles é literal: sem ele, o motor tenta
 * ligar as duas pontas com uma rota real e produz um desvio de vários
 * quilômetros que nunca aconteceu. A recomendação é sempre dividir, e só
 * costurar quando a lacuna é conhecida e curta, como um túnel.
 *
 * ⚠️ **Reta entre dois pontos não é errada por si.** A Geotab reduz a série com
 * Ramer-Douglas-Peucker, de 1116 pontos para 148 num exemplo publicado, e a
 * garantia do método é que entre dois pontos guardados o movimento é
 * aceitavelmente linear. Ali a reta representa o que houve. O que este arquivo
 * separa é o outro caso: a reta que só existe porque faltou dado.
 *
 * <h2>Escolha de projeto</h2>
 *
 * A lacuna não é apagada, é DESENHADA diferente. Sumir com ela esconderia que a
 * frota tem buraco de cobertura, que é justamente uma informação de operação.
 */

/** Um trecho contínuo, em que cada ponto foi realmente medido. */
export type Segmento = [number, number][];

/** O vão entre dois trechos: o que a telemetria não viu. */
export interface Lacuna {
  /** As duas pontas, para desenhar o tracejado. */
  de: [number, number];
  para: [number, number];
  minutos: number;
  km: number;
}

export interface TrajetoPreparado {
  segmentos: Segmento[];
  lacunas: Lacuna[];
  /** Leituras jogadas fora por serem fisicamente impossíveis. */
  descartados: number;
  /** Todas as coordenadas que sobreviveram, para enquadrar a câmera. */
  coordenadas: [number, number][];
}

/**
 * Acima disto, a reta deixa de ser percurso e passa a ser lacuna.
 *
 * Cinco minutos porque a MiX entrega uma leitura a cada 30 segundos quando a
 * coleta está saudável: dez leituras perdidas seguidas já é interrupção, não
 * respiro. Em produção, medido em 06/09/2026, o RDU8D06 teve 13.565 posições em
 * 72 horas e nenhum intervalo desse tamanho.
 */
const LACUNA_MINUTOS = 5;

/**
 * E acima disto também, mesmo que o relógio não acuse.
 *
 * O Google recomenda pontos a menos de 300 metros um do outro para o snap à via
 * ser confiável. Um quilômetro é o triplo disso: folgado o bastante para não
 * picotar rodovia em fluxo livre, curto o bastante para não emendar bairros
 * diferentes com um traço.
 */
const LACUNA_KM = 1;

/**
 * Abaixo disto, o veículo não saiu do lugar, e silêncio não é lacuna.
 *
 * ⚠️ Achado nos dados REAIS de produção: sem esta condição, o RDU8D06 tinha 70
 * "trechos sem leitura" em 24 horas, e quase todos eram o caminhão parado no
 * pátio por mais de cinco minutos. Parada não é buraco de cobertura: o dado
 * chegou, o veículo é que não andou. Contá-la como lacuna enchia a tela de um
 * aviso falso e quebrava a linha em pedaços sem motivo.
 *
 * Cinquenta metros é a ordem de grandeza do tremor de GPS de um veículo
 * parado, então abaixo disso nem deslocamento houve.
 */
const DESLOCAMENTO_MINIMO_KM = 0.05;

/**
 * Velocidade que nenhum caminhão faz, usada para achar leitura espúria.
 *
 * ⚠️ Isto NÃO é filtro de excesso de velocidade. É descarte de coordenada
 * impossível: em produção existe um salto de 3,3 km com zero minuto de
 * intervalo, que daria velocidade infinita. Um ponto assim é erro do GPS, e
 * mantê-lo cria dois bicos na linha, o de ida e o de volta.
 */
const VELOCIDADE_IMPOSSIVEL_KMH = 200;

/** Distância em linha reta entre duas coordenadas, em quilômetros. */
function distanciaKm([lngA, latA]: [number, number], [lngB, latB]: [number, number]): number {
  const R = 6371;
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const cosseno =
    Math.sin(rad(latA)) * Math.sin(rad(latB)) +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.cos(rad(lngB) - rad(lngA));
  /* O `clamp` evita `NaN`: com pontos praticamente iguais, o arredondamento do
     ponto flutuante devolve 1,0000000002 e o `acos` desiste. */
  return R * Math.acos(Math.min(1, Math.max(-1, cosseno)));
}

/**
 * Divide a rota em trechos medidos, separando as lacunas.
 *
 * Assume a lista em ordem cronológica, que é como a API entrega: a consulta do
 * `Backend-web` ordena por `recorded_at`, e foi conferido na resposta real que
 * nenhum ponto vem fora de ordem.
 */
export function prepararTrajeto(points: TrackPoint[]): TrajetoPreparado {
  const segmentos: Segmento[] = [];
  const lacunas: Lacuna[] = [];
  const coordenadas: [number, number][] = [];
  let descartados = 0;

  let atual: Segmento = [];
  let anterior: TrackPoint | null = null;

  const fecharSegmento = () => {
    /* Trecho de um ponto só não vira linha, e deixá-lo na lista faria o mapa
       receber uma geometria degenerada. Ele já está em `coordenadas`, então
       continua contando para o enquadramento. */
    if (atual.length >= 2) segmentos.push(atual);
    atual = [];
  };

  for (const ponto of points) {
    if (!anterior) {
      anterior = ponto;
      atual.push(ponto.coordinates);
      coordenadas.push(ponto.coordinates);
      continue;
    }

    const km = distanciaKm(anterior.coordinates, ponto.coordinates);
    const minutos = (Date.parse(ponto.at) - Date.parse(anterior.at)) / 60000;

    /* Leitura impossível: descartada sem quebrar o trecho, porque o problema é
       dela e não do trajeto. O ponto seguinte volta a ser comparado com o
       último ponto BOM, e não com o espúrio. */
    if (minutos >= 0 && km / Math.max(minutos / 60, 1 / 3600) > VELOCIDADE_IMPOSSIVEL_KMH) {
      descartados++;
      continue;
    }

    /*
     * Duas portas para a lacuna, e a primeira exige as DUAS condições: tempo
     * longo e deslocamento real. A segunda pega o salto grande que aconteceu
     * rápido demais para ter sido percorrido com leitura.
     */
    const silencioComDeslocamento = minutos > LACUNA_MINUTOS && km > DESLOCAMENTO_MINIMO_KM;
    if (silencioComDeslocamento || km > LACUNA_KM) {
      lacunas.push({
        de: anterior.coordinates,
        para: ponto.coordinates,
        minutos: Math.round(minutos),
        km: Math.round(km * 10) / 10,
      });
      fecharSegmento();
    }

    atual.push(ponto.coordinates);
    coordenadas.push(ponto.coordinates);
    anterior = ponto;
  }

  fecharSegmento();
  return { segmentos, lacunas, descartados, coordenadas };
}

/**
 * A lacuna em palavras, para a tela dizer o tamanho do buraco.
 *
 * Minuto até uma hora, e hora com fração depois disso: "685 minutos" obriga
 * quem lê a fazer a conta que a frase deveria ter feito.
 */
export function descreverLacuna(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
