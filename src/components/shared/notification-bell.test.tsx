import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { NotificationBell, type NotificationBellItem } from './notification-bell';

const information: NotificationBellItem = {
  id: 'info',
  title: 'Relatório disponível',
  description: 'O fechamento do mês está pronto para consulta.',
  severity: 'info',
  meta: 'Relatórios · há 1 h',
  to: '/relatorios',
};

function renderBell(items: NotificationBellItem[], isPending = false) {
  render(
    <MemoryRouter>
      <NotificationBell
        items={items}
        badgeCount={26}
        countLabel="26 não lidas"
        emptyMessage="Nenhuma notificação ativa."
        viewAllTo="/notificacoes"
        onDismiss={vi.fn()}
        isPending={isPending}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notificações: 26 não lidas' }));
  return screen.getByRole('dialog', { name: 'Notificações' });
}

describe('NotificationBell', () => {
  it('filtra prioridades antes de aplicar o limite de doze avisos', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ ...information, id: `info-${i}` }));
    const critical: NotificationBellItem = {
      ...information,
      id: 'critical',
      title: 'Motorista passou do limite de jornada',
      severity: 'critical',
      isUnread: true,
    };
    const high: NotificationBellItem = { ...information, id: 'high', severity: 'high' };
    const dialog = renderBell([...items, critical, high]);

    expect(within(dialog).getAllByRole('listitem')).toHaveLength(12);
    expect(screen.queryByText(critical.title)).not.toBeInTheDocument();
    expect(screen.getByText('12 de 15 avisos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prioritárias 2' }));

    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(critical.title)).toBeInTheDocument();
    expect(screen.getByText('Não lida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prioritárias 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explica o filtro vazio e volta a Todas ao reabrir', () => {
    renderBell([information]);
    fireEvent.click(screen.getByRole('button', { name: 'Prioritárias 0' }));
    expect(screen.getByText('Nenhum aviso prioritário')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificações' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 26 não lidas' }));
    expect(screen.getByText(information.title)).toBeInTheDocument();
    expect(screen.getByText(information.description!)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todas 1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mantém os destinos dos avisos e fecha a caixa ao navegar', () => {
    renderBell([information]);
    const link = screen.getByRole('link', { name: /Relatório disponível/ });
    expect(link).toHaveAttribute('href', '/relatorios');
    expect(screen.getByRole('link', { name: 'Ver todas as notificações' })).toHaveAttribute(
      'href',
      '/notificacoes',
    );
    fireEvent.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('distingue carregamento de uma lista vazia', () => {
    renderBell([], true);
    expect(screen.getByRole('status', { name: 'Carregando notificações' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum aviso por aqui')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todas' })).toBeDisabled();
  });
});
