import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as FleetApi from '@/management/lib/fleet-api';
import type { VehicleListEntry } from '@/management/lib/fleet-api';
import type { Vehicle } from '@/management/types';
import { YardPage } from './yard-page';

const { getVehicles } = vi.hoisted(() => ({ getVehicles: vi.fn() }));
vi.mock('../api', () => ({ getVehicles }));
vi.mock('@/management/components/layout/app-topbar', () => ({ AppTopbar: () => null }));

/* ⚠️ O aviso de sincronização virou toast em 18/09/2026, e o `Toaster` não é
   montado aqui: quem responde pelo aviso passou a ser a CHAMADA, e não um texto
   no documento. */
const { avisos } = vi.hoisted(() => ({ avisos: vi.fn() }));
/* ⚠️ `dismiss` faz parte do mock desde 19/09/2026, e não é enfeite: a tela
   dispensa o aviso ao ser desmontada, para ele não viajar para a tela seguinte.
   Sem esta linha, o `cleanup` do Testing Library derruba nove testes de uma vez,
   e a pilha aponta para o React, não para o mock. */
vi.mock('sonner', () => ({
  toast: { warning: avisos, success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

/* ⚠️ A situação documental é a TERCEIRA origem da tela, e precisa de mock
   próprio: sem ele o teste sai para a rede, e o selo do cartão nunca aparece
   porque a consulta falha. */
const { prontidao } = vi.hoisted(() => ({ prontidao: vi.fn() }));
vi.mock('@/management/features/documents/api', () => ({ fetchVehicleReadiness: prontidao }));

/* Só esta função é trocada; o resto do módulo continua real, porque o modal de
   cadastro e os diálogos de confirmação importam dele. */
const { registro } = vi.hoisted(() => ({ registro: vi.fn() }));
vi.mock('@/management/lib/fleet-api', async (original) => ({
  ...(await original<typeof FleetApi>()),
  fetchVehicleRegistryList: registro,
}));
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

/** A ficha de cadastro que a grade cruza para saber quem saiu da frota. */
const ficha = (id: string, active: boolean) =>
  ({ id, plate: `placa-${id}`, active }) as unknown as VehicleListEntry;

beforeEach(() => {
  getVehicles.mockReset();
  getVehicles.mockResolvedValue(fleet);
  avisos.mockReset();
  registro.mockReset();
  registro.mockResolvedValue([]);
  prontidao.mockReset();
  prontidao.mockResolvedValue({
    items: [],
    summary: { total: 0, irregular: 0, warning: 0, neverChecked: 0, regular: 0 },
  });
  /* ⚠️ O `GlassSelect` é Radix, e o Radix conta com APIs de ponteiro e rolagem
     que o jsdom não implementa. Sem estes três, abrir a lista estoura. */
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
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
      {/* ⚠️ O cartão navega para a página do veículo, e `useNavigate` sem
          roteador estoura em "Cannot destructure basename". */}
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
 * ⚠️ Filtra pelo NOME, e não por `getAllByRole('button')` puro: a faixa do topo
 * traz a navegação do painel inteira e cada cartão traz o próprio rodapé de
 * ações, então sem o filtro a contagem somaria menu e botões aos veículos.
 *
 * ⚠️ É `button`, e não `link`, desde 18/09/2026: com o cadastro dentro do pátio
 * o cartão deixou de ser âncora, porque botão dentro de `<a>` é HTML inválido.
 */
const cartoes = () => screen.queryAllByRole('button', { name: /^Veículo / });

/** Escolhe numa lista do `GlassSelect`, que é Radix e não `<select>` nativo. */
async function escolher(
  user: ReturnType<typeof userEvent.setup>,
  campo: string,
  opcao: string | RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: campo }));
  await user.click(await screen.findByRole('option', { name: opcao }));
}

describe('Pátio', () => {
  it('combina empresa, situação e busca, atualizando os totais da empresa', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    await user.click(screen.getByRole('button', { name: /^Empresa/ }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar empresa' }), 'sao');
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

  it('separa sem sinal de bloqueados e mantém empresa desconhecida explícita', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    expect(screen.getByRole('heading', { name: 'Sem pátio definido' })).toBeInTheDocument();
    /* ⚠️ `^`: o cartão do veículo também é `button` e o rótulo dele termina em
       "Sem sinal", então sem a âncora a busca acha o filtro e o cartão. */
    await user.click(screen.getByRole('button', { name: /^Sem sinal/ }));
    expect(cartoes()).toHaveLength(1);
    /* Cinza desde 18/09/2026: sem sinal é ausência de notícia, e o laranja está
       reservado para Manutenção, que é avaria de verdade. */
    expect(screen.getByRole('button', { name: /^Veículo JKL1M23/ })).toHaveAttribute(
      'data-tone',
      'muted',
    );
    await user.click(screen.getByRole('button', { name: /Bloqueados/ }));
    expect(screen.getByRole('button', { name: /^Veículo NOP4Q56/ })).toHaveAttribute(
      'data-tone',
      'error',
    );
  });

  it('permite selecionar uma empresa por teclado e recuperar uma busca vazia', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    await user.click(screen.getByRole('button', { name: /^Empresa/ }));
    const search = screen.getByRole('textbox', { name: 'Buscar empresa' });
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
    await waitFor(() =>
      expect(avisos).toHaveBeenCalledWith(
        '3 veículos sem sincronização recente',
        expect.objectContaining({ id: 'patio-sem-sincronizar' }),
      ),
    );
  });

  it('esconde o veículo inativo até o filtro de cadastro pedir por ele', async () => {
    registro.mockResolvedValue([ficha('1', true), ficha('2', false)]);
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    expect(screen.queryByRole('button', { name: /^Veículo DEF4G56/ })).not.toBeInTheDocument();
    /* O inativo também não pode entrar na conta do topo, senão o número diverge
       do que a grade mostra logo abaixo dele. */
    expect(within(screen.getByRole('button', { name: /Toda a frota/ })).getByText('4'));

    await escolher(user, 'Cadastro', 'Somente inativos');
    await screen.findByRole('button', { name: /^Veículo DEF4G56/ });
    expect(screen.queryByRole('button', { name: /^Veículo ABC1D23/ })).not.toBeInTheDocument();
  });

  it('mostra a frota inteira enquanto o cadastro não respondeu', async () => {
    /* O cadastro vazio é o que a tela enxerga no intervalo entre as duas
       consultas, que saem juntas e não chegam juntas. Sem a suposição de ativo,
       seria neste instante que a grade piscaria "Nenhum veículo encontrado". */
    registro.mockResolvedValue([]);
    setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    expect(cartoes()).toHaveLength(5);
  });

  it('filtra por situação pelo seletor, e não só pelos indicadores', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    await escolher(user, 'Situação', 'Em viagem');
    expect(cartoes()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Veículo DEF4G56/ })).toBeInTheDocument();
  });

  it('não repete o aviso enquanto a contagem não muda', async () => {
    getVehicles.mockResolvedValue([{ ...fleet[0], lastSyncAt: 'inválido' }]);
    const { rerender } = setup();
    await waitFor(() => expect(avisos).toHaveBeenCalledTimes(1));
    rerender(<div />);
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('marca o documento irregular sem tirar o veículo do estado da telemetria', async () => {
    prontidao.mockResolvedValue({
      items: [
        {
          vehicleId: '1',
          plate: 'ABC1D23',
          fleetNumber: null,
          level: 'IRREGULAR',
          reasons: ['Cronotacógrafo com certificado vencido'],
        },
      ],
      summary: { total: 5, irregular: 1, warning: 0, neverChecked: 0, regular: 4 },
    });
    setup();

    /* ⚠️ O cartão continua DISPONÍVEL: por decisão do usuário em 19/09/2026 a
       plataforma marca o documento e não bloqueia a saída. Se um dia alguém
       trocar o estado do veículo por causa do documento, é aqui que quebra. */
    const cartao = await screen.findByRole('button', {
      name: /^Veículo ABC1D23, Disponível, documento irregular/,
    });
    expect(within(cartao).getByText('Documento irregular')).toBeInTheDocument();
    expect(screen.queryByText(/não pode sair/i)).not.toBeInTheDocument();
  });

  it('não desenha selo no veículo com a documentação em dia', async () => {
    prontidao.mockResolvedValue({
      items: [
        { vehicleId: '1', plate: 'ABC1D23', fleetNumber: null, level: 'REGULAR', reasons: [] },
      ],
      summary: { total: 5, irregular: 0, warning: 0, neverChecked: 0, regular: 5 },
    });
    setup();

    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });
    /* Um selo "em dia" em 25 dos 40 cartões vira o fundo da grade. */
    expect(screen.queryByText('Documentação em dia')).not.toBeInTheDocument();
  });

  it('encontra os irregulares pelo seletor de documentação', async () => {
    prontidao.mockResolvedValue({
      items: [
        {
          vehicleId: '3',
          plate: 'GHI7J89',
          fleetNumber: null,
          level: 'IRREGULAR',
          reasons: ['Licenciamento parado no exercício 2025'],
        },
        { vehicleId: '1', plate: 'ABC1D23', fleetNumber: null, level: 'REGULAR', reasons: [] },
      ],
      summary: { total: 5, irregular: 1, warning: 0, neverChecked: 0, regular: 4 },
    });
    const { user } = setup();
    await screen.findByRole('button', { name: /^Veículo ABC1D23/ });

    await escolher(user, 'Documentação', 'Documento irregular');
    expect(cartoes()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Veículo GHI7J89/ })).toBeInTheDocument();
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
