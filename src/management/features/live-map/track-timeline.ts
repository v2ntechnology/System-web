import type { TrackPoint } from '@/management/lib/fleet-api';

import { distanciaKm, prepararTrajeto } from './track-segments';

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
 * <h2>O eixo do replay é a DISTÂNCIA, e não o tempo</h2>
 *
 * ⚠️ Mudado em 19/09/2026, a pedido do usuário: "o 1x é 1x em todo o trecho,
 * mesmo que o motorista esteja a 90 por hora ou a 2 km por hora; ele respeita a
 * velocidade do sistema, e não a velocidade que o caminhãozinho estava".
 *
 * Até aqui cada passo consumia tela proporcional ao TEMPO REAL entre as duas
 * leituras, e a consequência era exatamente a reclamação: como a MiX entrega uma
 * leitura a cada 30 segundos faça chuva ou faça sol, um passo a 90 km/h e um a 2
 * km/h custavam o MESMO tempo de tela, mas cobriam distâncias diferentes. Medido
 * no RIQ7B85, 6 horas, 1.254 passos: o caminhão andava 12,77 m por unidade de
 * tela nos trechos acima de 50 km/h e 1,66 m nos trechos abaixo de 20, quase
 * oito vezes menos. Na tela isso é um caminhão que acelera e freia sozinho
 * durante a reprodução, que é o oposto de uma velocidade de reprodução.
 *
 * Agora o custo de um passo é a DISTÂNCIA que ele percorre. A velocidade na tela
 * passa a ser constante, e o que 1x, 2x e 4x multiplicam é ela, não o relógio do
 * dia. Dois ajustes continuam necessários:
 *
 *   1. Parada não desaparece, mas também não se paga por leitura. Paradas
 *      seguidas viram UM passo, que custa {@link PAUSA_M}: o caminhão dá uma
 *      respirada perceptível e segue, em vez de ficar plantado 23% do replay,
 *      que é o que as 295 leituras paradas daquele mesmo trajeto faziam.
 *   2. Lacuna custa a distância dela, com teto em {@link TETO_DA_LACUNA_M}. Sem
 *      o teto, um vão de 20 km num trajeto de 20,2 km comeria o replay inteiro
 *      desenhando uma reta.
 *
 * No fim, tudo é reescalado para o trajeto durar {@link DURACAO_BASE_S} quando
 * ele tem o tamanho de {@link METROS_DE_REFERENCIA}, e mais que isso quando é
 * maior, pela raiz quadrada e até {@link DURACAO_MAXIMA_S}.
 *
 * ⚠️ A uniformidade perfeita existe DENTRO de um trajeto. Entre trajetos de
 * tamanhos diferentes sobra distorção, e ela é consciente: a alternativa medida
 * era o replay de 72 horas durar 78 minutos a 1x.
 */

/**
 * Quanto dura, a 1x, um trajeto do tamanho de {@link METROS_DE_REFERENCIA}.
 *
 * ⚠️ Eram 40 até 09/09/2026, e o usuário relatou o que isso significava na tela:
 * "na velocidade 1x está absurdamente rápido, o 1x de hoje é na verdade o 4x".
 * Ele tinha razão, e a conta explica: o trajeto inteiro cabia em 40 segundos, de
 * modo que um dia de rodagem passava em menos tempo do que se leva para ler a
 * placa. O número quadruplicou para que o 1x seja de fato uma velocidade de
 * leitura, e a escala inteira desceu junto: o 4x de agora é exatamente o 1x de
 * antes, que continua alcançável para quem só quer ver o trajeto correr.
 *
 * ⚠️ Até 19/09/2026 este número era a duração de QUALQUER trajeto, e era daí que
 * vinha a segunda reclamação do usuário: "em 6 horas a velocidade está boa, mas
 * em 24 e em 72 horas o 1x, o 2x e o 4x estão muito rápidos". Medido no RIQ7B85:
 * 16,3 km em 6 horas, 153,6 km em 24 e 478,1 km em 72, os três espremidos nos
 * mesmos 160 segundos. O 1x de 72 horas corria **29,3 vezes** mais que o de 6.
 */
const DURACAO_BASE_S = 160;

