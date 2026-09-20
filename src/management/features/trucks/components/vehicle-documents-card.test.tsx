import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { VehicleDetail } from '@/management/types';

import { VehicleDocumentsCard } from './vehicle-documents-card';

/**
 * O bloco de documentação do veículo.
 *
 * ⚠️ **Os três casos aqui são os da frota REAL**, e cada um já enganou alguém
 * antes de virar teste: o veículo que a Smartec nunca consultou, o que tem
 * alienação e o que o órgão diz estar "em dia" parado num exercício anterior.
 */

const BASE: VehicleDetail = {
  vehicleId: 'v1',
  openOrders: 0,
  lastMaintenanceAt: '',
  monthlyCost: [],
  recentEvents: [],
};

describe('VehicleDocumentsCard', () => {
  it('diz que nunca foi consultado em vez de afirmar que nada consta', () => {
    render(<VehicleDocumentsCard detail={BASE} />);

    expect(screen.getByText(/nunca foi consultado/i)).toBeInTheDocument();
    /* ⚠️ A ausência de restrição não pode virar "nada consta": ninguém
       verificou. São 3 veículos da frota nessa situação. */
    expect(screen.queryByText(/nada consta/i)).not.toBeInTheDocument();
  });

  it('mostra a restrição de alienação, com o nome mascarado como veio', () => {
    render(
      <VehicleDocumentsCard
        detail={{
          ...BASE,
          documentCheckedAt: '2026-09-01',
          registrationUf: 'SC',
          licensingStatus: 'LICENCIAMENTO EM DIA',
          licensingExercise: 2026,
          restrictions:
            'ALIENAÇÃO FIDUCIÁRIA EM FAVOR DE B**** R** B***** S** / NADA CONSTA / NADA CONSTA / NADA CONSTA',
        }}
      />,
    );

    expect(
      screen.getByText(/ALIENAÇÃO FIDUCIÁRIA EM FAVOR DE B\*\*\*\* R\*\*/),
    ).toBeInTheDocument();
    expect(screen.getByText('SC')).toBeInTheDocument();
  });

  it('resume as quatro posições vazias numa só linha', () => {
    render(
      <VehicleDocumentsCard
        detail={{
          ...BASE,
          documentCheckedAt: '2026-09-03',
          restrictions: 'NADA CONSTA / NADA CONSTA / NADA CONSTA / NADA CONSTA',
        }}
      />,
    );

    expect(screen.getByText('Nada consta')).toBeInTheDocument();
  });

  it('acusa exercício atrasado mesmo com o órgão dizendo que está em dia', () => {
    render(
      <VehicleDocumentsCard
        detail={{
          ...BASE,
          documentCheckedAt: '2026-09-01',
          licensingStatus: 'LICENCIAMENTO EM DIA',
          /* ⚠️ O caso do QTM5077: a frase do órgão diz "em dia" e o exercício
             está no ano anterior. Quem responde é o exercício. */
          licensingExercise: 2025,
        }}
      />,
    );

    expect(screen.getByText(/exercício 2025, atrasado/i)).toBeInTheDocument();
  });

  it('não chama de atrasado o exercício do ano corrente', () => {
    render(
      <VehicleDocumentsCard
        detail={{
          ...BASE,
          documentCheckedAt: '2026-09-01',
          licensingStatus: 'LICENCIAMENTO EM DIA',
          licensingExercise: new Date().getFullYear(),
        }}
      />,
    );

    expect(screen.queryByText(/atrasado/i)).not.toBeInTheDocument();
  });
});
