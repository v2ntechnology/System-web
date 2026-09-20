import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Fine } from '../types';

import { FineRow } from './fine-row';

/**
 * A linha da fila de infrações.
 *
 * O que estes testes protegem é a leitura do ESTADO da multa, que passou a
 * existir com a coleta de `STATUS INFRACAO`: antes dela toda multa era uma
 * linha parada, e quem pagava continuava vendo a cobrança.
 */
const BASE: Fine = {
  id: '1',
  smartecId: 'guid-1',
  stage: 'MULTA',
  plate: 'QTM5077',
  renavam: '123',
  registered: true,
  vehicleId: 'v1',
  fleetNumber: null,
  unit: null,
  ait: 'A123',
  infractionAt: '2026-03-10T08:00:00',
  location: 'BR-101, km 12',
  city: 'Niterói',
  uf: 'RJ',
  description: 'Excesso de velocidade',
  infractionCode: '7455',
  points: 5,
  amount: 195.23,
  amountWithDiscount: null,
  discountAmount: null,
  agency: 'DETRAN-RJ',
  /* Data de vencimento no passado: é o caso que separa "vencida" de "paga". */
  dueDate: '2026-04-10',
  indicationDeadline: null,
  documentUrl: null,
  boletoUrl: null,
  boletoAmount: null,
  boletoDueDate: null,
  boletoDiscountPercent: null,
  paymentConfirmed: false,
  status: null,
  paidAt: null,
  paidAmount: null,
  smartecPaymentUrl: null,
  searchedAt: '2026-09-01',
  source: 'SMARTEC',
  notes: null,
};

describe('FineRow', () => {
  it('marca como vencida a multa em aberto com data passada', () => {
    render(<FineRow fine={BASE} onOpen={vi.fn()} />);

    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.queryByText(/^Paga/)).not.toBeInTheDocument();
  });

  it('não chama de vencida a multa que consta paga', () => {
    /* ⚠️ Mesma data passada do caso acima. Sem a guarda em `estaVencida`, a
       multa quitada ficaria vermelha para sempre, porque a data dela passou
       mesmo. Este é o teste que impede a regressão. */
    render(
      <FineRow
        fine={{ ...BASE, paymentConfirmed: true, paidAt: '2026-04-02', paidAmount: 195.23 }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Paga em 02/04/2026')).toBeInTheDocument();
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument();
  });

  it('mostra o valor pago só quando ele difere do valor da multa', () => {
    const { rerender } = render(
      <FineRow
        fine={{ ...BASE, paymentConfirmed: true, paidAt: '2026-04-02', paidAmount: 156.18 }}
        onOpen={vi.fn()}
      />,
    );
    /* Pagou com desconto: é este número que entra no custo da frota. */
    expect(screen.getByText('Pago R$ 156,18')).toBeInTheDocument();

    rerender(
      <FineRow
        fine={{ ...BASE, paymentConfirmed: true, paidAt: '2026-04-02', paidAmount: 195.23 }}
        onOpen={vi.fn()}
      />,
    );
    /* Pagou o valor cheio: repetir o mesmo número duas vezes só ocupa a linha. */
    expect(screen.queryByText(/^Pago /)).not.toBeInTheDocument();
  });

  it('diz "Paga" sem data quando o órgão confirma e não informa o dia', () => {
    /* Medido na origem: parte das respostas confirma o pagamento sem
       `DATA_PAGAMENTO`. Esconder a confirmação por falta da data deixaria a
       multa na fila de cobrança sem motivo. */
    render(<FineRow fine={{ ...BASE, paymentConfirmed: true }} onOpen={vi.fn()} />);

    expect(screen.getByText('Paga')).toBeInTheDocument();
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument();
  });
});
