import { describe, expect, it } from 'vitest';

import {
  criarDetectorDeFala,
  nivelDaFaixaDeFala,
  SILENCIO_PARA_ENCERRAR_MS,
  TETO_SEM_TRANSCRICAO_MS,
} from './speech-detection';

/**
 * A detecção de fala num lugar barulhento.
 *
 * Estes testes existem porque o defeito que eles cobrem NÃO aparece no teste
 * manual: quem testa está sentado numa sala silenciosa, e ali o limiar fixo
 * antigo funcionava. O relato veio de quem usa em pátio e em oficina.
 */

/** Roda o detector por um trecho de tempo, a 60 amostras por segundo. */
function rodar(
  detector: ReturnType<typeof criarDetectorDeFala>,
  opcoes: {
    de: number;
    ate: number;
    nivel: (agora: number) => number;
    temPergunta?: boolean;
    ultimaTranscricaoEm?: number;
  },
) {
  const passo = 16;
  let ultima = null as ReturnType<typeof detector.amostrar> | null;

  for (let agora = opcoes.de; agora <= opcoes.ate; agora += passo) {
    ultima = detector.amostrar({
      nivel: opcoes.nivel(agora),
      agora,
      temPergunta: opcoes.temPergunta ?? false,
      ultimaTranscricaoEm: opcoes.ultimaTranscricaoEm ?? opcoes.de,
    });
    if (ultima.decisao !== 'continuar') return { ...ultima, em: agora };
  }
  return { ...ultima!, em: opcoes.ate };
}

describe('detecção de fala', () => {
  it('encerra a fala depois do silêncio, em sala silenciosa', () => {
    const detector = criarDetectorDeFala(0);

    // Fala até 2000ms, com a transcrição chegando junto.
    rodar(detector, { de: 0, ate: 2000, nivel: () => 0.4 });
    detector.marcarFala(2000);

    const fim = rodar(detector, {
      de: 2016,
      ate: 8000,
      nivel: () => 0.01,
      temPergunta: true,
      ultimaTranscricaoEm: 2000,
    });

    expect(fim.decisao).toBe('encerrar');
    expect(fim.em - 2000).toBeGreaterThanOrEqual(SILENCIO_PARA_ENCERRAR_MS);
    expect(fim.em - 2000).toBeLessThan(SILENCIO_PARA_ENCERRAR_MS + 500);
  });

  it('⚠️ encerra mesmo com barulho constante alto, que é o defeito relatado', () => {
    const detector = criarDetectorDeFala(0);

    /* Pátio: ruído de fundo em 0,30, MUITO acima do limiar fixo antigo (0,055).
       Com ele, o relógio do silêncio nunca andava e a pergunta não era
       processada. */
    const ruido = () => 0.3 + Math.sin(Date.now()) * 0;

    rodar(detector, { de: 0, ate: 1500, nivel: ruido });
    detector.marcarFala(1500);

    const fim = rodar(detector, {
      de: 1516,
      ate: 20000,
      nivel: ruido,
      temPergunta: true,
      ultimaTranscricaoEm: 1500,
    });

    expect(fim.decisao).toBe('encerrar');
    expect(fim.em - 1500).toBeLessThanOrEqual(TETO_SEM_TRANSCRICAO_MS + 200);
  });

  it('não confunde estalo com fala', () => {
    const detector = criarDetectorDeFala(0);

    // Sala quieta com uma batida de 60ms, curta demais para ser fala.
    const fim = rodar(detector, {
      de: 0,
      ate: 6000,
      nivel: (agora) => (agora >= 3000 && agora < 3060 ? 0.9 : 0.02),
      temPergunta: true,
      ultimaTranscricaoEm: 0,
    });

    /* O estalo não pode ter adiado o encerramento: a decisão sai pelo silêncio,
       e não pelo teto da transcrição. */
    expect(fim.decisao).toBe('encerrar');
    expect(fim.em).toBeLessThan(3000);
  });

  it('não corta a pessoa na pausa entre duas frases', () => {
    const detector = criarDetectorDeFala(0);

    rodar(detector, { de: 0, ate: 1200, nivel: () => 0.5 });
    detector.marcarFala(1200);

    /* Pausa de 1,2 segundo, menor que o limite, e a fala volta. A transcrição
       da segunda frase chega em 2600. */
    const durante = rodar(detector, {
      de: 1216,
      ate: 2400,
      nivel: () => 0.02,
      temPergunta: true,
      ultimaTranscricaoEm: 1200,
    });
    expect(durante.decisao).toBe('continuar');
  });

  it('desiste quando ninguém falou desde a abertura', () => {
    const detector = criarDetectorDeFala(0);

    const fim = rodar(detector, {
      de: 0,
      ate: 20000,
      nivel: () => 0.02,
      temPergunta: false,
    });

    expect(fim.decisao).toBe('desistir');
  });

  it('acompanha a sala que fica barulhenta no meio da conversa', () => {
    const detector = criarDetectorDeFala(0);

    // Começa quieto, e a partir de 3s um caminhão liga ao lado.
    rodar(detector, { de: 0, ate: 3000, nivel: () => 0.02 });
    const leitura = rodar(detector, {
      de: 3016,
      ate: 12000,
      nivel: () => 0.25,
      temPergunta: true,
      ultimaTranscricaoEm: 3000,
    });

    // O piso subiu com o ambiente, então o ruído novo não segura a conversa.
    expect(leitura.decisao).toBe('encerrar');
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
