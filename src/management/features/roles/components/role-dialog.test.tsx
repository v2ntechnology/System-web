import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamRole } from '@/management/lib/fleet-api';

import { RoleDialog } from './role-dialog';
import type { PermissionItem } from '../api';

/**
 * ⚠️ Esta é a armadilha que APAGA dado do cliente, e ela é silenciosa.
 *
 * `GET /v1/roles` devolve as permissões gravadas, que podem exceder o plano: uma
 * empresa starter tem cargos semeados com `analytics.view`. O PATCH substitui o
 * array inteiro, então um editor que mostrasse só as permissões cobertas pelo
 * plano gravaria sem aquelas chaves na primeira vez que alguém salvasse, e um
 * upgrade depois não as traria de volta. Nada na tela denunciaria a perda.
 */

const { updateRole } = vi.hoisted(() => ({ updateRole: vi.fn() }));

vi.mock('../api', () => ({
  updateRole,
  createRole: vi.fn(),
}));

const CATALOGO: PermissionItem[] = [
  {
    key: 'fleet.view',
    label: 'Ver a frota',
    group: 'FROTA',
    groupLabel: 'Frota',
    module: 'fleet',
  },
];

const CARGO: TeamRole = {
  id: 'cargo-1',
  key: 'patio',
  name: 'Pátio',
  description: null,
  /* `analytics.view` está gravada e o plano starter não a cobre: ela não vem no
     catálogo, e é exatamente a que não pode se perder. */
  permissions: ['fleet.view', 'analytics.view'],
  system: false,
};

/* ⚠️ O jsdom não tem `ResizeObserver`, e o seletor do Radix mede o gatilho ao
   montar: sem este esboço o formulário inteiro falha ao renderizar, com um erro
   que não menciona o seletor. */
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
  updateRole.mockReset();
  updateRole.mockResolvedValue(undefined);
});

describe('RoleDialog', () => {
  it('preserva as permissões fora do plano ao salvar', async () => {
    render(<RoleDialog role={CARGO} catalogo={CATALOGO} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar cargo' }));

    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    const [, changes] = updateRole.mock.calls[0] as [string, { permissions: string[] }];
    expect(changes.permissions).toContain('analytics.view');
    expect(changes.permissions).toContain('fleet.view');
  });

  it('mostra a permissão fora do plano marcada e desabilitada, dizendo em qual plano ela vem', () => {
    render(<RoleDialog role={CARGO} catalogo={CATALOGO} onClose={vi.fn()} onSaved={vi.fn()} />);

    const caixa = screen.getByRole('checkbox', { name: /Ver custos e indicadores/ });
    expect(caixa).toBeDisabled();
    expect(caixa).toBeChecked();
    expect(screen.getByText('Vem no plano Business.')).toBeInTheDocument();
  });
});
