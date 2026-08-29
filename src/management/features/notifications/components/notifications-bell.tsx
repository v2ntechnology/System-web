import { ArrowRightIcon, BellIcon } from '@/components/icons';
import * as Popover from '@radix-ui/react-popover';
import { POPOVER_LAYER, PORTAL_FOCUS_RING, Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { getNotifications } from '../api';
import { SEVERITY, SOURCE, absoluteTime, relativeTime } from '../notification-meta';

/**
 * Sino da topbar: as últimas notificações sem sair da tela (RF-038).
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
          aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : 'Notificações'}
          /* Sem pastilha roxa (decisão do usuário em 20/08/2026): o sino é só o
             símbolo e a contagem, como no painel operacional. Como aqui ele fica
             sobre a fotografia do banner, a cor é `on-media` e o véu do hover é
             branco fixo, igual ao botão de menu ao lado. */
          className="text-on-media rounded-pill focus-visible:ring-secondary focus-visible:ring-offset-background relative flex size-10 items-center justify-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <BellIcon size={22} />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="bg-error text-on-error rounded-pill tabular absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[9px] font-bold leading-none"
            >
              {unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        {/*
         * ⚠️ Tudo aqui dentro é portalizado para o `body` e sai de
         * `.management-theme`. Lá fora, `secondary` volta a ser o cinza de
         * controle do painel operacional: era por isso que "Ver todas" parecia
         * um botão desabilitado (relatado em 27/08/2026). Só tokens da paleta
         * comum e `primary-strong`, que é global.
         */}
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            'bg-surface-low ring-outline-variant w-[calc(100vw-2rem)] max-w-[26rem] rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1',
            POPOVER_LAYER,
          )}
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
                      className={cn(
                        'hover:bg-on-surface/12 block rounded-md px-3 py-2.5 transition-colors',
                        PORTAL_FOCUS_RING,
                      )}
                    >
                      <span className="flex items-start gap-2.5">
                        <SeverityIcon
                          size={16}
                          aria-label={severity.label}
                          className={cn('mt-0.5 shrink-0', severity.color)}
                        />
                        <span className="min-w-0 flex-1">
                          {/*
                           * Duas linhas, e não uma cortada.
                           *
                           * ⚠️ Com `truncate`, "RAFAEL LOPES BASTOS passou do
                           * li..." não diz do que se trata: o sujeito come a
                           * largura toda e o fato some. Em 26rem, duas linhas
                           * cabem o aviso inteiro na maioria dos casos.
                           */}
                          <span
                            className={cn(
                              'line-clamp-2 block',
                              item.read ? 'text-on-surface-variant' : 'text-on-surface font-medium',
                            )}
                          >
                            {item.title}
                          </span>

                          {/* O que fazer a respeito mora na descrição, e o sino
                              mostrava só o título. Uma linha já entrega o
                              essencial sem transformar a caixa em lista longa. */}
                          <span className="text-on-surface-variant text-label-md mt-1 line-clamp-2 block normal-case">
                            {item.description}
                          </span>

                          <span className="text-on-surface-muted text-label-md mt-1 block normal-case">
                            {source.label} ·{' '}
                            <span title={absoluteTime.format(new Date(item.at))}>
                              {relativeTime(item.at)}
                            </span>
                          </span>
                        </span>
                        {!item.read ? (
                          <span
                            aria-label="não lida"
                            role="img"
                            className="bg-primary-strong rounded-pill mt-1.5 size-2 shrink-0"
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
            {/*
             * Ação preenchida, e não texto colorido.
             *
             * ⚠️ Duas armadilhas de contraste, nesta ordem. Era
             * `text-secondary`, que fora de `.management-theme` vira o cinza de
             * controle do painel operacional: o link lia como desabilitado.
             * Trocar por `text-primary-strong` resolveu no claro e continuou
             * ruim no escuro, porque #5457ee como TEXTO sobre superfície escura
             * fica abaixo de 4,5:1 — esse token foi medido para levar branco em
             * cima dele, não para ser a tinta.
             *
             * Branco sobre `primary-strong` dá 5,3:1 nos dois temas, e de
             * quebra a única ação da caixa passa a parecer uma ação.
             */}
            <Link
              to="/gestao/notificacoes"
              onClick={() => setOpen(false)}
              className={cn(
                'bg-primary-strong text-on-primary text-body-md flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
                PORTAL_FOCUS_RING,
              )}
            >
              Ver todas as notificações
              <ArrowRightIcon size={14} aria-hidden="true" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
