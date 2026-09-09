import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import VoiceAssistantPage from './voice-assistant-page';

describe('assistente de voz', () => {
  it('orienta o usuário quando o navegador não oferece captura de áudio', async () => {
    const user = userEvent.setup();

    /* A tela de voz passou a buscar o catálogo de vozes e a sessão da conversa
       pelo react-query (05/09/2026), e sem o provedor ela nem monta. Os dois
       pedidos falham aqui, de propósito: o que este teste checa é o caminho do
       microfone indisponível, que não depende de nenhum dos dois. */
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <VoiceAssistantPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Iniciar conversa' }));

    expect(
      await screen.findByRole('heading', { name: 'Microfone indisponível' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
