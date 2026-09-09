import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HubPage from './hub-page';

vi.mock('@/components/shared/globe', () => ({ Globe: () => <div aria-hidden="true" /> }));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderHub() {
  render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route path="/painel" element={<HubPage />} />
        <Route path="/assistente" element={<h1>Destino assistente</h1>} />
        <Route path="/gestao" element={<h1>Destino gestão</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('painel interativo', () => {
  it('mantém o seletor e a esfera sincronizados sem navegar', async () => {
    const user = userEvent.setup();
    renderHub();
    const ai = screen.getByRole('button', { name: 'IA' });
    const management = screen.getByRole('button', { name: 'Gestão' });
    expect(ai).toHaveAttribute('aria-pressed', 'true');
    await user.click(management);
    expect(management).toHaveAttribute('aria-pressed', 'true');
    expect(ai).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Mudar para IA' })).toBeInTheDocument();
    await user.click(ai);
    expect(screen.getByRole('link', { name: 'Conversar com a IA' })).toBeInTheDocument();
    expect(ai).toHaveAttribute('aria-pressed', 'true');
  });

  it('alterna repetidamente sem navegar e atualiza o CTA', async () => {
    const user = userEvent.setup();
    renderHub();
    expect(screen.getByRole('link', { name: 'Conversar com a IA' })).toHaveAttribute(
      'href',
      '/assistente',
    );
    await user.click(screen.getByRole('button', { name: 'Mudar para Gestão' }));
    expect(
      screen.getByRole('heading', { name: 'Uma nova dimensão de controle.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar na gestão' })).toHaveAttribute(
      'href',
      '/gestao',
    );
    const toggle = screen.getByRole('button', { name: 'Mudar para IA' });
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('link', { name: 'Conversar com a IA' })).toHaveAttribute(
      'href',
      '/assistente',
    );
    await user.keyboard(' ');
    expect(screen.getByRole('link', { name: 'Entrar na gestão' })).toBeInTheDocument();
  });

  it.each([
    { management: false, cta: 'Conversar com a IA', destination: 'Destino assistente' },
    { management: true, cta: 'Entrar na gestão', destination: 'Destino gestão' },
  ])('navega apenas pelo CTA: $cta', async ({ management, cta, destination }) => {
    const user = userEvent.setup();
    renderHub();
    if (management) await user.click(screen.getByRole('button', { name: 'Mudar para Gestão' }));
    await user.click(screen.getByRole('link', { name: cta }));
    expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
  });
});
