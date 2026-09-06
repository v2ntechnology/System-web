import { describe, expect, it } from 'vitest';

import { montarLinhaDoTempo, quadroEm, rumo } from './track-timeline';

/**
 * O que estes testes protegem é o defeito que motivou o arquivo: o replay
 * avançava por índice de ponto, então parada longa consumia muitos índices sem
 * sair do lugar e lacuna consumia um só, teleportando o caminhão.
 */

function ponto(minuto: number, lng: number, lat: number, speedKmh?: number) {
  return {
    coordinates: [lng, lat] as [number, number],
    at: new Date(Date.UTC(2026, 8, 5, 12, 0, 0) + minuto * 60_000).toISOString(),
    ...(speedKmh == null ? {} : { speedKmh }),
  };
}

describe('montarLinhaDoTempo', () => {
  it('devolve linha vazia sem leituras suficientes', () => {
    expect(montarLinhaDoTempo([]).vazia).toBe(true);
    expect(montarLinhaDoTempo([ponto(0, -43.3, -22.9)]).vazia).toBe(true);
  });

  it('dura sempre o mesmo a 1x, seja o trajeto curto ou longo', () => {
    const curto = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      ponto(2, -43.302, -22.9),
    ]);
    const longo = montarLinhaDoTempo(
      Array.from({ length: 200 }, (_, i) => ponto(i * 5, -43.3 - i * 0.001, -22.9)),
    );

    expect(curto.duracao).toBe(longo.duracao);
  });

  it('dá à lacuna um tempo próprio, em vez de atravessá-la num quadro', () => {
    const linha = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      /* 685 minutos e 20 km adiante: a lacuna real do RDU8D06. */
      ponto(686, -43.5, -22.75),
      ponto(687, -43.501, -22.75),
    ]);

    const lacuna = linha.passos.find((passo) => passo.emLacuna);
    expect(lacuna).toBeDefined();
    /* O ponto do teste: a travessia da lacuna precisa ocupar uma fatia
       perceptível do replay, e não um piscar. */
    expect((lacuna?.duracao ?? 0) / linha.duracao).toBeGreaterThan(0.05);
  });

  it('comprime a parada longa em vez de gastar o tempo real dela', () => {
    /* Parado no mesmo ponto por 4 minutos, dentro do limite de lacuna. */
    const parado = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(4, -43.3, -22.9),
      ponto(5, -43.301, -22.9),
    ]);

    const passoDaParada = parado.passos[0];
    const passoDoMovimento = parado.passos[1];
    /* Sem o teto, a parada de 4 minutos valeria quatro vezes o passo de 1
       minuto. Com o teto de 30 segundos, ela vale no máximo metade dele. */
    expect(passoDaParada?.duracao).toBeLessThanOrEqual(passoDoMovimento?.duracao ?? 0);
  });

  it('mantém o rumo anterior quando o veículo não sai do lugar', () => {
    const linha = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.299, -22.9), // vai para leste
      ponto(2, -43.299, -22.9), // parado
    ]);

    expect(linha.passos[1]?.heading).toBeCloseTo(linha.passos[0]?.heading ?? -1, 5);
  });
});

describe('quadroEm', () => {
  const linha = montarLinhaDoTempo([
    ponto(0, -43.3, -22.9, 0),
    ponto(1, -43.299, -22.9, 40),
    ponto(2, -43.298, -22.9, 60),
  ]);

  it('começa na primeira leitura e termina na última', () => {
    const inicio = quadroEm(linha, 0);
    const fim = quadroEm(linha, linha.duracao);

    expect(inicio?.lng).toBeCloseTo(-43.3, 6);
    expect(fim?.lng).toBeCloseTo(-43.298, 6);
  });

  it('anda sem saltos entre um instante e o seguinte', () => {
    /* O teste que reproduziria o defeito antigo: amostrar o replay em passos
       iguais e conferir que nenhum trecho avança muito mais que os outros. */
    const amostras = Array.from({ length: 40 }, (_, i) =>
      quadroEm(linha, (i / 39) * linha.duracao),
    );
    const avancos: number[] = [];
    for (let i = 1; i < amostras.length; i++) {
      const a = amostras[i - 1];
      const b = amostras[i];
      if (a && b) avancos.push(Math.abs(b.lng - a.lng));
    }

    const maior = Math.max(...avancos);
    const media = avancos.reduce((soma, valor) => soma + valor, 0) / avancos.length;
    expect(maior).toBeLessThan(media * 3);
  });

  it('cravar fora dos limites não quebra', () => {
    expect(quadroEm(linha, -10)?.lng).toBeCloseTo(-43.3, 6);
    expect(quadroEm(linha, 9999)?.lng).toBeCloseTo(-43.298, 6);
  });

  it('avisa quando o caminhão está atravessando um vão', () => {
    const comLacuna = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.299, -22.9),
      ponto(600, -43.6, -22.7),
      ponto(601, -43.601, -22.7),
    ]);

    const lacuna = comLacuna.passos.find((passo) => passo.emLacuna);
    const meio = quadroEm(comLacuna, (lacuna?.inicio ?? 0) + (lacuna?.duracao ?? 0) / 2);
    expect(meio?.emLacuna).toBe(true);

    expect(quadroEm(comLacuna, 0)?.emLacuna).toBe(false);
  });

  it('não inventa horário dentro da lacuna', () => {
    const comLacuna = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.299, -22.9),
      ponto(600, -43.6, -22.7),
      ponto(601, -43.601, -22.7),
    ]);

    const lacuna = comLacuna.passos.find((passo) => passo.emLacuna);
    const inicioDaLacuna = quadroEm(comLacuna, (lacuna?.inicio ?? 0) + 0.01);
    /* Ainda é o horário da última leitura de verdade, e não um meio-termo. */
    expect(inicioDaLacuna?.at).toBe(comLacuna.passos[0]?.para.at);
  });
});

describe('rumo', () => {
  it('aponta para o norte e para o leste corretamente', () => {
    expect(rumo([-43.3, -22.9], [-43.3, -22.8])).toBeCloseTo(0, 1);
    expect(rumo([-43.3, -22.9], [-43.2, -22.9])).toBeCloseTo(90, 1);
  });
});
