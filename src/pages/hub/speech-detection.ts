/**
 * Decidir se ainda há alguém falando, num lugar barulhento.
 *
 * <h2>O defeito que isto conserta</h2>
 *
 * O limiar era um número fixo (0,055 do volume normalizado). Numa sala
 * silenciosa funciona; num pátio, numa oficina ou com ar condicionado forte, o
 * ruído de fundo já passa desse valor e o relógio do silêncio **nunca anda**. O
 * sintoma que o usuário relatou é exatamente esse: ele termina de falar, a
 * assistente continua "ouvindo" o barulho da sala e a pergunta nunca chega a ser
 * processada.
 *
 * <h2>As três defesas, e por que são três</h2>
 *
 * 1. **Piso de ruído adaptativo.** O que separa fala de ruído não é o volume
 *    absoluto, é o quanto ele sobe ACIMA do ambiente. O piso é medido enquanto o
 *    microfone está aberto e acompanha a sala: desce rápido quando fica quieto e
 *    sobe devagar, para a própria fala não empurrar o piso para cima e se anular.
 * 2. **Persistência.** Um estalo, uma porta ou uma buzina passam de qualquer
 *    limiar por um instante. Só conta como fala o que fica acima do limiar por
 *    {@link MINIMO_DE_FALA_MS} seguidos.
 * 3. **Teto de gravação.** É a rede de segurança, e a que garante que a conversa
 *    nunca trava: por mais que a sala continue barulhenta, a gravação fecha em
 *    {@link MAXIMO_DE_GRAVACAO_MS} e o que foi capturado segue para transcrição.
 *
 * <h2>⚠️ Só o VOLUME decide, desde 19/09/2026</h2>
 *
 * <p>Até aqui a decisão somava duas fontes: o volume e o texto que a Web Speech
 * ia entregando enquanto a pessoa falava. A segunda sumiu quando a transcrição
 * passou para o servidor, e ela tinha de sumir: era justamente a Web Speech que
 * não funcionava no celular, porque disputava o microfone com o `getUserMedia`
 * que alimenta este detector.
 *
 * <p>O que se perdeu com isso é a rede de segurança de sala barulhenta. Antes,
 * quando o ruído mantinha o volume acima do limiar, quem encerrava era o
 * reconhecedor ficando calado, porque ele sabia distinguir voz de barulho. Agora
 * não há esse juiz, e é por isso que o teto de gravação passou a existir: sem
 * ele, num pátio barulhento o microfone ficaria aberto para sempre.
 */

/** Quanto tempo de silêncio encerra a fala, quando o ambiente é normal. */
export const SILENCIO_PARA_ENCERRAR_MS = 2400;

/**
 * O máximo que uma gravação pode durar, tendo alguém falado ou não.
 *
 * ⚠️ Trinta segundos, e o número tem três donos. O primeiro é a sala barulhenta,
 * em que o volume nunca desce e nada mais encerraria. O segundo é o provedor: a
 * rota de transcrição do Google recusa áudio acima de um minuto, e estourar lá
 * devolveria erro no lugar da pergunta. O terceiro é a conta, porque transcrição
 * se paga por duração.
 *
 * Trinta segundos é muito mais do que uma pergunta falada leva: as perguntas
 * reais desta tela vivem abaixo de dez.
 */
export const MAXIMO_DE_GRAVACAO_MS = 30000;

/** Sem nenhuma fala por este tempo, a escuta se encerra em vez de ficar aberta. */
export const ESPERA_SEM_FALA_MS = 15000;

/** Tempo acima do limiar para uma amostra virar "fala", e não estalo. */
const MINIMO_DE_FALA_MS = 140;

/** Os primeiros instantes servem para medir a sala, e não para ouvir. */
const CALIBRAGEM_MS = 350;

/**
 * Quanto a fala precisa subir acima do ruído.
 *
 * Voz costuma ficar de 6 a 15 dB acima do ambiente, e 2,2 vezes em amplitude é
 * aproximadamente 7 dB: alto o bastante para descartar o zumbido da sala, baixo
 * o bastante para não perder quem fala manso.
 */
const FATOR_ACIMA_DO_RUIDO = 2.2;

/**
 * Piso absoluto do limiar.
 *
 * Numa sala muito silenciosa o ruído medido tende a zero, e só o fator deixaria
 * o limiar quase no chão: aí qualquer respiração viraria fala.
 */
const LIMIAR_MINIMO = 0.045;

export interface EntradaDaAmostra {
  /** Nível na faixa da fala, de 0 a 1. */
  nivel: number;
  agora: number;
}

export type DecisaoDaEscuta =
  /** Continua ouvindo. */
  | 'continuar'
  /** Há pergunta e a fala acabou: processar. */
  | 'encerrar'
  /** Nada foi dito desde a abertura: fechar sem processar. */
  | 'desistir';

export interface Leitura {
  decisao: DecisaoDaEscuta;
  /** Verdadeiro enquanto a pessoa está falando, para a tela reagir. */
  falando: boolean;
  /** O ambiente medido agora. Exposto para diagnóstico. */
  pisoDeRuido: number;
  limiar: number;
}

/**
 * Um detector por abertura de microfone.
 *
 * Guarda estado (o piso e os relógios), então não serve para duas escutas ao
 * mesmo tempo: cada `startListening` cria o seu.
 */
