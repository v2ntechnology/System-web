import * as Popover from '@radix-ui/react-popover';
import { ArrowRightIcon, BellIcon } from '@phosphor-icons/react';
import { Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { getNotifications } from '../api';
import { SEVERITY, SOURCE, absoluteTime, relativeTime } from '../notification-meta';

/**
 * Sino da topbar — as últimas notificações sem sair da tela (RF-038).
 *
 * A contagem de não lidas fica no `aria-label` do botão; o badge é `aria-hidden`
 * para o leitor de tela não anunciar o número duas vezes.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const unread = data?.filter((item) => !item.read).length ?? 0;
  const latest = data?.slice(0, 4) ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notificações — ${unread} não lidas` : 'Notificações'}
          className="bg-primary-strong text-on-primary rounded-pill focus-visible:ring-secondary focus-visible:ring-offset-background relative flex size-10 items-center justify-center transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <BellIcon size={18} weight="fill" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="bg-error text-on-bright rounded-pill tabular size-4.5 absolute -right-0.5 -top-0.5 flex items-center justify-center text-[10px] font-bold"
            >
              {unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-surface-low ring-outline-variant z-[1000] w-[calc(100vw-2rem)] max-w-96 rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1"
        >
          <div className="border-outline-variant flex items-center justify-between gap-3 border-b px-3 pb-3 pt-1">
            <p className="text-on-surface font-medium">Notificações</p>
            {unread > 0 ? (
              <span className="text-on-surface-muted text-label-md tabular normal-case">
                {unread} não lidas
              </span>
            ) : null}
          </div>

          {isPending ? (
            <div className="flex justify-center py-8">
              <Spinner className="text-on-surface-muted size-5" label="Carregando notificações" />
            </div>
          ) : latest.length === 0 ? (
            <p className="text-on-surface-muted text-body-md py-8 text-center">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <ul className="my-1 flex flex-col">
              {latest.map((item) => {
                const severity = SEVERITY[item.severity];
                const SeverityIcon = severity.icon;
                const source = SOURCE[item.source];

                return (
                  <li key={item.id}>
                    <Link
                      to={item.actionTo ?? '/gestao/notificacoes'}
                      onClick={() => setOpen(false)}
                      className="focus-visible:ring-secondary hover:bg-white/8 block rounded-md px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <span className="flex items-start gap-2.5">
                        <SeverityIcon
                          size={16}
                          weight="fill"
                          aria-label={severity.label}
                          className={cn('mt-0.5 shrink-0', severity.color)}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate',
                              item.read ? 'text-on-surface-variant' : 'text-on-surface font-medium',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="text-on-surface-muted text-label-md mt-0.5 block normal-case">
                            {source.label} ·{' '}
                            <span title={absoluteTime.format(new Date(item.at))}>
                              {relativeTime(item.at)}
                            </span>
                          </span>
                        </span>
                        {!item.read ? (
                          <span
                            aria-hidden="true"
                            className="bg-primary rounded-pill mt-1.5 size-2 shrink-0"
                          />
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-outline-variant border-t pt-2">
            <Link
              to="/gestao/notificacoes"
              onClick={() => setOpen(false)}
              className="text-secondary focus-visible:ring-secondary text-body-md hover:bg-white/8 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              Ver todas
              <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