/**
 * O tamanho de trajeto que vale {@link DURACAO_BASE_S}.
 *
 * Os 16,3 km que o RIQ7B85 rodou em 6 horas, que é a janela que o usuário disse
 * estar boa. É o ponto em que a escala não mexe em nada, de propósito: o que ele
 * já aprovou continua igual, e só os trajetos maiores que isso se alongam.
 */
const METROS_DE_REFERENCIA = 16_300;

/**
 * Quanto a duração acompanha o tamanho do trajeto.
 *
 * ⚠️ Abaixo de 1 de propósito: em 1 a duração seria proporcional à estrada, e os
 * 478 km das 72 horas levariam **78 minutos** a 1x. Começou em 0,5 e subiu para
 * 0,6 em 19/09/2026, quando o usuário pediu para diminuir mais a velocidade das
 * janelas longas: a 0,5 as 24 horas corriam a 3,2 vezes a velocidade das 6
 * horas, e a 0,6 correm a 2,5.
 */
const EXPOENTE_DA_ESCALA = 0.6;

/**
 * Teto da duração, em segundos.
 *
 * Quinze minutos. ⚠️ Ele existe porque a escala sozinha não para de crescer, e
 * quem escolhe o teto escolhe também quanto de distorção sobra entre as janelas:
 * a 8 minutos, as 72 horas corriam a 9,8 vezes a velocidade das 6 horas; a 15,
 * caem para 5,2. Quem não quer esperar tem o 4x, que traz esse mesmo trajeto
 * para menos de quatro minutos.
 */
const DURACAO_MAXIMA_S = 900;

/**
 * Abaixo disto o veículo não saiu do lugar, e o passo é parada.
 *
 * Os mesmos 50 metros que {@link prepararTrajeto} usa para separar parada de
 * buraco de cobertura: é a ordem de grandeza do tremor de GPS de um veículo
 * parado. Usar o mesmo número nos dois lugares é o que impede o replay de
 * chamar de movimento o que a linha desenhada trata como parada.
 */
const PARADO_M = 50;

/**
 * O que uma parada custa, em metros equivalentes.
 *
 * ⚠️ É por PARADA, e não por leitura parada. Uma hora no pátio e um minuto no
 * semáforo custam o mesmo, porque o que o replay precisa mostrar é que ali houve
 * uma pausa, e quanto ela durou já está no relógio da tela. Doze metros é cerca
 * de dois passos de caminhão em movimento lento: perceptível, e longe de dominar.
 */
const PAUSA_M = 12;

/**
 * Teto do que uma lacuna pode custar, em metros.
 *
 * Três quilômetros. A travessia continua sendo a mais longa do replay, que é o
 * sinal de que ali falta dado, mas um vão de 20 km deixa de consumir o trajeto
 * inteiro. ⚠️ Acima do teto a reta é percorrida mais rápido que o resto, e é
 * uma troca consciente: o alternativo é assistir a uma linha reta por meio
 * minuto.
 */
