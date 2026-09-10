import type { TrackPoint } from '@/management/lib/fleet-api';

import { prepararTrajeto } from './track-segments';

/**
 * A linha do tempo do replay: quando o caminhão está onde.
 *
 * <h2>Por que o replay engasgava</h2>
 *
 * ⚠️ A versão anterior avançava por ÍNDICE DE PONTO, dez por segundo, e é essa
 * a causa exata do defeito que o usuário descreveu ("dá uma seguidinha, dá uma
 * engasgada e aparece lá na frente"). As leituras não são igualmente espaçadas:
 *
 *   - Parado num semáforo, a telemetria manda dezenas de leituras no mesmo
 *     ponto. O contador de índices continua correndo e o caminhão fica parado
 *     por segundos de animação, sem nada acontecer na tela.
 *   - Numa lacuna de 20 km, as duas pontas são leituras CONSECUTIVAS. Um índice
 *     só. A um décimo de segundo, o caminhão reaparece do outro lado do mapa.
 *
 * O índice mede quantidade de dado, e não passagem de tempo nem distância
 * percorrida. Animar por ele é animar pelo ritmo do rastreador.
 *
 * <h2>O que o mercado faz</h2>
 *
 * Replay profissional é sincronizado ao RELÓGIO, não ao índice: o LeafletPlayback
 * e o Trip Replay da Geotab tocam o trajeto como vídeo, com barra de tempo e
 * velocidade. E todos tratam lacuna explicitamente: o LeafletPlayback tem
 * `maxInterpolationTime`, com padrão de 5 minutos, acima do qual ele deixa de
 * fingir movimento entre as duas leituras. É o mesmo limiar que
 * {@link prepararTrajeto} já usa para quebrar a linha, e aqui ele volta com
 * outro papel: definir o que o replay ATRAVESSA e o que ele PULA.
 *
 * <h2>O tempo virtual</h2>
 *
 * O relógio do replay não é o relógio do dia. Se fosse, um trajeto de 72 horas
 * com o caminhão dez horas parado num pátio teria dez horas de tela sem nada
 * acontecendo. Então cada trecho consome tempo virtual proporcional ao tempo
 * real, com dois ajustes:
 *
 *   1. Parada longa é COMPRIMIDA, por {@link TETO_POR_PASSO_S}. O caminhão
 *      parado continua parado, mas por um instante, e não pelo tempo do café do
 *      motorista.
 *   2. Lacuna custa {@link CUSTO_DA_LACUNA_S}, um valor fixo e curto. O
 *      caminhão atravessa o vão devagar e visivelmente, em vez de teleportar,
 *      mas sem gastar as onze horas que ela representa.
 *
 * No fim, tudo é reescalado para o trajeto inteiro durar
 * {@link DURACAO_ALVO_S} na velocidade 1x, seja ele de 6 ou de 72 horas. Sem
 * isso, a mesma velocidade daria uma corrida na janela curta e uma eternidade na
 * longa.
 */

/**
 * Quanto dura o replay inteiro na velocidade normal, em segundos.
 *
 * ⚠️ Eram 40 até 09/09/2026, e o usuário relatou o que isso significava na tela:
 * "na velocidade 1x está absurdamente rápido, o 1x de hoje é na verdade o 4x".
 * Ele tinha razão, e a conta explica: o trajeto inteiro cabia em 40 segundos, de
 * modo que um dia de rodagem passava em menos tempo do que se leva para ler a
 * placa. O número quadruplicou para que o 1x seja de fato uma velocidade de
 * leitura, e a escala inteira desceu junto: o 4x de agora é exatamente o 1x de
 * antes, que continua alcançável para quem só quer ver o trajeto correr.
 *
 * O efeito é o mesmo em qualquer janela, porque tudo é reescalado para este
 * número: 2min40 a 1x, 1min20 a 2x e 40s a 4x, seja o trajeto de 6 ou de 72
 * horas.
 */
const DURACAO_ALVO_S = 160;

/**
 * Teto de tempo real que um único passo pode consumir.
 *
 * Trinta segundos é o intervalo nominal de uma leitura da MiX: um passo que
 * custe mais que isso é parada, e parada não precisa ser assistida em tempo
 * proporcional.
 */
const TETO_POR_PASSO_S = 30;

/**
 * O custo de atravessar uma lacuna, em unidades de tempo real.
 *
 * Sessenta segundos, o dobro de um passo normal: a travessia fica visivelmente
 * mais lenta que o resto, que é o sinal de que ali está acontecendo outra coisa.
 */
const CUSTO_DA_LACUNA_S = 60;

export interface QuadroDoReplay {
  lng: number;
  lat: number;
  heading: number;
  /** O instante REAL da leitura mais próxima, para o relógio da tela. */
  at: string;
  speedKmh: number | undefined;
  /** Verdadeiro enquanto o caminhão atravessa um vão sem leitura. */
  emLacuna: boolean;
}

interface Passo {
  de: TrackPoint;
  para: TrackPoint;
  /** Onde este passo começa, no tempo virtual acumulado. */
  inicio: number;
  duracao: number;
  emLacuna: boolean;
  /** Rumo do passo, calculado uma vez e não a cada quadro. */
  heading: number;
}

export interface LinhaDoTempo {
  passos: Passo[];
  /** Tempo virtual total, já reescalado para segundos de tela a 1x. */
  duracao: number;
  /** Vazia quando não há o que animar. */
  vazia: boolean;
}

