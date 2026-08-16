import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import HubPage from './hub-page';
import VoiceAssistantPage from './voice-assistant-page';

describe('painel de escolha de ambiente', () => {
  it('direciona para a gestão e para o assistente de voz', () => {
    const { container } = render(
      <MemoryRouter>
        <HubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Acessar o sistema de gestão/i })).toHaveAttribute(
      'href',
      '/gestao',
    );
    expect(screen.getByRole('link', { name: /Conversar com a IA da RookHub/i })).toHaveAttribute(
      'href',
      '/assistente',
    );
    expect(container.querySelector('img[src="/images/hub-robot.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/hub-rook.png"]')).toBeInTheDocument();
  });

  it('orienta o usuário quando o navegador não oferece captura de áudio', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VoiceAssistantPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Iniciar conversa' }));

    expect(
      await screen.findByRole('heading', { name: 'Microfone indisponível' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
