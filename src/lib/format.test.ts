import { describe, expect, it } from 'vitest';

import { formatKm, formatLiters, formatPercent, getInitials } from './format';

describe('getInitials', () => {
  it('usa a primeira e a última palavra do nome', () => {
    expect(getInitials('Thiago Moreira Lima')).toBe('TL');
  });

  it('usa as duas primeiras letras quando há apenas um nome', () => {
    expect(getInitials('Thiago')).toBe('TH');
  });

  it('tolera espaços extras sem quebrar', () => {
    expect(getInitials('  Ana   Souza  ')).toBe('AS');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(getInitials('   ')).toBe('');
  });
});

describe('formatadores pt-BR', () => {
  it('formata percentual a partir de uma fração', () => {
    expect(formatPercent(0.98)).toBe('98%');
  });

  it('formata quilometragem com separador de milhar', () => {
    expect(formatKm(128450)).toBe('128.450 km');
  });

  it('formata litros com separador de milhar', () => {
    expect(formatLiters(1250)).toBe('1.250 L');
  });
});
