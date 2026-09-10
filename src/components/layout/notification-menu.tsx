import { NotificationBell, type NotificationBellItem } from '@/components/shared/notification-bell';
import { useAlerts, useDismissAlert } from '@/hooks/use-queries';
import { formatRelative } from '@/lib/format';

/**
 * Sino do painel operacional: os alertas abertos sem sair da tela.
 *
 * A caixa é o `NotificationBell` compartilhado, o mesmo que o painel de gestão
 * usa (decisão do usuário em 09/09/2026). O que mora aqui é só a tradução do
 * alerta da operação para o formato que a caixa entende.
 */
export function NotificationMenu() {
  const { data: alerts } = useAlerts();
  const dispensar = useDismissAlert();

  /* Resolvido e ignorado não são pendência: o sino mostra o que ainda espera alguém. */
  const openAlerts = (alerts ?? []).filter(
    (a) => a.status === 'open' || a.status === 'in_progress',
  );

  const items: NotificationBellItem[] = openAlerts.map((alert) => ({
    id: alert.id,
    title: alert.title,
    severity: alert.severity,
    meta: `${alert.vehiclePlate ? `${alert.vehiclePlate} · ` : ''}${formatRelative(alert.date)}`,
    to: '/app/alertas',
  }));

  return (
    <NotificationBell
      items={items}
      badgeCount={openAlerts.length}
      countLabel={`${openAlerts.length} ${openAlerts.length === 1 ? 'ativa' : 'ativas'}`}
      emptyMessage="Nenhuma notificação ativa."
      viewAllTo="/app/alertas"
      onDismiss={(id) => dispensar.mutate(id)}
    />
  );
}
