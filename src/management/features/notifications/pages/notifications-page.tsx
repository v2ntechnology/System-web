import { ArrowRightIcon } from '@phosphor-icons/react';
import type { NotificationSeverity } from '@/management/types';
import { LightCard, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getNotifications } from '../api';
import { SEVERITY, SOURCE, absoluteTime, relativeTime } from '../notification-meta';

const FILTERS: { id: NotificationSeverity | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'CRITICO', label: 'Críticas' },
  { id: 'ATENCAO', label: 'Atenção' },
  { id: 'INFO', label: 'Informativas' },
];

export function NotificationsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const [filter, setFilter] = useState<NotificationSeverity | 'TODAS'>('TODAS');

  const notifications = useMemo(() => data ?? [], [data]);
  const visible = useMemo(
    () =>
      filter === 'TODAS' ? notifications : notifications.filter((item) => item.severity === filter),
    [notifications, filter],
  );

  const unread = notifications.filter((item) => !item.read).length;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [
          option.id,
          option.id === 'TODAS'
            ? notifications.length
            : notifications.filter((item) => item.severity === option.id).length,
        ]),
      ) as Record<NotificationSeverity | 'TODAS', number>,
    [notifications],
  );

  return (
    <>
      <PageBanner
        size="inline"
        title="Notificações"
        description="Tudo que os módulos precisaram avisar, num lugar só — segurança, manutenção, checklist, viagens, custos e integrações."
      />

      <PageContent className="mt-0 sm:mt-0">
        <QueryState isPending={isPending} isError={isError} label="as notificações">
          <LightCard
            title="Central de notificações"
            action={
              <span className="text-on-light-muted text-label-md tabular normal-case">
                {unread > 0 ? `${unread} não lidas` : 'tudo lido'}
              </span>
            }
          >
            <div
              role="group"
              aria-label="Filtrar por severidade"
              className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1"
            >
              {FILTERS.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      'rounded-pill text-label-md focus-visible:ring-primary-on-light shrink-0 px-3.5 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                      active
                        ? 'bg-primary-strong text-on-primary'
                        : 'text-on-light-variant hover:bg-light-container border-light-outline border',
                    )}
                  >
                    {option.label}
                    <span className="tabular ml-1.5 opacity-70">{counts[option.id]}</span>
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <p className="text-on-light-variant text-body-md py-10 text-center">
                Nenhuma notificação nesse filtro.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((item) => {
                  const severity = SEVERITY[item.severity];
                  const SeverityIcon = severity.icon;
                  const source = SOURCE[item.source];
                  const SourceIcon = source.icon;

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'bg-surface-lowest rounded-lg p-4',
                        /* Não lida ganha um filete indigo — reforço, não único sinal. */
                        !item.read && 'border-primary border-l-2',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-on-surface flex items-center gap-2 font-medium">
                            <SeverityIcon
                              size={16}
                              weight="fill"
                              aria-hidden="true"
                              className={severity.color}
                            />
                            {item.title}
                            {/* `primary` a 12px sobre #171717 dá 4,01:1 e reprova AA —
                                o filete indigo à esquerda do card já marca o estado. */}
                            {!item.read ? (
                              <span className="text-on-surface-variant text-label-sm normal-case">
                                não lida
                              </span>
                            ) : null}
                          </p>
                          <p className="text-on-surface-variant text-body-md mt-1">
                            {item.description}
                          </p>
                        </div>

                        <StatusChip tone={severity.tone}>{severity.label}</StatusChip>
                      </div>

                      <div className="border-outline-variant mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <span className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
                          <SourceIcon size={14} weight="duotone" aria-hidden="true" />
                          {source.label}
                        </span>
                        <span
                          className="text-on-surface-muted text-label-md normal-case"
                          title={absoluteTime.format(new Date(item.at))}
                        >
                          {relativeTime(item.at)}
                        </span>

                        {/* RN-091 — a ação vem embutida no aviso, não num menu. */}
                        {item.actionTo ? (
                          <Link
                            to={item.actionTo}
                            className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-white/5 px-3 py-1.5 normal-case transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                          >
                            {item.actionLabel ?? 'Abrir'}
                            <ArrowRightIcon size={14} aria-hidden="true" />
                            <span className="sr-only">— {item.title}</span>
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </LightCard>
        </QueryState>
      </PageContent>
    </>
  );
}
