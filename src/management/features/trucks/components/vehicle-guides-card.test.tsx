import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VehicleDocument } from '@/management/features/documents/types';

import { VehicleGuidesCard } from './vehicle-guides-card';

const { guias } = vi.hoisted(() => ({ guias: vi.fn() }));
vi.mock('@/management/features/documents/api', () => ({ fetchVehicleDocuments: guias }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

const BASE: VehicleDocument = {
  id: '1',
  vehicleId: 'v1',
  plate: 'QTM5077',
  fleetNumber: null,
  kind: 'LICENCIAMENTO',
  exercise: 2026,
  amount: 180.5,
  dueDate: '2026-01-31',
  documentUrl: 'https://exemplo/guia.pdf',
  digitableLine: '85810000001',
  status: 'EM DIA',
  issuer: 'DETRAN-RJ',
  searchedAt: '2026-09-01',
  overdue: true,
  pending: false,
};

function montar(vehicleId: string | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VehicleGuidesCard vehicleId={vehicleId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VehicleGuidesCard', () => {
  beforeEach(() => {
    guias.mockReset();
  });

  it('não consulta a API no veículo de demonstração', () => {
    montar(undefined);

    expect(guias).not.toHaveBeenCalled();
    expect(screen.getByText(/demonstração/i)).toBeInTheDocument();
  });

  it('diz que lista vazia não é frota em dia', async () => {
    guias.mockResolvedValue([]);
    montar('v1');

    /* ⚠️ A frase inteira importa: "nenhuma guia" sozinho seria lido como
       "não há nada a pagar", e 3 veículos da frota nunca foram consultados. */
    expect(await screen.findByText(/não significa que não há nada a pagar/i)).toBeInTheDocument();
  });

  it('conta as pendências no cabeçalho e não repete a placa nas linhas', async () => {
    guias.mockResolvedValue([
      BASE,
      {
        ...BASE,
        id: '2',
        kind: 'CRONOTACOGRAFO',
        exercise: null,
        status: 'VENCIDO',
        digitableLine: null,
        documentUrl: null,
        pending: true,
      },
    ]);
    montar('v1');

    expect(await screen.findByText('2 guias, 1 pendente')).toBeInTheDocument();
    expect(screen.getByText('Licenciamento')).toBeInTheDocument();
    expect(screen.getByText('Certificado vencido')).toBeInTheDocument();
    /* A placa é o cabeçalho da ficha; na linha ela só ocuparia espaço e o link
       levaria para a tela em que a pessoa já está. */
    expect(screen.queryByText('QTM5077')).not.toBeInTheDocument();
  });

  it('não promete pagamento quando falta a GRU do cronotacógrafo', async () => {
    guias.mockResolvedValue([
      { ...BASE, kind: 'CRONOTACOGRAFO', documentUrl: null, digitableLine: null },
    ]);
    montar('v1');

    expect(await screen.findByText(/GRU é emitida ao solicitar a renovação/i)).toBeInTheDocument();
    expect(screen.queryByText(/copiar linha digitável/i)).not.toBeInTheDocument();
  });
});