const TETO_DA_LACUNA_M = 3000;

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
  /** Passo em que o veículo não saiu do lugar. Paradas seguidas viram um só. */
  parado: boolean;
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

  const acrescentar = (
    de: TrackPoint,
    para: TrackPoint,
    custo: number,
    emLacuna: boolean,
    parado = false,
  ) => {
    const mesmoLugar =
      de.coordinates[0] === para.coordinates[0] && de.coordinates[1] === para.coordinates[1];
    /* Parado não tem rumo: manter o anterior evita o caminhão girar para o
       norte a cada semáforo. */
    const heading = mesmoLugar ? ultimoHeading : rumo(de.coordinates, para.coordinates);
    ultimoHeading = heading;

    passos.push({ de, para, inicio: relogio, duracao: custo, emLacuna, heading, parado });
    relogio += custo;
  };

  /**
   * O veículo estava parado neste passo?
   *
   * ⚠️ Quem decide é a VELOCIDADE reportada, e o deslocamento é só a reserva
   * para quem não a informa. Decidir por distância sozinha confunde duas coisas
   * diferentes: a 5 km/h um caminhão anda 42 metros entre duas leituras da MiX,
   * abaixo dos {@link PARADO_M} que existem para reconhecer tremor de GPS. Pela
   * distância, esse caminhão andando devagar seria "parada", receberia custo de
   * pausa e atravessaria os 42 metros voando, que é justamente o defeito que
   * esta mudança veio corrigir.
   */
  const estaParado = (de: TrackPoint, metros: number): boolean =>
    de.speedKmh != null ? de.speedKmh === 0 : metros < PARADO_M;

  /**
   * Estende a parada que já está aberta, em vez de abrir outra.
   *
   * ⚠️ É isto que impede a parada de se pagar por leitura. Parado no pátio, a
   * MiX manda uma leitura a cada 30 segundos, e cada uma delas viraria uma pausa
   * de {@link PAUSA_M}: uma hora ali custaria 120 pausas. Aqui a sequência
   * inteira continua sendo UM passo, que acumula o tremor de GPS e cobra a pausa
   * uma vez só.
   */
  const estenderParada = (para: TrackPoint, metros: number): boolean => {
    const ultimo = passos[passos.length - 1];
    if (!ultimo || ultimo.emLacuna || !ultimo.parado) return false;
    ultimo.para = para;
    ultimo.duracao += metros;
    relogio += metros;
    return true;
  };

  segmentos.forEach((segmento, indiceDoSegmento) => {
    if (indiceDoSegmento > 0) {
      /* A travessia do vão, entre o fim do trecho anterior e o começo deste. */
      const anterior = segmentos[indiceDoSegmento - 1];
      const fimAnterior = anterior?.[anterior.length - 1];
      const comeco = segmento[0];
      if (fimAnterior && comeco) {
        const vao = distanciaKm(fimAnterior, comeco) * 1000;
        acrescentar(leitura(fimAnterior), leitura(comeco), Math.min(vao, TETO_DA_LACUNA_M), true);
      }
    }

    for (let i = 0; i < segmento.length - 1; i++) {
      const de = leitura(segmento[i] as [number, number]);
      const para = leitura(segmento[i + 1] as [number, number]);
      const metros = distanciaKm(de.coordinates, para.coordinates) * 1000;

      if (estaParado(de, metros)) {
        /*
         * Parada: uma pausa só, por mais leituras que a telemetria mande de
         * dentro dela. O deslocamento entra no custo como em qualquer passo,
         * então o tremor de GPS é percorrido na mesma velocidade do resto; o que
         * a pausa acrescenta é o tempo de tela em que o caminhão fica parado.
         */
        if (!estenderParada(para, metros)) acrescentar(de, para, PAUSA_M + metros, false, true);
        continue;
      }

      acrescentar(de, para, metros, false);
    }
  });

  if (relogio === 0 || passos.length === 0) return { passos: [], duracao: 0, vazia: true };

  /*
   * Reescala: quanto maior o trajeto, mais tempo de tela ele ganha.
   *
   * ⚠️ O expoente é o que torna isso utilizável, e não a proporção direta.
   * Proporcional, os 478 km das 72 horas levariam 78 minutos a 1x, e ninguém
   * assiste a isso; com {@link EXPOENTE_DA_ESCALA}, um trajeto 29 vezes maior
   * ganha 7,6 vezes mais tela em vez de 29. A distorção que sobra entre as
   * janelas cai de 29,3x para 5,2x, e é o preço de caber numa sessão de trabalho.
   *
   * ⚠️ Quem manda é o TRAJETO, e não a janela escolhida. Um caminhão que passou
   * as 72 horas no pátio andou poucos metros, e o replay dele continua curto: a
   * janela diz quanto tempo olhar para trás, não quanta estrada houve.
   */
  const alvo = Math.min(
    DURACAO_MAXIMA_S,
    Math.max(
      DURACAO_BASE_S,
      DURACAO_BASE_S * (relogio / METROS_DE_REFERENCIA) ** EXPOENTE_DA_ESCALA,
    ),
  );
  const fator = alvo / relogio;
  for (const passo of passos) {
    passo.inicio *= fator;
    passo.duracao *= fator;
  }

  void descartados;
  return { passos, duracao: alvo, vazia: false };
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
