import {
  ArrowRightIcon,
  BellIcon,
  ShieldAlertIcon,
  SparklesIcon,
  WarningIcon,
} from '@/components/icons';
import type { NotificationSeverity, NotificationSource } from '@/management/types';
import { GlassSelect, SpectrumButton, StatusChip, cn } from '@/management/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { HeroBand, HeroPill } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
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

  const criticas = notifications.filter((item) => item.severity === 'CRITICO').length;
  const atencao = notifications.filter((item) => item.severity === 'ATENCAO').length;
  const comAcao = notifications.filter((item) => item.actionTo).length;

  const stats: HeroStat[] = [
    {
      key: 'nao-lidas',
      label: 'Não lidas',
      value: unread,
      outOf: notifications.length,
      hint: unread === 0 ? 'tudo lido' : 'ainda esperando alguém',
      icon: BellIcon,
      tone: unread > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'criticas',
      label: 'Críticas',
      value: criticas,
      hint: 'travam ou expõem a operação',
      icon: ShieldAlertIcon,
      tone: criticas > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'atencao',
      label: 'Atenção',
      value: atencao,
      hint: 'ainda dá para resolver antes',
      icon: WarningIcon,
      tone: atencao > 0 ? 'warn' : 'neutral',
    },
    {
      /* ⚠️ RN-091: o aviso que leva a algum lugar é o que dá para tratar sem
         sair da tela. O número diz quanto da fila é acionável agora. */
      key: 'com-acao',
      label: 'Com atalho',
      value: comAcao,
      hint: 'levam direto para a tela do caso',
      icon: SparklesIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Notificações"
        description="Tudo que os módulos precisaram avisar, num lugar só: segurança, manutenção, checklist, viagens, custos e telemetria."
      >
        <HeroPill icon={BellIcon}>{unread > 0 ? `${unread} não lidas` : 'tudo lido'}</HeroPill>
      </HeroBand>

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo dos avisos</h2>

        <QueryState isPending={isPending} isError={isError} label="as notificações">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela jogaria o carregando e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
        </QueryState>
      </section>

      {/*
       * ⚠️ Painel branco, como nas demais rotas (08/09/2026). A tela era um
       * `LightCard` solto no papel, e dentro dele cada aviso vinha num bloco
       * `surface-lowest` escrito em `on-surface`: a família do GRAFITE dentro de
       * um cartão claro. Agora a lista mora no painel e usa `on-light`, que é
       * para o que ela foi desenhada.
       */}
      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="as notificações">
          <>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
                Central de notificações
              </h2>

              {unread > 0 ? (
                <SpectrumButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={marcarLidas.isPending}
                  onClick={() =>
                    marcarLidas.mutate(
                      notifications.filter((item) => !item.read).map((item) => item.id),
                    )
                  }
                >
                  {marcarLidas.isPending ? 'Marcando…' : 'Marcar tudo como lido'}
                </SpectrumButton>
              ) : null}
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              {/*
               * ⚠️ Segmentado no desenho do `PageTabs`, na família `light`, que é
               * o mesmo objeto do seletor de período das viagens (referência
               * trazida pelo usuário em 08/09/2026): um poço em pílula e, dentro
               * dele, a pastilha CLARA que sobe quando escolhida.
               *
               * As pastilhas soltas e preenchidas de laranja que estavam aqui
               * diziam com a cor da navegação "que recorte desta tela você
               * olha", que é outra pergunta, e ainda flutuavam sobre o painel
               * sem poço que as agrupasse.
               */}
              <div
                role="group"
                aria-label="Filtrar por severidade"
                className="bg-light-container rounded-pill flex w-fit max-w-full gap-1 overflow-x-auto p-1.5"
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
                        /* `group` para a contagem enxergar o estado do botão. */
                        'group text-body-md rounded-pill focus-visible:ring-primary shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
                        active
                          ? 'bg-light text-accent font-medium shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)]'
                          : 'text-on-light-variant hover:bg-on-light/[0.06] hover:text-on-light',
                      )}
                    >
                      {option.label}
                      {/* Na aba escolhida a contagem vira dado, e não sombra do
                          rótulo: opacidade cheia em vez de meia. */}
                      <span className={cn('tabular ml-2 opacity-70', active && 'opacity-100')}>
                        {counts[option.id]}
                      </span>
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
                        'bg-light-container rounded-lg p-4',
                        /* Não lida ganha um filete da marca. É reforço, não o
                           único sinal: a palavra "não lida" vem junto. */
                        !item.read && 'border-primary-on-light border-l-2',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-on-light flex items-center gap-2 font-medium">
                            <SeverityIcon size={16} aria-hidden="true" className={severity.color} />
                            {item.title}
                            {/* A palavra, e não a cor: o filete à esquerda é
                                reforço, e sozinho ele não se lê em 12px. */}
                            {!item.read ? (
                              <span className="text-on-light-variant text-label-sm normal-case">
                                não lida
                              </span>
                            ) : null}
                          </p>
                          <p className="text-on-light-variant text-body-md mt-1">
                            {item.description}
                          </p>
                        </div>

                        {/* ⚠️ `surface="light"` porque a lista mora no painel
                            claro. Sem isso o chip usa o par semântico do
                            grafite: "Informativo" media 3,32:1 sobre o claro,
                            abaixo dos 4,5:1 de AA (medido em 27/08/2026,
                            relatado pelo usuário). */}
                        <StatusChip tone={severity.tone} surface="light">
                          {severity.label}
                        </StatusChip>
                      </div>

                      <div className="border-light-outline mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <span className="text-on-light-muted text-label-md flex items-center gap-1.5 normal-case">
                          <SourceIcon size={14} aria-hidden="true" />
                          {source.label}
                        </span>
                        <span
                          className="text-on-light-muted text-label-md normal-case"
                          title={absoluteTime.format(new Date(item.at))}
                        >
                          {relativeTime(item.at)}
                        </span>

                        {/* RN-091: a ação vem embutida no aviso, não num menu. */}
                        {item.actionTo ? (
                          <Link
                            to={item.actionTo}
                            className="text-accent text-label-md focus-visible:ring-primary ml-auto inline-flex items-center gap-1.5 rounded-md px-1 py-1 normal-case hover:underline focus-visible:outline-none focus-visible:ring-2"
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
          </>
        </QueryState>
      </PageContent>
    </>
  );
}
