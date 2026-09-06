import { describe, expect, it } from 'vitest';

import { descreverLacuna, prepararTrajeto } from './track-segments';

/**
 * Os casos vieram de medição, e não de imaginação: os números do RDU8D06 na
 * base local (lacuna de 685 minutos e 20,9 km) e em produção (salto de 3,3 km
 * com zero minuto de intervalo, que é erro de GPS).
 */

/** Constrói uma leitura a `minuto` do começo, na coordenada dada. */
function ponto(minuto: number, lng: number, lat: number) {
  return {
    coordinates: [lng, lat] as [number, number],
    at: new Date(Date.UTC(2026, 8, 5, 12, 0, 0) + minuto * 60_000).toISOString(),
  };
}

describe('prepararTrajeto', () => {
  it('mantém um trecho só quando as leituras são contínuas', () => {
    const { segmentos, lacunas } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      ponto(2, -43.302, -22.9),
    ]);

    expect(segmentos).toHaveLength(1);
    expect(segmentos[0]).toHaveLength(3);
    expect(lacunas).toHaveLength(0);
  });

  it('quebra o trecho quando o tempo entre leituras passa do limite', () => {
    const { segmentos, lacunas } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      /* 685 minutos: a lacuna real medida no RDU8D06. */
      ponto(686, -43.5, -22.75),
      ponto(687, -43.501, -22.75),
    ]);

    expect(segmentos).toHaveLength(2);
    expect(lacunas).toHaveLength(1);
    expect(lacunas[0]?.minutos).toBe(685);
    expect(lacunas[0]?.km).toBeGreaterThan(15);
  });

  it('quebra o trecho por distância mesmo com o relógio curto', () => {
    const { segmentos, lacunas } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      /* 4 minutos, dentro do limite de tempo, mas 5 km adiante: a 75 km/h é
         possível, então não é ponto espúrio, é buraco de cobertura. */
      ponto(4, -43.35, -22.9),
      ponto(5, -43.351, -22.9),
    ]);

    expect(segmentos).toHaveLength(1);
    expect(lacunas).toHaveLength(1);
    expect(lacunas[0]?.km).toBeGreaterThan(4);
  });

  it('descarta a leitura fisicamente impossível sem quebrar o trecho', () => {
    const { segmentos, lacunas, descartados } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.301, -22.9),
      /* Mesmo instante da anterior, 3,3 km adiante: o caso de produção. */
      ponto(1, -43.335, -22.9),
      ponto(2, -43.302, -22.9),
    ]);

    expect(descartados).toBe(1);
    expect(segmentos).toHaveLength(1);
    expect(lacunas).toHaveLength(0);
    expect(segmentos[0]).toHaveLength(3);
  });

  it('compara o ponto seguinte com a última leitura BOA, e não com a descartada', () => {
    const { segmentos, descartados } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      ponto(1, -43.4, -22.9), // salto impossível, descartado
      ponto(2, -43.301, -22.9), // continua o trecho de onde ele estava
    ]);

    expect(descartados).toBe(1);
    expect(segmentos).toHaveLength(1);
    expect(segmentos[0]).toEqual([
      [-43.3, -22.9],
      [-43.301, -22.9],
    ]);
  });

  it('não devolve trecho de um ponto só, que não vira linha', () => {
    const { segmentos, coordenadas } = prepararTrajeto([
      ponto(0, -43.3, -22.9),
      ponto(600, -43.9, -22.4),
    ]);

    expect(segmentos).toHaveLength(0);
    /* As duas leituras continuam contando para enquadrar a câmera. */
    expect(coordenadas).toHaveLength(2);
  });

  it('aguenta lista vazia e lista de um ponto', () => {
    expect(prepararTrajeto([]).segmentos).toHaveLength(0);
    expect(prepararTrajeto([ponto(0, -43.3, -22.9)]).segmentos).toHaveLength(0);
  });
});

describe('descreverLacuna', () => {
  it('usa minuto abaixo de uma hora', () => {
    expect(descreverLacuna(42)).toBe('42 min');
  });

  it('usa hora cheia sem sobra', () => {
    expect(descreverLacuna(120)).toBe('2 h');
  });

  it('mostra a sobra em minutos', () => {
    expect(descreverLacuna(685)).toBe('11 h 25 min');
  });
});