export function criarDetectorDeFala(abertaEm: number) {
  let pisoDeRuido = 0;
  let calibrando = true;
  let acimaDesde: number | null = null;
  let ultimaFalaEm = abertaEm;
  /**
   * Alguém chegou a falar nesta abertura?
   *
   * ⚠️ Substitui o `temPergunta` que vinha de fora, da transcrição ao vivo. A
   * diferença que importa: aquele dizia "o reconhecedor ENTENDEU alguma coisa", e
   * este diz "houve som com cara de voz". O segundo é mais frouxo, e é o que
   * sobra quando a transcrição acontece depois, no servidor.
   */
  let houveFala = false;

  function amostrar({ nivel, agora }: EntradaDaAmostra): Leitura {
    /*
     * Calibragem: os primeiros instantes definem o ambiente.
     *
     * ⚠️ Nem tudo aqui é silêncio. Quem clica em "iniciar conversa" e já começa
     * a falar entrega voz na calibragem, e por isso ela guarda o MENOR valor
     * visto, e não a média: o menor de uma janela curta é o vale entre sílabas,
     * que é bem mais perto do ambiente do que a média seria.
     */
    if (calibrando) {
      pisoDeRuido = pisoDeRuido === 0 ? nivel : Math.min(pisoDeRuido, nivel);
      if (agora - abertaEm >= CALIBRAGEM_MS) calibrando = false;
    } else if (nivel < pisoDeRuido) {
      // Desce rápido: a sala ficou mais quieta e o limiar precisa acompanhar.
      pisoDeRuido = pisoDeRuido * 0.85 + nivel * 0.15;
    } else {
      // Sobe devagar: senão a própria fala levanta o piso e se anula sozinha.
      pisoDeRuido = pisoDeRuido * 0.998 + nivel * 0.002;
    }

    const limiar = Math.max(LIMIAR_MINIMO, pisoDeRuido * FATOR_ACIMA_DO_RUIDO);

    if (nivel > limiar) {
      acimaDesde ??= agora;
      if (agora - acimaDesde >= MINIMO_DE_FALA_MS) {
        ultimaFalaEm = agora;
        houveFala = true;
      }
    } else {
      acimaDesde = null;
    }

    const falando = acimaDesde !== null && agora - acimaDesde >= MINIMO_DE_FALA_MS;
    const calado = agora - ultimaFalaEm;

    /*
     * ⚠️ O teto vem PRIMEIRO, e vale mesmo enquanto o volume diz que há alguém
     * falando. É a única condição que fecha uma sala barulhenta, em que o ruído
     * mantém o nível acima do limiar e o relógio do silêncio nunca anda.
     */
    if (agora - abertaEm > MAXIMO_DE_GRAVACAO_MS) {
      return { decisao: houveFala ? 'encerrar' : 'desistir', falando, pisoDeRuido, limiar };
    }

    if (houveFala && calado > SILENCIO_PARA_ENCERRAR_MS) {
      return { decisao: 'encerrar', falando, pisoDeRuido, limiar };
    }

    /*
     * Ninguém falou desde a abertura: fecha sem gastar transcrição.
     *
     * ⚠️ Isto é o que impede a tela de ficar em "Estou ouvindo" para sempre
     * quando a pessoa abriu o microfone e saiu, e agora também evita mandar ao
     * provedor quinze segundos de silêncio, que seriam pagos para voltar vazios.
     */
    if (!houveFala && agora - abertaEm > ESPERA_SEM_FALA_MS) {
      return { decisao: 'desistir', falando, pisoDeRuido, limiar };
    }

    return { decisao: 'continuar', falando, pisoDeRuido, limiar };
  }

  /** A transcrição chegando também é sinal de fala, e o mais confiável deles. */
  function marcarFala(agora: number): void {
    ultimaFalaEm = agora;
  }

  return { amostrar, marcarFala };
}

/**
 * O nível na faixa em que a voz vive, a partir do espectro do microfone.
 *
 * ⚠️ Medir o espectro INTEIRO é o que fazia motor, ar condicionado e vento
 * valerem tanto quanto voz. Quase toda a energia desses ruídos está abaixo de
 * 300 Hz ou espalhada no agudo; o que carrega a inteligibilidade da fala são os
 * formantes, entre 300 e 3400 Hz, que é a faixa que o telefone transmite desde
 * sempre por esse motivo.
 *
 * A resolução aqui é grossa (a FFT da tela tem 64 faixas, cerca de 375 Hz cada,
 * e ela é assim porque quem a desenha é a animação da esfera). Mesmo grossa,
 * cortar a primeira faixa já tira o ronco, e cortar o agudo tira o chiado.
 */
export function nivelDaFaixaDeFala(espectro: Uint8Array, sampleRate: number): number {
  const hzPorFaixa = sampleRate / 2 / espectro.length;
  const primeira = Math.max(1, Math.floor(300 / hzPorFaixa));
  const ultima = Math.min(espectro.length - 1, Math.ceil(3400 / hzPorFaixa));

  let soma = 0;
  let quantas = 0;
  for (let i = primeira; i <= ultima; i += 1) {
    soma += (espectro[i] ?? 0) / 255;
    quantas += 1;
  }
  return quantas === 0 ? 0 : Math.min((soma / quantas) * 2.4, 1);
}
