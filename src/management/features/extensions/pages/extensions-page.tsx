import { ExtensionIcon, InfoIcon, LockIcon } from '@/components/icons';
import type { Extension, ExtensionCategory } from '@/management/types';
import { GlassCard, LightCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';
import { useMasterDetail } from '@/management/hooks/use-master-detail';
import { brl, dateOnly } from '@/management/lib/format';

import { getExtensions } from '../api';
import { ExtensionDetailPanel } from '../components/extension-detail-panel';
import { billingLabel, extensionMonthlyCost } from '../pricing';

const TABS = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'ATIVAS', label: 'Ativas' },
  { id: 'DISPONIVEIS', label: 'Disponíveis' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CATEGORY_LABEL: Record<ExtensionCategory, string> = {
  TELEMETRIA: 'Telemetria',
  COMBUSTIVEL: 'Combustível',
  PEDAGIO: 'Pedágio',
  CAMERAS: 'Câmeras',
  COMUNICACAO: 'Comunicação',
  FISCAL: 'Fiscal',
};

/**
 * Marketplace de extensões (RF-002).
 *
 * Exclusivo do proprietário: ativar uma extensão **contrata um serviço** e muda a
 * fatura. Gestor e operador convivem com o resultado, mas a assinatura é de quem
 * paga.
 *
 * Esta tela é a vitrine; a aba Integrações de Configurações continua sendo o
 * diagnóstico de quem já está conectado. As duas leem a mesma fonte, então cada
 * fornecedor tem um nome só dentro do produto.
 */
export function ExtensionsPage() {
  const [tab, setTab] = useState<TabId>('TODAS');
  const session = useSession();

  const { data, isPending, isError } = useQuery({
    queryKey: ['extensions'],
    queryFn: getExtensions,
  });

  const all = useMemo(() => data?.extensions ?? [], [data]);
  const billableVehicles = data?.billableVehicles ?? 0;
  const contracted = session?.tenant.modules ?? [];

  const visible = useMemo(
    () =>
      all.filter((item) =>
        tab === 'ATIVAS'
          ? item.status !== 'DISPONIVEL'
          : tab === 'DISPONIVEIS'
            ? item.status === 'DISPONIVEL'
            : true,
      ),
    [all, tab],
  );

  const extensionId = useCallback((item: Extension) => item.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, extensionId);

  const counts = useMemo(
    () => ({
      TODAS: all.length,
      ATIVAS: all.filter((item) => item.status !== 'DISPONIVEL').length,
      DISPONIVEIS: all.filter((item) => item.status === 'DISPONIVEL').length,
    }),
    [all],
  );

  const pendingSetup = all.filter((item) => item.status === 'AGUARDANDO_CONFIGURACAO').length;

  return (
    <>
      <PageBanner
        size="inline"
        title="Extensões"
        description="Integrações e serviços de outras plataformas que a sua operação pode contratar e conectar ao RookHub."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo das extensões</h2>

        <QueryState isPending={isPending} isError={isError} label="as extensões">
          {data ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
              <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
                <h3 className="text-on-surface-variant text-body-md flex items-center gap-2">
                  <ExtensionIcon size={18} aria-hidden="true" />
                  Extensões contratadas
                </h3>

                <p className="tabular font-sora text-on-surface mt-2 text-[44px] font-bold leading-none">
                  {brl.format(data.monthlyTotal)}
                  <span className="text-on-surface-muted text-body-lg ml-1.5 font-normal">
                    / mês
                  </span>
                </p>

                <p className="text-on-surface-variant text-label-md mt-3 normal-case">
                  {counts.ATIVAS === 1 ? '1 extensão ativa' : `${counts.ATIVAS} extensões ativas`} ·
                  próxima cobrança em {dateOnly.format(new Date(data.nextChargeAt))}
                </p>

                {/* RN-121 — o número vem com a procedência colada nele. */}
                <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                  <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Soma das extensões ativas · {data.billableVehicles} veículos na base
                </p>
              </GlassCard>

              <GlassCard className="flex min-w-0 flex-col justify-between gap-4 p-5 sm:p-6">
                <p className="text-on-surface text-body-lg">
                  Ativar uma extensão contrata o serviço do fornecedor. O valor entra na sua próxima
                  fatura, junto com o plano.
                </p>

                {/*
                 * Contratada e sem credencial é o pior estado possível: já custa e
                 * não entrega. Vale um aviso no cabeçalho, não só um chip na lista.
                 */}
                {pendingSetup > 0 ? (
                  <div className="bg-warning/10 border-warning/30 rounded-lg border px-4 py-3">
                    <p className="text-on-surface text-body-md">
                      {pendingSetup === 1
                        ? '1 extensão contratada ainda sem credenciais — ela já é cobrada, mas não traz dado nenhum.'
                        : `${pendingSetup} extensões contratadas ainda sem credenciais — já são cobradas, mas não trazem dado nenhum.`}
                    </p>
                  </div>
                ) : null}

                <p className="text-on-surface-muted text-label-md normal-case">
                  A saúde da sincronização de cada fornecedor conectado fica em{' '}
                  <Link
                    to="/gestao/configuracoes"
                    className="text-on-surface underline-offset-4 hover:underline"
                  >
                    Configurações › Integrações
                  </Link>
                  , e a fatura em{' '}
                  <Link
                    to="/gestao/cobranca"
                    className="text-on-surface underline-offset-4 hover:underline"
                  >
                    Plano e cobrança
                  </Link>
                  .
                </p>
              </GlassCard>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((entry) => ({ ...entry, count: counts[entry.id] }))}
          value={tab}
          onValueChange={setTab}
          label="Situação das extensões"
        >
          <QueryState isPending={isPending} isError={isError} label="as extensões">
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,380px)_1fr]">
              <div className="min-w-0">
                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhuma extensão neste recorte.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((item) => {
                      const active = item.id === selectedId;
                      const locked =
                        Boolean(item.requiredModule) && !contracted.includes(item.requiredModule!);
                      const monthly = extensionMonthlyCost(item, billableVehicles);

                      return (
                        <li key={item.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                              active ? 'bg-primary-strong' : 'hover:bg-light-container',
                            )}
                          >
                            <span className="flex items-start gap-2">
                              <span
                                className={cn(
                                  'min-w-0 flex-1 font-semibold',
                                  active ? 'text-on-primary' : 'text-on-light',
                                )}
                              >
                                {item.name}
                              </span>

                              {/* RN-004 — módulo fora do plano aparece bloqueado. */}
                              {locked ? (
                                <LockIcon
                                  size={16}
                                  aria-label="Módulo não contratado"
                                  className={cn(
                                    'mt-0.5 shrink-0',
                                    active ? 'text-on-primary' : 'text-warning-on-light',
                                  )}
                                />
                              ) : item.status !== 'DISPONIVEL' ? (
                                <span
                                  className={cn(
                                    'rounded-pill text-label-md shrink-0 px-2 py-0.5 normal-case',
                                    active
                                      ? 'text-on-primary bg-on-surface/20'
                                      : item.status === 'ATIVA'
                                        ? 'bg-success-on-light/12 text-success-on-light'
                                        : 'bg-warning-on-light/12 text-warning-on-light',
                                  )}
                                >
                                  {item.status === 'ATIVA' ? 'Ativa' : 'Configurar'}
                                </span>
                              ) : null}
                            </span>

                            <span
                              className={cn(
                                'text-label-md mt-1 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-muted',
                              )}
                            >
                              {CATEGORY_LABEL[item.category]} · {item.tagline}
                            </span>

                            <span
                              className={cn(
                                'tabular text-label-md mt-1 block normal-case',
                                active ? 'text-on-primary' : 'text-on-light-variant',
                              )}
                            >
                              {item.billing.model === 'INCLUSA'
                                ? 'Inclusa no plano'
                                : `${billingLabel(item.billing, (value) => brl.format(value))} · ${brl.format(monthly)}/mês`}
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
                  /* `key`: trocar de extensão zera o formulário de credenciais
                     pela remontagem, sem efeito sincronizando estado. */
                  <ExtensionDetailPanel
                    key={selected.id}
                    extension={selected}
                    billableVehicles={billableVehicles}
                  />
                ) : (
                  <LightCard title="Extensões">
                    <p className="text-on-light-variant text-body-md">
                      Selecione uma extensão para ver o que ela traz e contratar.
                    </p>
                  </LightCard>
                )}
              </div>
            </div>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
