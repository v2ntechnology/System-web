import { ArrowRightIcon } from '@/components/icons';
import type { NotificationSeverity, NotificationSource } from '@/management/types';
import { GlassSelect, LightCard, StatusChip, cn } from '@/management/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getNotifications, markNotificationsRead } from '../api';
import { SEVERITY, SOURCE, absoluteTime, relativeTime } from '../notification-meta';

const FILTERS: { id: NotificationSeverity | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'CRITICO', label: 'Críticas' },
  { id: 'ATENCAO', label: 'Atenção' },
  { id: 'INFO', label: 'Informativas' },
];

const TODAS_ORIGENS = 'TODAS';

export function NotificationsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<NotificationSeverity | 'TODAS'>('TODAS');
  const [source, setSource] = useState<NotificationSource | typeof TODAS_ORIGENS>(TODAS_ORIGENS);

  const notifications = useMemo(() => data ?? [], [data]);

  /**
   * As origens do seletor saem da lista, e não da tabela de origens.
   *
   * Oferecer "Custos" e "Checklist" num painel onde esses módulos ainda não
   * geram aviso nenhum seria oferecer dois caminhos que só devolvem lista
   * vazia. O seletor some por inteiro quando tudo vem da mesma origem.
   */
  const origens = useMemo(
    () => [...new Set(notifications.map((item) => item.source))],
    [notifications],
  );

  const visible = useMemo(
    () =>
      notifications.filter(
        (item) =>
          (filter === 'TODAS' || item.severity === filter) &&
          (source === TODAS_ORIGENS || item.source === source),
      ),
    [notifications, filter, source],
  );

  const unread = notifications.filter((item) => !item.read).length;

  /**
   * Marcar como lido invalida a lista.
   *
   * O alerta não é gravado no banco: ele é recalculado do estado atual a cada
   * consulta. Só a leitura persiste, então recarregar é a forma correta de
   * refletir a marcação, e não mexer na lista em memória.
   */
  const marcarLidas = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  /**
   * A contagem das pastilhas respeita a origem escolhida.
   *
   * ⚠️ Contar sempre o total faria a pastilha mentir: com "Telemetria"
   * selecionada, "Críticas 9" ao lado de uma lista de três linhas leva o
   * gestor a achar que a tela escondeu seis avisos.
   */
  const counts = useMemo(() => {
    const base =
      source === TODAS_ORIGENS
        ? notifications
        : notifications.filter((item) => item.source === source);

    return Object.fromEntries(
      FILTERS.map((option) => [
        option.id,
        option.id === 'TODAS'
          ? base.length
          : base.filter((item) => item.severity === option.id).length,
      ]),
    ) as Record<NotificationSeverity | 'TODAS', number>;
  }, [notifications, source]);

  return (
    <>
      <PageBanner
        size="inline"
        title="Notificações"
        description="Tudo que os módulos precisaram avisar, num lugar só: segurança, manutenção, checklist, viagens, custos e telemetria."
      />

      <PageContent className="mt-0 sm:mt-0">
        <QueryState isPending={isPending} isError={isError} label="as notificações">
          <LightCard
            title="Central de notificações"
            action={
              /* ⚠️ O cabeçalho do `LightCard` é `flex` sem quebra, então tudo
                 aqui precisa caber numa linha: em 390px a contagem e o rótulo
                 longo quebravam em três linhas cada e espremiam o título. A
                 contagem sai no estreito porque a pastilha do sino já a mostra,
                 e o rótulo encurta. */
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-on-light-muted text-label-md tabular hidden normal-case sm:inline">
                  {unread > 0 ? `${unread} não lidas` : 'tudo lido'}
                </span>
                {unread > 0 ? (
                  <button
                    type="button"
                    disabled={marcarLidas.isPending}
                    onClick={() =>
                      marcarLidas.mutate(
                        notifications.filter((item) => !item.read).map((item) => item.id),
                      )
                    }
                    className="text-label-md focus-visible:ring-secondary rounded-full bg-on-light/8 whitespace-nowrap px-3 py-1 normal-case text-on-light-variant transition-colors hover:text-on-light focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                  >
                    {marcarLidas.isPending ? (
                      'marcando…'
                    ) : (
                      <>
                        <span className="sm:hidden">Marcar tudo</span>
                        <span className="hidden sm:inline">Marcar tudo como lido</span>
                      </>
                    )}
                  </button>
                ) : null}
              </span>
            }
          >
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <div
                role="group"
                aria-label="Filtrar por severidade"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
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

              {/* Some quando tudo vem da mesma origem: um seletor de uma opção
                  só é chrome que não decide nada. */}
              {origens.length > 1 ? (
                <div className="ml-auto w-full sm:w-52">
                  <GlassSelect
                    label="Origem"
                    hideLabel
                    surface="light"
                    variant="outline"
                    pill
                    value={source}
                    onValueChange={(valor) =>
                      setSource(valor as NotificationSource | typeof TODAS_ORIGENS)
                    }
                    options={[
                      { value: TODAS_ORIGENS, label: 'Todas as origens' },
                      ...origens.map((origem) => ({
                        value: origem,
                        label: SOURCE[origem].label,
                      })),
                    ]}
                  />
                </div>
              ) : null}
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
                        /* Não lida ganha um filete indigo. É reforço, não o único sinal. */
                        !item.read && 'border-primary border-l-2',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-on-surface flex items-center gap-2 font-medium">
                            <SeverityIcon size={16} aria-hidden="true" className={severity.color} />
                            {item.title}
                            {/* `primary` a 12px sobre #171717 dá 4,01:1 e reprova AA:
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

                        {/* ⚠️ `surface="light"` porque a lista mora dentro de
                            um `LightCard`. Sem isso o chip usa o par semântico
                            do grafite: "Informativo" media 3,32:1 sobre o painel
                            claro, abaixo dos 4,5:1 de AA (medido em 27/08/2026,
                            relatado pelo usuário). */}
                        <StatusChip tone={severity.tone} surface="light">
                          {severity.label}
                        </StatusChip>
                      </div>

                      <div className="border-outline-variant mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <span className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
                          <SourceIcon size={14} aria-hidden="true" />
                          {source.label}
                        </span>
                        <span
                          className="text-on-surface-muted text-label-md normal-case"
                          title={absoluteTime.format(new Date(item.at))}
                        >
                          {relativeTime(item.at)}
                        </span>

                        {/* RN-091: a ação vem embutida no aviso, não num menu. */}
                        {item.actionTo ? (
                          <Link
                            to={item.actionTo}
                            className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-on-surface/5 px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2"
                          >
                            {item.actionLabel ?? 'Abrir'}
                            <ArrowRightIcon size={14} aria-hidden="true" />
                            <span className="sr-only">: {item.title}</span>
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
