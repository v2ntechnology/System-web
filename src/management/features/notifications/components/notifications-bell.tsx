import { NotificationBell, type NotificationBellItem } from '@/components/shared/notification-bell';
import type { AppNotification, NotificationSeverity } from '@/management/types';
import type { Severity } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dismissNotifications, getNotifications } from '../api';
import { SOURCE, relativeTime } from '../notification-meta';

/**
 * Sino do painel de gestão: as últimas notificações sem sair da tela (RF-038).
 *
 * A caixa é o `NotificationBell` compartilhado, o mesmo que o painel operacional
 * usa (decisão do usuário em 09/09/2026). O que mora aqui é só a tradução da
 * notificação da central para o formato que a caixa entende.
 */

/**
 * A central tem três níveis e a escala comum tem cinco.
 *
 * ⚠️ `INFO` vira `info`, e não `medium`: pelo nome as duas serviriam, mas
 * `medium` pinta a pastilha de azul de destaque, e informativo é justamente o
 * que não deve disputar atenção com o resto da caixa.
 */
const SEVERITY_COMUM: Record<NotificationSeverity, Severity> = {
  CRITICO: 'critical',
  ATENCAO: 'high',
  INFO: 'info',
};

export function NotificationsBell() {
  const { data, isPending } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const queryClient = useQueryClient();
  /*
   * A lista some da tela antes de o servidor confirmar, porque o gesto já
   * mostrou a saída: esperar a resposta faria o item voltar a aparecer por um
   * instante depois de ter deslizado para fora. Se a chamada falhar, a lista
   * anterior é reposta e a notificação reaparece, que é o comportamento honesto.
   */
  const dispensar = useMutation({
    mutationFn: (id: string) => dismissNotifications([id]),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const anterior = queryClient.getQueryData<AppNotification[]>(['notifications']);
      queryClient.setQueryData<AppNotification[]>(['notifications'], (atual) =>
        atual?.filter((item) => item.id !== id),
      );
      return { anterior };
    },
    onError: (_erro, _id, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(['notifications'], contexto.anterior);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data ?? [];
  const unread = notifications.filter((item) => !item.read).length;

  const items: NotificationBellItem[] = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    severity: SEVERITY_COMUM[item.severity],
    meta: `${SOURCE[item.source].label} · ${relativeTime(item.at)}`,
    to: item.actionTo ?? '/gestao/notificacoes',
  }));

  return (
    <NotificationBell
      items={items}
      badgeCount={unread}
      countLabel={`${unread} ${unread === 1 ? 'não lida' : 'não lidas'}`}
      emptyMessage="Nenhuma notificação por aqui."
      viewAllTo="/gestao/notificacoes"
      onDismiss={(id) => dispensar.mutate(id)}
      isPending={isPending}
    />
  );
}
