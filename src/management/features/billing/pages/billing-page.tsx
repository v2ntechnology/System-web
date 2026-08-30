import {
  BillingIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  WarningIcon,
} from '@/components/icons';
import type { Invoice, InvoiceStatus, PlanQuota, Subscription } from '@/management/types';
import {
  DataTable,
  GlassCard,
  LightCard,
  SpectrumButton,
  StatusChip,
  cn,
  type Column,
  type StatusTone,
} from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';
import { brl, brlWhole, dateOnly, percent } from '@/management/lib/format';

import { getSubscription } from '../api';

const TABS = [
  { id: 'PLANO', label: 'Plano' },
  { id: 'FATURAS', label: 'Faturas' },
  { id: 'PAGAMENTO', label: 'Pagamento' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const INVOICE_META: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  PAGA: { label: 'Paga', tone: 'positive' },
  ABERTA: { label: 'Em aberto', tone: 'info' },
  VENCIDA: { label: 'Vencida', tone: 'critical' },
  /* "Falhou" não vira "vencida": a cobrança foi tentada e recusada, e a
     tratativa é outra — atualizar o cartão, não pagar um boleto atrasado. */
  FALHOU: { label: 'Falhou', tone: 'attention' },
};

const CYCLE_LABEL = { MENSAL: 'Mensal', ANUAL: 'Anual' } as const;

const STATUS_META: Record<Subscription['status'], { label: string; tone: StatusTone }> = {
  ATIVA: { label: 'Ativa', tone: 'positive' },
  INADIMPLENTE: { label: 'Inadimplente', tone: 'critical' },
  CANCELADA: { label: 'Cancelada', tone: 'neutral' },
};

/** Barra de consumo de uma cota. Ilimitado não tem barra — não há o que medir. */
function QuotaRow({ quota }: { quota: PlanQuota }) {
  const unlimited = quota.limit < 0;
  const ratio = unlimited ? 0 : Math.min(quota.used / quota.limit, 1);
  /* Acima de 85% o dono precisa decidir antes de a fatura chegar. */
  const tight = !unlimited && ratio >= 0.85;

  return (
    <li className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-on-light min-w-0 font-medium">{quota.label}</p>
        <p className="tabular text-on-light text-body-md">
          {quota.used.toLocaleString('pt-BR')}
          <span className="text-on-light-muted">
            {unlimited
              ? ' · sem limite'
              : ` de ${quota.limit.toLocaleString('pt-BR')}${quota.unit ? ` ${quota.unit}` : ''}`}
          </span>
        </p>
      </div>

      {unlimited ? null : (
        <div className="mt-2 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-light-container rounded-pill h-2.5 min-w-0 flex-1 overflow-hidden"
          >
            <span
              className={cn(
                'rounded-pill block h-full',
                tight ? 'bg-warning-on-light' : 'bg-chart-1',
              )}
              style={{ width: `${Math.max(ratio * 100, 2)}%` }}
            />
          </span>
          <span
            className={cn(
              'tabular text-label-md w-12 shrink-0 text-right normal-case',
              tight ? 'text-warning-on-light font-semibold' : 'text-on-light-variant',
            )}
          >
            {percent(ratio * 100, 0)}
          </span>
        </div>
      )}

      {quota.overageNote ? (
        <p className="text-on-light-muted text-label-md mt-1.5 normal-case">{quota.overageNote}</p>
      ) : null}
    </li>
  );
}

/**
 * Plano e cobrança do tenant (RF-002).
 *
 * Exclusiva do proprietário: é a única pessoa que assina o contrato e recebe a
 * fatura. Gestor e operador não veem — nem por URL (ver a guarda na rota).
 *
 * A tela responde três perguntas, uma por aba: quanto estou pagando e por quê
 * (Plano), o que já foi cobrado (Faturas) e por onde sai o dinheiro (Pagamento).
 */
export function BillingPage() {
  const [tab, setTab] = useState<TabId>('PLANO');
  const session = useSession();

  const { data, isPending, isError } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: getSubscription,
  });

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: 'period',
      header: 'Competência',
      sortValue: (row) => row.issuedAt,
      cell: (row) => <span className="tabular font-semibold">{row.periodLabel}</span>,
    },
    {
      key: 'number',
      header: 'Nº',
      hideOnMobile: true,
      sortValue: (row) => row.number,
      cell: (row) => <span className="tabular">{row.number}</span>,
    },
    {
      key: 'due',
      header: 'Vencimento',
      hideOnMobile: true,
      sortValue: (row) => row.dueAt,
      cell: (row) => dateOnly.format(new Date(row.dueAt)),
    },
    {
      key: 'paid',
      header: 'Pagamento',
      hideOnMobile: true,
      sortValue: (row) => row.paidAt ?? '',
      cell: (row) => (row.paidAt ? dateOnly.format(new Date(row.paidAt)) : '—'),
    },
    {
      key: 'status',
      header: 'Situação',
      sortValue: (row) => row.status,
      cell: (row) => (
        <StatusChip tone={INVOICE_META[row.status].tone} surface="light">
          {INVOICE_META[row.status].label}
        </StatusChip>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      sortValue: (row) => row.amount,
      cell: (row) => <span className="font-semibold">{brl.format(row.amount)}</span>,
    },
    {
      key: 'download',
      header: '',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() =>
            toast.success(`Baixando a fatura ${row.number}`, {
              description: 'O arquivo abre em outra aba quando estiver pronto.',
            })
          }
          aria-label={`Baixar a fatura ${row.number}`}
          className="acao-neutra focus-visible:ring-primary-on-light inline-flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
        >
          <DownloadIcon size={16} />
        </button>
      ),
    },
  ];

  const failed = data?.invoices.filter((invoice) => invoice.status === 'FALHOU') ?? [];
  const open = data?.invoices.find((invoice) => invoice.status === 'ABERTA');

  return (
    <>
      <PageBanner
        size="inline"
        title="Plano e cobrança"
        description="O que você assina, o que já foi cobrado e por onde sai o pagamento."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo da assinatura</h2>

        <QueryState isPending={isPending} isError={isError} label="a assinatura">
          {data ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
              <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-on-surface-variant text-body-md">Plano atual</h3>
                  <StatusChip tone={STATUS_META[data.status].tone}>
                    {STATUS_META[data.status].label}
                  </StatusChip>
                </div>

                <p className="font-sora text-on-surface mt-2 text-[32px] font-bold leading-none">
                  {data.planName}
                </p>

                <p className="tabular text-on-surface-variant text-body-md mt-3">
                  {brlWhole.format(data.amount)}
                  <span className="text-on-surface-muted">
                    {' '}
                    / {CYCLE_LABEL[data.cycle].toLowerCase()}
                  </span>
                </p>

                <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                  <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {session?.tenant.name} · assinante desde{' '}
                  {dateOnly.format(new Date(data.startedAt))}
                </p>
              </GlassCard>

              <GlassCard className="grid min-w-0 gap-4 p-5 sm:grid-cols-3 sm:p-6">
                <div className="metric-tile">
                  <p className="text-on-surface-variant text-label-md normal-case">
                    Próxima cobrança
                  </p>
                  <p className="tabular font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
                    {dateOnly.format(new Date(data.nextChargeAt))}
                  </p>
                  <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">
                    {data.cancelAtPeriodEnd ? 'não renova após o ciclo' : 'renovação automática'}
                  </p>
                </div>

                <div className="metric-tile">
                  <p className="text-on-surface-variant text-label-md normal-case">Ciclo</p>
                  <p className="font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
                    {CYCLE_LABEL[data.cycle]}
                  </p>
                  <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">
                    {data.pricePerVehicle
                      ? `${brl.format(data.pricePerVehicle)} por veículo ativo`
                      : 'valor fixo por ciclo'}
                  </p>
                </div>

                <div className="metric-tile">
                  <p className="text-on-surface-variant text-label-md normal-case">
                    Forma de pagamento
                  </p>
                  <p className="tabular font-sora text-on-surface mt-2 text-[24px] font-bold leading-none">
                    ···· {data.paymentMethod.last4}
                  </p>
                  <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">
                    {data.paymentMethod.brand} · vence em {data.paymentMethod.expiresAt}
                  </p>
                </div>

                {open ? (
                  <div className="border-outline-variant flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 sm:col-span-3">
                    <p className="text-on-surface text-body-md min-w-0 flex-1">
                      Fatura de {open.periodLabel} em aberto —{' '}
                      <span className="tabular font-semibold">{brl.format(open.amount)}</span>,
                      vence em {dateOnly.format(new Date(open.dueAt))}.
                    </p>
                    <SpectrumButton
                      size="sm"
                      onClick={() =>
                        toast.success(`Abrindo a fatura ${open.number}`, {
                          description: 'Boleto e código Pix ficam disponíveis no documento.',
                        })
                      }
                    >
                      Ver fatura
                      <ExternalLinkIcon size={16} aria-hidden="true" />
                    </SpectrumButton>
                  </div>
                ) : null}
              </GlassCard>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Seções da cobrança">
          <QueryState isPending={isPending} isError={isError} label="a assinatura">
            {data ? (
              <div className="pb-4">
                {tab === 'PLANO' ? (
                  <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                    <LightCard
                      title="O que está incluído"
                      action={
                        <span className="text-on-light-muted text-label-md normal-case">
                          {CYCLE_LABEL[data.cycle]}
                        </span>
                      }
                    >
                      <p className="text-on-light-variant text-body-md">{data.planDescription}</p>

                      {/*
                       * Plano e extensões separados: um total único esconde o que
                       * o dono pode desligar. A linha das extensões leva para a
                       * tela onde ele desliga.
                       */}
                      <dl className="mt-5 flex flex-col gap-3">
                        <div className="bg-light-container flex items-baseline justify-between gap-3 rounded-md p-3">
                          <dt className="text-on-light-variant text-body-md">Plano</dt>
                          <dd className="tabular text-on-light font-semibold">
                            {brl.format(data.planAmount)}
                          </dd>
                        </div>

                        <div className="bg-light-container flex items-baseline justify-between gap-3 rounded-md p-3">
                          <dt className="text-body-md">
                            <Link
                              to="/gestao/extensoes"
                              className="text-primary-on-light underline-offset-4 hover:underline"
                            >
                              Extensões contratadas
                            </Link>
                          </dt>
                          <dd className="tabular text-on-light font-semibold">
                            {brl.format(data.extensionsAmount)}
                          </dd>
                        </div>

                        <div className="border-light-outline flex items-baseline justify-between gap-3 border-t pt-3">
                          <dt className="text-on-light font-semibold">Valor do ciclo</dt>
                          <dd className="tabular text-on-light font-semibold">
                            {brl.format(data.amount)}
                          </dd>
                        </div>

                        {data.pricePerVehicle ? (
                          <p className="text-on-light-muted text-label-md normal-case">
                            Plano cobrado a {brl.format(data.pricePerVehicle)} por veículo ativo.
                          </p>
                        ) : null}
                      </dl>

                      <div className="mt-auto flex flex-wrap gap-3 pt-6">
                        <SpectrumButton
                          onClick={() =>
                            toast.info('Mudança de plano', {
                              description:
                                'Nosso time comercial retorna em até um dia útil com as opções.',
                            })
                          }
                        >
                          Falar sobre mudança de plano
                        </SpectrumButton>
                      </div>

                      {/*
                       * Módulos ficam em Configurações e não aqui: o catálogo de
                       * contratação já vive lá (RF-002), e duas telas donas da
                       * mesma lista divergem na primeira mudança.
                       */}
                      <p className="text-on-light-muted text-label-md mt-4 normal-case">
                        Os módulos contratados aparecem em Configurações.
                      </p>
                    </LightCard>

                    <LightCard
                      title="Consumo do plano"
                      action={
                        <span className="text-on-light-muted text-label-md normal-case">
                          ciclo atual
                        </span>
                      }
                    >
                      <ul className="flex flex-col gap-5">
                        {data.quotas.map((quota) => (
                          <QuotaRow key={quota.id} quota={quota} />
                        ))}
                      </ul>

                      <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
                        Excedente entra na fatura do ciclo seguinte, nunca em cobrança avulsa.
                      </p>
                    </LightCard>
                  </div>
                ) : tab === 'FATURAS' ? (
                  <LightCard
                    title="Faturas"
                    action={
                      failed.length > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {failed.length === 1
                            ? '1 cobrança falhou'
                            : `${failed.length} cobranças falharam`}
                        </StatusChip>
                      ) : (
                        <StatusChip tone="positive" surface="light">
                          Nenhuma pendência
                        </StatusChip>
                      )
                    }
                  >
                    <DataTable
                      columns={invoiceColumns}
                      rows={data.invoices}
                      rowKey={(row) => row.id}
                      caption="Faturas da assinatura, com situação e valor"
                    />

                    {failed.length > 0 ? (
                      <div className="mt-5">
                        <h3 className="text-on-light-variant text-body-md mb-3 font-semibold">
                          Por que falharam
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {failed.map((invoice) => (
                            <li key={invoice.id} className="bg-light-container rounded-md p-3">
                              <p className="text-on-light flex items-center gap-2 font-medium">
                                <WarningIcon
                                  size={14}
                                  className="text-warning-on-light"
                                  aria-hidden="true"
                                />
                                <span className="tabular">{invoice.periodLabel}</span>
                              </p>
                              <p className="text-on-light-variant text-body-md mt-1">
                                {invoice.failureReason}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </LightCard>
                ) : (
                  <LightCard title="Forma de pagamento">
                    <div className="bg-light-container flex flex-wrap items-center gap-4 rounded-lg p-4">
                      <BillingIcon
                        size={32}
                        className="text-primary-on-light shrink-0"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="tabular text-on-light font-semibold">
                          {data.paymentMethod.brand} ···· {data.paymentMethod.last4}
                        </p>
                        <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                          {data.paymentMethod.holderName} · validade {data.paymentMethod.expiresAt}
                        </p>
                      </div>

                      <StatusChip tone="positive" surface="light">
                        Em uso
                      </StatusChip>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <SpectrumButton
                        onClick={() =>
                          toast.info('Atualizar forma de pagamento', {
                            description:
                              'O cadastro do cartão acontece no ambiente do gateway, fora do RookHub.',
                          })
                        }
                      >
                        Atualizar cartão
                      </SpectrumButton>

                      <SpectrumButton
                        variant="ghost"
                        onClick={() =>
                          toast.info('Cobrança por boleto ou Pix', {
                            description: 'Disponível no ciclo anual. Fale com o time comercial.',
                          })
                        }
                        /* Ghost é desenhado para o grafite: sobre o painel claro
                           precisa da borda e do texto escuros para não sumir. */
                        className="border-light-outline text-on-light bg-light-container hover:bg-light hover:border-on-light-muted"
                      >
                        Trocar para boleto ou Pix
                      </SpectrumButton>
                    </div>

                    {/*
                     * O RookHub não guarda dado de cartão — dizer isso na tela é o
                     * que separa "confio" de "por que eles têm meu cartão?".
                     */}
                    <p className="text-on-light-muted text-label-md mt-auto flex items-start gap-1.5 pt-6 normal-case">
                      <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />O RookHub
                      não armazena os dados do cartão. Guardamos apenas a bandeira e os quatro
                      últimos dígitos, devolvidos pelo gateway de pagamento.
                    </p>
                  </LightCard>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
