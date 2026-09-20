import { describe, expect, it } from 'vitest';

import {
  criarDetectorDeFala,
  nivelDaFaixaDeFala,
  MAXIMO_DE_GRAVACAO_MS,
  SILENCIO_PARA_ENCERRAR_MS,
} from './speech-detection';

/**
 * A detecção de fala num lugar barulhento.
 *
 * Estes testes existem porque o defeito que eles cobrem NÃO aparece no teste
 * manual: quem testa está sentado numa sala silenciosa, e ali o limiar fixo
 * antigo funcionava. O relato veio de quem usa em pátio e em oficina.
 *
 * ⚠️ Reescritos em 19/09/2026, quando a transcrição passou para o servidor. Os
 * cenários continuam os mesmos, porque são os da vida real; o que sumiu foi a
 * segunda fonte de decisão. Antes o detector recebia de fora "o reconhecedor já
 * entendeu alguma coisa", e era isso que encerrava a fala em sala barulhenta.
 * Agora só existe o volume, e quem fecha o caso barulhento é o teto de gravação.
 */

/** Roda o detector por um trecho de tempo, a 60 amostras por segundo. */
function rodar(
  detector: ReturnType<typeof criarDetectorDeFala>,
  opcoes: { de: number; ate: number; nivel: (agora: number) => number },
) {
  const passo = 16;
  let ultima = null as ReturnType<typeof detector.amostrar> | null;

  for (let agora = opcoes.de; agora <= opcoes.ate; agora += passo) {
    ultima = detector.amostrar({ nivel: opcoes.nivel(agora), agora });
    if (ultima.decisao !== 'continuar') return { ...ultima, em: agora };
  }
  return { ...ultima!, em: opcoes.ate };
}

describe('detecção de fala', () => {
  it('encerra a fala depois do silêncio, em sala silenciosa', () => {
    const detector = criarDetectorDeFala(0);

    /* ⚠️ O silêncio inicial não é enfeite: os primeiros 350ms CALIBRAM a sala, e
       o que separa fala de ruído é o quanto o nível sobe acima do que foi medido
       ali. Começar o teste já com a pessoa falando ensina ao detector que aquele
       volume é o ambiente, e aí nada mais passa por fala. */
    rodar(detector, { de: 0, ate: 400, nivel: () => 0.01 });
    rodar(detector, { de: 416, ate: 2000, nivel: () => 0.4 });
    const fim = rodar(detector, { de: 2016, ate: 8000, nivel: () => 0.01 });

    expect(fim.decisao).toBe('encerrar');
    expect(fim.em - 2000).toBeGreaterThanOrEqual(SILENCIO_PARA_ENCERRAR_MS);
    expect(fim.em - 2000).toBeLessThan(SILENCIO_PARA_ENCERRAR_MS + 500);
  });

  it('⚠️ encerra mesmo com barulho constante alto, que é o defeito relatado', () => {
    const detector = criarDetectorDeFala(0);

    /* Pátio: ruído de fundo em 0,30, MUITO acima do limiar fixo antigo (0,055).
       A pessoa fala por cima dele e depois se cala; o ruído continua. */
    rodar(detector, { de: 0, ate: 400, nivel: () => 0.3 });
    rodar(detector, { de: 416, ate: 1500, nivel: () => 0.85 });
    const fim = rodar(detector, { de: 1516, ate: 20000, nivel: () => 0.3 });

    /* O piso adaptativo é o que resolve: ele aprendeu que 0,30 é a sala, então
       o ruído que sobrou não segura a conversa e o silêncio corre normalmente. */
    expect(fim.decisao).toBe('encerrar');
    expect(fim.em - 1500).toBeLessThanOrEqual(SILENCIO_PARA_ENCERRAR_MS + 500);
  });

  it('não confunde estalo com fala', () => {
    const detector = criarDetectorDeFala(0);

    /* Sala quieta com uma batida de 60ms, curta demais para ser fala: ela não
       pode fazer o detector achar que houve pergunta. */
    const fim = rodar(detector, {
      de: 0,
      ate: 20000,
      nivel: (agora) => (agora >= 3000 && agora < 3060 ? 0.9 : 0.02),
    });

    expect(fim.decisao).toBe('desistir');
  });

  it('não corta a pessoa na pausa entre duas frases', () => {
    const detector = criarDetectorDeFala(0);

    rodar(detector, { de: 0, ate: 1200, nivel: () => 0.5 });

    /* Pausa de 1,2 segundo, menor que o limite: a gravação continua. */
    const durante = rodar(detector, { de: 1216, ate: 2400, nivel: () => 0.02 });
    expect(durante.decisao).toBe('continuar');
  });

  it('desiste quando ninguém falou desde a abertura', () => {
    const detector = criarDetectorDeFala(0);

    const fim = rodar(detector, { de: 0, ate: 20000, nivel: () => 0.02 });

    /* ⚠️ `desistir` e não `encerrar`: sem fala, não há o que transcrever, e
       mandar quinze segundos de silêncio ao provedor seria pago para voltar
       vazio. */
    expect(fim.decisao).toBe('desistir');
  });

  it('acompanha a sala que fica barulhenta no meio da conversa', () => {
    const detector = criarDetectorDeFala(0);

    // Começa quieto, e a partir de 3s um caminhão liga ao lado.
    rodar(detector, { de: 0, ate: 3000, nivel: () => 0.02 });
    const leitura = rodar(detector, { de: 3016, ate: 12000, nivel: () => 0.25 });

    /* O piso sobe com o ambiente, então o ruído novo deixa de passar por fala e
       o silêncio volta a correr. */
    expect(leitura.decisao).toBe('encerrar');
  });

  it('fecha a gravação no teto, por mais que a pessoa fale', () => {
    const detector = criarDetectorDeFala(0);

    /* ⚠️ O teto protege três coisas de uma vez: a sala que nunca cala, o limite
       de um minuto da rota de transcrição, e a conta, porque transcrição se paga
       por duração. */
    /* Vozes em volta, indo e vindo: os vales deixam o piso descer e os picos
       passam do limiar de novo, então o relógio do silêncio reinicia para
       sempre. É o único caso que nada mais fecharia. */
    const fim = rodar(detector, {
      de: 0,
      ate: MAXIMO_DE_GRAVACAO_MS + 5000,
      nivel: (agora) => (Math.floor(agora / 300) % 2 === 0 ? 0.9 : 0.05),
    });

    expect(fim.decisao).toBe('encerrar');
    expect(fim.em).toBeLessThanOrEqual(MAXIMO_DE_GRAVACAO_MS + 200);
  });
});

describe('faixa da fala', () => {
  it('ignora o ronco grave e o chiado agudo', () => {
    const espectro = new Uint8Array(64);
    espectro[0] = 255; // ronco: motor, ar condicionado, vento
    for (let i = 40; i < 64; i += 1) espectro[i] = 255; // chiado

    expect(nivelDaFaixaDeFala(espectro, 48000)).toBe(0);
  });

  it('enxerga energia na faixa dos formantes', () => {
    const espectro = new Uint8Array(64);
    for (let i = 1; i <= 9; i += 1) espectro[i] = 200;

    expect(nivelDaFaixaDeFala(espectro, 48000)).toBeGreaterThan(0.5);
  });
});
