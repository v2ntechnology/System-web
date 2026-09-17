import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vehicle } from '@/management/types';
import { YardPage } from './yard-page';

const { getVehicles } = vi.hoisted(() => ({ getVehicles: vi.fn() }));
vi.mock('../api', () => ({ getVehicles }));
vi.mock('@/management/components/layout/app-topbar', () => ({ AppTopbar: () => null }));
const fleet: Vehicle[] = [
  {
    id: '1',
    plate: 'ABC1D23',
    brand: 'Volvo',
    model: 'FH 460',
    odometerKm: 123000,
    status: 'DISPONIVEL',
    unit: 'Filial São Cristóvão',
    internalCode: 'F042',
  },
  {
    id: '2',
    plate: 'DEF4G56',
    brand: 'Scania',
    model: 'R 450',
    odometerKm: 56000,
    status: 'EM_VIAGEM',
    unit: 'Filial Queimados',
    driverName: 'João',
  },
  {
    id: '3',
    plate: 'GHI7J89',
    brand: 'Volvo',
    model: 'FH 540',
    odometerKm: 97000,
    status: 'MANUTENCAO',
    unit: 'Filial São Cristóvão',
  },
  {
    id: '4',
    plate: 'JKL1M23',
    brand: 'Iveco',
    model: 'Daily',
    odometerKm: 42000,
    status: 'SEM_SINAL',
    unit: 'Filial Queimados',
  },
  { id: '5', plate: 'NOP4Q56', brand: 'DAF', model: 'XF', odometerKm: 67000, status: 'BLOQUEADO' },
];

beforeEach(() => {
  getVehicles.mockReset();
  getVehicles.mockResolvedValue(fleet);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      {/* ⚠️ O cartão é um `<Link>` desde que passou a levar à página do veículo,
          e `Link` sem roteador estoura em "Cannot destructure basename". */}
      <MemoryRouter>
        <YardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, user: userEvent.setup() };
}

/**
 * Os cartões da grade.
 *
 * ⚠️ Filtra pelo NOME, e não por `getAllByRole('link')` puro: a faixa do topo
 * traz a navegação do painel inteira, e sem o filtro a contagem somaria os
 * links do menu aos veículos.
 */
const cartoes = () => screen.queryAllByRole('link', { name: /^Veículo / });

describe('Pátio', () => {
  it('combina filial, situação e busca, atualizando os totais da filial', async () => {
    const { user } = setup();
    await screen.findByRole('link', { name: /^Veículo ABC1D23/ });
    await user.click(screen.getByRole('button', { name: /Filial \/ pátio/ }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar filial' }), 'sao');
    expect(screen.queryByRole('button', { name: /Queimados/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /São Cristóvão/ }));
    expect(cartoes()).toHaveLength(2);
    expect(
      within(screen.getByRole('button', { name: /Toda a frota/ })).getByText('2'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Disponíveis/ }));
    await user.type(screen.getByRole('textbox', { name: 'Encontrar veículo' }), 'F042');
    expect(cartoes()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(cartoes()).toHaveLength(5);
  });

  it('separa sem sinal de bloqueados e mantém filial desconhecida explícita', async () => {
    const { user } = setup();
    await screen.findByRole('link', { name: /^Veículo ABC1D23/ });
    expect(screen.getByRole('heading', { name: 'Sem pátio definido' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sem sinal/ }));
    expect(cartoes()).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^Veículo JKL1M23/ })).toHaveAttribute(
      'data-tone',
      'warning',
    );
    await user.click(screen.getByRole('button', { name: /Bloqueados/ }));
    expect(screen.getByRole('link', { name: /^Veículo NOP4Q56/ })).toHaveAttribute(
      'data-tone',
      'error',
    );
  });

  it('permite selecionar uma filial por teclado e recuperar uma busca vazia', async () => {
    const { user } = setup();
    await screen.findByRole('link', { name: /^Veículo ABC1D23/ });
    await user.click(screen.getByRole('button', { name: /Filial \/ pátio/ }));
    const search = screen.getByRole('textbox', { name: 'Buscar filial' });
    expect(search).toHaveFocus();
    await user.type(search, 'Queimados{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cartoes()).toHaveLength(2);
    await user.type(screen.getByRole('textbox', { name: 'Encontrar veículo' }), 'inexistente');
    expect(screen.getByRole('heading', { name: 'Nenhum veículo encontrado' })).toBeInTheDocument();
    expect(cartoes()).toHaveLength(0);
  });

  it('avisa quando a sincronização está ausente, inválida ou atrasada', async () => {
    getVehicles.mockResolvedValue([
      { ...fleet[0], lastSyncAt: new Date().toISOString() },
      { ...fleet[1], lastSyncAt: 'inválido' },
      { ...fleet[2], lastSyncAt: new Date(Date.now() - 31 * 60_000).toISOString() },
      fleet[3],
    ]);
    setup();
    expect(await screen.findByText(/3 veículos sem sincronização recente/)).toBeInTheDocument();
  });

  it('exibe falha de consulta sem mostrar disponibilidade zero como dado confirmado', async () => {
    getVehicles.mockRejectedValue(new Error('Indisponível'));
    setup();
    await waitFor(() => expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument());
    expect(
      within(screen.getByRole('button', { name: /Disponíveis/ })).getByText('—'),
    ).toBeInTheDocument();
    expect(cartoes()).toHaveLength(0);
  });
});
