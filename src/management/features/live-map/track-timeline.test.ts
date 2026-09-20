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

  it('dá mais tempo de tela ao trajeto maior, mas menos que a proporção dele', () => {
    /*
     * ⚠️ Mudado em 19/09/2026, e antes este teste afirmava o oposto: que os dois
     * duravam igual. Era daí que vinha a reclamação do usuário de que "em 24 e
     * 72 horas o 1x, o 2x e o 4x estão muito rápidos": 478 km e 16 km cabiam nos
     * mesmos 160 segundos, então o de 478 corria 29 vezes mais.
     */
    const curto = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      ponto(2, -43.302, -22.9),
    ]);
    const longo = montarLinhaDoTempo(
      Array.from({ length: 200 }, (_, i) => ponto(i * 5, -43.3 - i * 0.001, -22.9)),
    );

    expect(longo.duracao).toBeGreaterThan(curto.duracao);
    /* E o expoente abaixo de 1 é o que mantém isso assistível: cem vezes mais
       estrada não pode custar cem vezes mais tela. */
    expect(longo.duracao / curto.duracao).toBeLessThan(200 / 2);
  });

  it('não passa do teto, por maior que seja o trajeto', () => {
    /* Um trajeto absurdo: sem teto, ele levaria mais de uma hora a 1x. */
    const gigante = montarLinhaDoTempo(
      Array.from({ length: 3000 }, (_, i) => ponto(i * 2, -43.3 - i * 0.002, -22.9)),
    );

    expect(gigante.duracao).toBeLessThanOrEqual(900);
  });

  it('trajeto curto não encolhe abaixo da duração de referência', () => {
    /* Caminhão que mal saiu do lugar: o replay não pode virar um piscar. */
    const quaseParado = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.3004, -22.9),
      ponto(2, -43.3008, -22.9),
    ]);

    expect(quaseParado.duracao).toBe(160);
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

  it('cobra a parada UMA vez, por mais leituras que ela tenha', () => {
    /*
     * ⚠️ O defeito que este teste tranca: parado no pátio, a MiX manda uma
     * leitura a cada 30 segundos, e cada uma delas virava um passo. Medido no
     * RIQ7B85 em 6 horas, as 295 leituras paradas comiam 23% do replay com o
     * caminhão sem sair do lugar.
     */
    const doisPontosParados = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ponto(0.5, -43.3, -22.9),
      ponto(1, -43.299, -22.9),
    ]);
    const vinteParados = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      ...Array.from({ length: 19 }, (_, i) => ponto((i + 1) * 0.5, -43.3, -22.9)),
      ponto(10, -43.299, -22.9),
    ]);

    const fatia = (linha: ReturnType<typeof montarLinhaDoTempo>) => {
      const parados = linha.passos.filter((passo) => passo.parado);
      return parados.reduce((soma, passo) => soma + passo.duracao, 0) / linha.duracao;
    };

    /* Dez vezes mais leituras paradas, e a parada continua ocupando a mesma
       fatia do replay. */
    expect(fatia(vinteParados)).toBeCloseTo(fatia(doisPontosParados), 3);
  });

  it('anda na mesma velocidade de tela num trecho rápido e num lento', () => {
    /*
     * O pedido do usuário em 19/09/2026: "o 1x é 1x em todo o trecho, mesmo que
     * o motorista esteja a 90 por hora ou a 2 km por hora".
     *
     * As leituras da MiX chegam de 30 em 30 segundos independentemente da
     * velocidade, então aqui o primeiro trecho cobre dez vezes mais distância
     * que o segundo no mesmo tempo de relógio. Na tela, os dois precisam ser
     * percorridos na mesma velocidade.
     */
    const linha = montarLinhaDoTempo([
      ponto(0, -43.3, -22.9),
      /* ⚠️ Abaixo de 1 km, senão o próprio salto vira lacuna e quebra o
         segmento, e aí não há dois passos para comparar. */
      ponto(0.5, -43.296, -22.9), // rápido: 0,004 grau, cerca de 410 m
      ponto(1, -43.295, -22.9), // lento: 0,001 grau, cerca de 102 m
    ]);

    const rapido = linha.passos[0];
    const lento = linha.passos[1];
    const velocidade = (passo: (typeof linha.passos)[number]) =>
      Math.abs(passo.para.coordinates[0] - passo.de.coordinates[0]) / passo.duracao;

    expect(rapido).toBeDefined();
    expect(lento).toBeDefined();
    /* Dez vezes a distância custa dez vezes o tempo de tela, então a razão
       entre as duas velocidades é 1. Antes desta mudança era 10. */
    expect(velocidade(rapido!) / velocidade(lento!)).toBeCloseTo(1, 2);
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