/**
 * Rumo de um ponto para o outro, em graus a partir do norte.
 *
 * Fórmula de rumo inicial da esfera, e não `atan2` sobre a diferença crua: numa
 * latitude de 23 graus, um grau de longitude é bem mais curto que um de
 * latitude, e ignorar isso entorta a seta em todo trecho que corre para leste.
 */
export function rumo(de: [number, number], para: [number, number]): number {
  const rad = Math.PI / 180;
  const lat1 = de[1] * rad;
  const lat2 = para[1] * rad;
  const deltaLng = (para[0] - de[0]) * rad;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** Monta a linha do tempo a partir das leituras cruas. */
export function montarLinhaDoTempo(points: TrackPoint[]): LinhaDoTempo {
  const { segmentos, descartados } = prepararTrajeto(points);
  if (segmentos.length === 0) return { passos: [], duracao: 0, vazia: true };

  /*
   * ⚠️ Os pontos são reconciliados com os segmentos por COORDENADA, e não por
   * índice: `prepararTrajeto` descarta leitura impossível, então os índices das
   * duas listas não coincidem quando houve descarte. Comparar por índice
   * deslocaria o relógio do replay em relação ao desenho.
   */
  const porCoordenada = new Map<string, TrackPoint>();
  for (const ponto of points) {
    const chave = `${ponto.coordinates[0]},${ponto.coordinates[1]}`;
    if (!porCoordenada.has(chave)) porCoordenada.set(chave, ponto);
  }
  const leitura = (coordenada: [number, number]): TrackPoint =>
    porCoordenada.get(`${coordenada[0]},${coordenada[1]}`) ?? {
      coordinates: coordenada,
      at: points[0]?.at ?? new Date().toISOString(),
    };

  const passos: Passo[] = [];
  let relogio = 0;
  let ultimoHeading = 0;

  const acrescentar = (de: TrackPoint, para: TrackPoint, custo: number, emLacuna: boolean) => {
    const mesmoLugar =
      de.coordinates[0] === para.coordinates[0] && de.coordinates[1] === para.coordinates[1];
    /* Parado não tem rumo: manter o anterior evita o caminhão girar para o
       norte a cada semáforo. */
    const heading = mesmoLugar ? ultimoHeading : rumo(de.coordinates, para.coordinates);
    ultimoHeading = heading;

    passos.push({ de, para, inicio: relogio, duracao: custo, emLacuna, heading });
    relogio += custo;
  };

  segmentos.forEach((segmento, indiceDoSegmento) => {
    if (indiceDoSegmento > 0) {
      /* A travessia do vão, entre o fim do trecho anterior e o começo deste. */
      const anterior = segmentos[indiceDoSegmento - 1];
      const fimAnterior = anterior?.[anterior.length - 1];
      const comeco = segmento[0];
      if (fimAnterior && comeco) {
        acrescentar(leitura(fimAnterior), leitura(comeco), CUSTO_DA_LACUNA_S, true);
      }
    }

    for (let i = 0; i < segmento.length - 1; i++) {
      const de = leitura(segmento[i] as [number, number]);
      const para = leitura(segmento[i + 1] as [number, number]);
      const real = (Date.parse(para.at) - Date.parse(de.at)) / 1000;
      /* O mínimo de 1 segundo cobre a leitura com carimbo repetido, que existe:
         duração zero faria o passo ser pulado e a divisão devolver infinito. */
      const custo = Math.min(Math.max(real, 1), TETO_POR_PASSO_S);
      acrescentar(de, para, custo, false);
    }
  });

  if (relogio === 0 || passos.length === 0) return { passos: [], duracao: 0, vazia: true };

  /* Reescala: o trajeto inteiro passa a durar `DURACAO_ALVO_S` a 1x. */
  const fator = DURACAO_ALVO_S / relogio;
  for (const passo of passos) {
    passo.inicio *= fator;
    passo.duracao *= fator;
  }

  void descartados;
  return { passos, duracao: DURACAO_ALVO_S, vazia: false };
}

/**
 * Onde o caminhão está num instante do replay.
 *
 * ⚠️ Busca BINÁRIA, e não varredura. Um trajeto de 72 horas passa de dez mil
 * passos, e procurar linearmente a cada quadro custaria mais que desenhar. A
 * busca também é o que permite arrastar o slider para qualquer ponto sem custo.
 */
export function quadroEm(linha: LinhaDoTempo, tempo: number): QuadroDoReplay | null {
  if (linha.vazia) return null;

  const alvo = Math.max(0, Math.min(tempo, linha.duracao));

  let baixo = 0;
  let alto = linha.passos.length - 1;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if ((linha.passos[meio] as Passo).inicio <= alvo) baixo = meio;
    else alto = meio - 1;
  }

  const passo = linha.passos[baixo];
  if (!passo) return null;

  const fracao = passo.duracao > 0 ? Math.min(1, (alvo - passo.inicio) / passo.duracao) : 1;
  const [lng1, lat1] = passo.de.coordinates;
  const [lng2, lat2] = passo.para.coordinates;

  /*
   * O relógio e a velocidade vêm da leitura de ORIGEM até passar da metade, e
   * da de destino depois disso. Interpolar o horário daria um instante que não
   * existiu, e numa lacuna de onze horas o relógio correria sozinho na tela
   * como se o caminhão estivesse sendo observado o tempo todo.
   */
  const referencia = fracao < 0.5 ? passo.de : passo.para;

  return {
    lng: lng1 + (lng2 - lng1) * fracao,
    lat: lat1 + (lat2 - lat1) * fracao,
    heading: passo.heading,
    at: referencia.at,
    speedKmh: referencia.speedKmh,
    emLacuna: passo.emLacuna,
  };
}
