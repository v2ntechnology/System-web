import {
  ApprovalIcon,
  BadgeCheckIcon,
  BlockedIcon,
  ClockIcon,
  InboxIcon,
  MoneyIcon,
  WarningIcon,
} from '@/components/icons';
import type { OwnerApproval, WarningSeverity } from '@/management/types';
import { Alert, SpectrumButton, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getOwnerApprovals } from '../api';
import { ApprovalDetailPanel } from '../components/approval-detail-panel';
import { KIND_META, SEVERITY_LABEL, SEVERITY_RAIL, STATUS_META } from '../components/approval-meta';
import { brlWhole, dateTime } from '@/management/lib/format';

const TABS = [
  { id: 'PENDENTES', label: 'Aguardando você' },
  { id: 'DECIDIDAS', label: 'Já decididas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const SEVERITY_ORDER: Record<WarningSeverity, number> = { GRAVE: 0, MEDIA: 1, LEVE: 2 };

/**
 * Ordem da fila do dono: primeiro o que bloqueia caminhão, depois o que espera
 * há mais tempo.
 *
 * ⚠️ Não é a ordem de chegada. Um parecer leve pedido hoje não pode ficar na
 * frente de uma liberação grave pedida ontem, porque só uma delas tem um ativo
 * parado no pátio.
 */
function bySeverityThenAge(a: OwnerApproval, b: OwnerApproval) {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    Date.parse(a.requestedAt) - Date.parse(b.requestedAt)
  );
}

/** Há quanto tempo o pedido espera, em texto curto. */
function waitingSince(requestedAt: number, now: number): string {
  const hours = Math.max(0, Math.round((now - requestedAt) / 3_600_000));
  if (hours < 24) return hours === 1 ? '1 hora' : `${hours} horas`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
}

/**
 * Central de pareceres e aprovações do proprietário.
 *
 * É a ponta final do fluxo de risco: ocorrência leve o gestor libera, média
 * exige plano de ação dele, e **grave bloqueia o veículo até o dono aprovar
 * formalmente**. Enquanto o parecer espera aqui, o caminhão está parado, e por
 * isso a fila também aparece no cabeçalho da visão geral.
 *
 * <h2>A tela abre alertando</h2>
 *
 * Reorganizada em 05/09/2026 a pedido do usuário. O resumo da fila era um card
 * neutro que se lia como legenda, e o dono não tem por que descobrir sozinho
 * que um caminhão está parado esperando por ele. Agora a tela abre com três
 * coisas nessa ordem: os números da fila, um alerta que muda de cor conforme o
 * que está em jogo, e a fila já ordenada com o caso mais grave aberto ao lado.
 */
export function OwnerApprovalsPage() {
  const [tab, setTab] = useState<TabId>('PENDENTES');

  const { data, isPending, isError } = useQuery({
    queryKey: ['owner', 'approvals'],
    queryFn: getOwnerApprovals,
  });

  const all = useMemo(() => data ?? [], [data]);

  const visible = useMemo(
    () =>
      tab === 'PENDENTES'
        ? all.filter((item) => item.status === 'PENDENTE').sort(bySeverityThenAge)
        : all
            .filter((item) => item.status !== 'PENDENTE')
            .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)),
    [all, tab],
  );

  const approvalId = useCallback((item: OwnerApproval) => item.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, approvalId);

  const counts = useMemo(
    () => ({
      PENDENTES: all.filter((item) => item.status === 'PENDENTE').length,
      DECIDIDAS: all.filter((item) => item.status !== 'PENDENTE').length,
    }),
    [all],
  );

  const pending = useMemo(
    () => all.filter((item) => item.status === 'PENDENTE').sort(bySeverityThenAge),
    [all],
  );

  /*
   * "Agora" fixado na abertura da tela: `Date.now()` no corpo do componente é
   * chamada impura durante o render (erro de lint aqui), e a espera da fila é
   * medida em dias. Não muda de resposta enquanto a tela está aberta.
   */
  const [now] = useState(() => Date.now());

  const graves = pending.filter((item) => item.severity === 'GRAVE').length;
  const impact = pending.reduce((sum, item) => sum + (item.financialImpact ?? 0), 0);
  /* A fila vem ordenada por severidade, então o mais antigo sai do próprio dado. */
  const oldestWait = pending.reduce(
    (older, item) => Math.min(older, Date.parse(item.requestedAt)),
    now,
  );
  const urgent = pending[0] ?? null;

  /** Leva o dono ao caso que trava um caminhão, venha ele de onde vier na tela. */
  const openUrgent = () => {
    if (!urgent) return;
    setTab('PENDENTES');
    setSelectedId(urgent.id);
  };

  const stats: HeroStat[] = [
    {
      key: 'fila',
      label: 'Aguardando você',
      value: counts.PENDENTES,
      hint: 'decisões na sua alçada',
      icon: InboxIcon,
      tone: counts.PENDENTES > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'graves',
      label: 'Veículo bloqueado',
      value: graves,
      hint: 'não sai do pátio sem a sua aprovação',
      icon: BlockedIcon,
      tone: graves > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'espera',
      label: 'Espera mais longa',
      value: counts.PENDENTES === 0 ? '–' : waitingSince(oldestWait, now),
      hint: 'desde o pedido mais antigo da fila',
      icon: ClockIcon,
      tone: counts.PENDENTES > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'impacto',
      label: 'Impacto em jogo',
      value: brlWhole.format(impact),
      hint: 'somado nos pedidos que esperam',
      icon: MoneyIcon,
    },
    {
      key: 'decididas',
      label: 'Já decididas',
      value: counts.DECIDIDAS,
      hint: 'no log de auditoria com o seu nome',
      icon: BadgeCheckIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Aprovações"
        description="Pareceres do gestor e liberações que exigem a sua decisão formal, com as evidências e o plano de ação anexados."
      />

      <section className="-mt-16 px-4 pb-8 sm:-mt-20 sm:px-6 xl:px-10">
        <h2 className="sr-only">Situação da fila</h2>

        <HeroStats items={stats} />

        {/*
         * O alerta é a primeira frase da tela depois dos números, e muda de cor
         * conforme o que está em jogo: vermelho quando há caminhão bloqueado,
         * âmbar quando só há espera, verde quando não há nada pendente. Fica
         * fora do painel claro de propósito, porque é sobre a fila inteira e não
         * sobre a aba aberta.
         */}
        {counts.PENDENTES === 0 ? (
          <Alert severity="success" className="mt-5 flex items-start gap-3">
            <BadgeCheckIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Nenhuma decisão pendente. Toda decisão registrada aqui vai para o log de auditoria com
              o seu nome.
            </span>
          </Alert>
        ) : (
          <Alert
            severity={graves > 0 ? 'error' : 'warning'}
            className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3"
          >
            {graves > 0 ? (
              <WarningIcon size={22} className="shrink-0" aria-hidden="true" />
            ) : (
              <ApprovalIcon size={22} className="shrink-0" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1">
              <span className="text-body-lg block font-semibold">
                {graves === 0
                  ? counts.PENDENTES === 1
                    ? '1 decisão aguarda a sua análise.'
                    : `${counts.PENDENTES} decisões aguardam a sua análise.`
                  : graves === 1
                    ? '1 ocorrência grave mantém um caminhão bloqueado até você aprovar.'
                    : `${graves} ocorrências graves mantêm caminhões bloqueados até você aprovar.`}
              </span>

              <span className="text-body-md mt-1 block">
                {graves === 0
                  ? `Nenhuma bloqueia veículo agora. A mais antiga espera há ${waitingSince(oldestWait, now)}.`
                  : `São ${counts.PENDENTES} na fila, e a mais antiga espera há ${waitingSince(oldestWait, now)}.`}
              </span>
            </span>

            <SpectrumButton size="sm" onClick={openUrgent}>
              {graves > 0 ? 'Abrir a mais grave' : 'Abrir a primeira'}
            </SpectrumButton>
          </Alert>
        )}
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((entry) => ({ ...entry, count: counts[entry.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das aprovações"
        >
          <QueryState isPending={isPending} isError={isError} label="as aprovações">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,360px)_1fr]">
              <div className="min-w-0">
                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    {tab === 'PENDENTES'
                      ? 'Nada aguardando a sua decisão.'
                      : 'Nenhuma decisão registrada ainda.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((item) => {
                      const active = item.id === selectedId;
                      const kind = KIND_META[item.kind];
                      const status = STATUS_META[item.status];

                      return (
                        <li key={item.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light flex w-full gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            {/* A cor repete o rótulo de severidade, nunca o substitui. */}
                            <span
                              className={cn(
                                'w-1 shrink-0 self-stretch rounded-full',
                                SEVERITY_RAIL[item.severity],
                              )}
                              aria-hidden="true"
                            />

                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-2">
                                <kind.icon
                                  size={18}
                                  aria-hidden="true"
                                  className={cn(
                                    'mt-0.5 shrink-0',
                                    active ? 'text-on-primary' : 'text-primary-on-light',
                                  )}
                                />
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 font-semibold',
                                    active ? 'text-on-primary' : 'text-on-light',
                                  )}
                                >
                                  {item.title}
                                </span>
                              </span>

                              <span
                                className={cn(
                                  'text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-muted',
                                )}
                              >
                                {SEVERITY_LABEL[item.severity]} · {kind.label} · {item.requestedBy}
                              </span>

                              {/*
                               * Na fila, o que importa é há quanto tempo o
                               * caminhão espera; na aba das decididas, quando
                               * ficou decidido e como. Data de pedido em fila
                               * obriga o dono a fazer a subtração de cabeça.
                               */}
                              <span
                                className={cn(
                                  'text-label-md mt-1 block normal-case',
                                  active ? 'text-on-primary' : 'text-on-light-variant',
                                )}
                              >
                                {item.status === 'PENDENTE'
                                  ? `esperando há ${waitingSince(Date.parse(item.requestedAt), now)}`
                                  : `${status.label} em ${dateTime.format(new Date(item.decision?.at ?? item.requestedAt))}`}
                              </span>

                              {item.financialImpact !== undefined ? (
                                <span
                                  className={cn(
                                    'tabular text-label-md mt-1 block normal-case',
                                    active ? 'text-on-primary' : 'text-on-light-variant',
                                  )}
                                >
                                  {brlWhole.format(item.financialImpact)} de impacto
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <ApprovalDetailPanel approval={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione um parecer para ver as evidências e decidir.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
