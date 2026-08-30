import {
  BlockedIcon,
  CameraIcon,
  CheckCircleIcon,
  ChecklistIcon,
  WarningIcon,
  XCircleIcon,
} from '@/components/icons';
import type { ChecklistFill } from '@/management/types';
import { GlassCard, LightCard, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { PendingSource } from '@/management/components/layout/pending-source';
import { QueryState } from '@/management/components/layout/query-state';
import { env } from '@/app/environment';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getChecklistSummary } from '../api';

const TABS = [
  { id: 'PREENCHIMENTOS', label: 'Preenchimentos' },
  { id: 'BLOQUEIOS', label: 'Bloqueios' },
  { id: 'TEMPLATES', label: 'Templates' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});
const date = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

/** RN-054 — divergência acima de 6h entre aparelho e servidor vira flag. */
const SYNC_FLAG_HOURS = 6;

function syncGapHours(fill: ChecklistFill) {
  return (new Date(fill.receivedAt).getTime() - new Date(fill.filledAt).getTime()) / 3_600_000;
}

const isBlocked = (fill: ChecklistFill) => fill.blocking && !fill.releasedAt;

export function ChecklistsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['checklists'],
    queryFn: getChecklistSummary,
  });

  const [tab, setTab] = useState<TabId>('PREENCHIMENTOS');

  const fills = useMemo(() => data?.fills ?? [], [data]);
  const visible = useMemo(
    () => (tab === 'BLOQUEIOS' ? fills.filter((f) => f.blocking) : fills),
    [fills, tab],
  );

  const fillId = useCallback((fill: ChecklistFill) => fill.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, fillId);

  const blocked = fills.filter(isBlocked).length;
  const failed = fills.filter((f) => f.result === 'REPROVADO').length;
  const flagged = fills.filter((f) => syncGapHours(f) > SYNC_FLAG_HOURS).length;

  /*
   * Sem origem de dado, a tela explica a ausência em vez de mostrar o mock.
   *
   * O caminho de demonstração continua inteiro: com `VITE_ENABLE_MOCKS=true` a
   * tela cheia volta. O que não pode acontecer é número simulado ao lado da
   * frota verdadeira, porque quem olha não tem como saber que é enfeite.
   */
  if (!env.enableMocks) {
    return (
      <>
        <PageBanner
          size="inline"
          title="Checklists"
          description="O que o motorista verificou antes de sair e o que reprovou."
        />

        <PageContent className="mt-0 sm:mt-0">
          <PendingSource
            title="Checklists dependem do aplicativo do motorista"
            description="O checklist é preenchido por quem está no veículo, antes de sair. Ele não vem do rastreador: vem do aplicativo do motorista, que ainda não está ligado ao backend."
            requirements={[
              'Modelo de checklist: quais itens, por tipo de veículo',
              'Aplicativo do motorista enviando o preenchimento',
              'Regra de bloqueio: qual reprovação impede a saída (RF-016)',
            ]}
            meanwhile={[
              { label: 'Quais veículos estão rodando agora', to: '/gestao/mapa' },
              { label: 'Quem passou do limite de jornada', to: '/gestao/motoristas' },
            ]}
          />
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageBanner
        size="inline"
        title="Checklists"
        description="O que o motorista verificou antes de sair, o que reprovou e qual veículo está impedido de rodar."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo de checklists</h2>

        <QueryState isPending={isPending} isError={isError} label="os checklists">
          <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            {[
              { label: 'Preenchimentos', value: fills.length },
              { label: 'Com reprovação', value: failed },
              { label: 'Veículos bloqueados', value: blocked, alert: blocked > 0 },
              { label: 'Sincronização tardia', value: flagged, alert: flagged > 0 },
            ].map((metric) => (
              <div key={metric.label} className="metric-tile">
                <p className="text-on-surface-variant text-label-md normal-case">{metric.label}</p>
                <p
                  className={cn(
                    'tabular font-sora mt-2 text-[32px] font-bold leading-none',
                    metric.alert ? 'text-error' : 'text-on-surface',
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </GlassCard>

          {blocked > 0 ? (
            /* RF-016 — o bloqueio é o ponto do checklist, não um efeito colateral. */
            <div className="bg-error/10 border-error/30 text-error mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
              <BlockedIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-body-md">
                {blocked === 1
                  ? '1 veículo está impedido de sair por pendência de checklist.'
                  : `${blocked} veículos estão impedidos de sair por pendência de checklist.`}
              </p>
            </div>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((option) => ({
            ...option,
            count:
              option.id === 'PREENCHIMENTOS'
                ? fills.length
                : option.id === 'BLOQUEIOS'
                  ? fills.filter((f) => f.blocking).length
                  : data?.templates.length,
          }))}
          value={tab}
          onValueChange={setTab}
          label="Seções de checklist"
        >
          <QueryState isPending={isPending} isError={isError} label="os checklists">
            {data ? (
              <div className="pb-4">
                {tab === 'TEMPLATES' ? (
                  <LightCard title="Templates">
                    <p className="text-on-light-variant text-body-md mb-5">
                      Cada preenchimento guarda a versão do template usada — sem isso, mudar o
                      formulário reescreveria o histórico (RN-033).
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.templates.map((template) => (
                        <li key={template.id} className="bg-surface-lowest rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-on-surface font-semibold">{template.name}</h3>
                              <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                {template.appliesTo}
                              </p>
                            </div>
                            <ChecklistIcon
                              size={18}
                              className="text-on-surface-muted shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          <div className="border-outline-variant mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                            <StatusChip tone="info">{template.version}</StatusChip>
                            <span className="tabular text-on-surface-muted text-label-md normal-case">
                              {template.itemCount} itens
                            </span>
                            <span className="text-on-surface-muted text-label-md normal-case">
                              atualizado {date.format(new Date(template.updatedAt))}
                            </span>
                            <StatusChip
                              tone={template.active ? 'positive' : 'neutral'}
                              className="ml-auto"
                            >
                              {template.active ? 'Ativo' : 'Inativo'}
                            </StatusChip>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                ) : (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_1fr]">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-baseline justify-between gap-3">
                        <h2 className="font-sora text-primary text-headline-md">
                          {tab === 'BLOQUEIOS' ? 'Bloqueios' : 'Preenchimentos'}
                        </h2>
                        <span className="text-on-light-muted text-label-md tabular normal-case">
                          {visible.length}
                        </span>
                      </div>

                      {visible.length === 0 ? (
                        <p className="text-on-light-variant text-body-md py-10 text-center">
                          Nenhum checklist nesta situação.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {visible.map((fill) => {
                            const active = fill.id === selectedId;
                            return (
                              <li key={fill.id} className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(fill.id)}
                                  aria-current={active ? 'true' : undefined}
                                  className={cn(
                                    'focus-visible:ring-primary-on-light w-full rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                                    active ? 'bg-primary-strong' : 'hover:bg-light-container',
                                  )}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span
                                      className={cn(
                                        'tabular font-semibold',
                                        active ? 'text-on-primary' : 'text-on-light',
                                      )}
                                    >
                                      {fill.plate}
                                    </span>
                                    {active ? null : isBlocked(fill) ? (
                                      <StatusChip tone="critical" surface="light">
                                        Bloqueado
                                      </StatusChip>
                                    ) : fill.result === 'REPROVADO' ? (
                                      <StatusChip tone="attention" surface="light">
                                        Liberado
                                      </StatusChip>
                                    ) : (
                                      <StatusChip tone="positive" surface="light">
                                        Aprovado
                                      </StatusChip>
                                    )}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-label-md mt-1 block truncate normal-case',
                                      active ? 'text-on-primary' : 'text-on-light-muted',
                                    )}
                                  >
                                    {fill.driverName} · {dateTime.format(new Date(fill.filledAt))}
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
                        <section
                          aria-label={`Checklist do ${selected.plate}`}
                          className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
                        >
                          <header className="border-outline-variant flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                            <div className="min-w-0">
                              <h3 className="tabular font-sora text-on-surface text-headline-md font-bold">
                                {selected.plate}
                              </h3>
                              <p className="text-on-surface-variant text-body-md mt-1">
                                {selected.templateName}
                              </p>
                              <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                {selected.driverName} · template {selected.templateVersion}
                              </p>
                            </div>

                            {isBlocked(selected) ? (
                              <StatusChip tone="critical" icon={<BlockedIcon size={14} />}>
                                Veículo bloqueado
                              </StatusChip>
                            ) : selected.result === 'REPROVADO' ? (
                              <StatusChip tone="attention">Liberado após correção</StatusChip>
                            ) : (
                              <StatusChip tone="positive" icon={<CheckCircleIcon size={14} />}>
                                Aprovado
                              </StatusChip>
                            )}
                          </header>

                          {/* RN-054 — os dois relógios, lado a lado. */}
                          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="bg-on-surface/4 rounded-md p-3">
                              <dt className="text-on-surface-muted text-label-md normal-case">
                                Preenchido no aparelho
                              </dt>
                              <dd className="tabular text-on-surface text-body-md mt-1">
                                {dateTime.format(new Date(selected.filledAt))}
                              </dd>
                            </div>
                            <div className="bg-on-surface/4 rounded-md p-3">
                              <dt className="text-on-surface-muted text-label-md normal-case">
                                Recebido pelo servidor
                              </dt>
                              <dd className="tabular text-on-surface text-body-md mt-1">
                                {dateTime.format(new Date(selected.receivedAt))}
                              </dd>
                            </div>
                          </dl>

                          {syncGapHours(selected) > SYNC_FLAG_HOURS ? (
                            <p className="bg-warning/10 border-warning/30 text-warning text-label-md mt-3 flex items-start gap-2 rounded-md border px-3 py-2 normal-case">
                              <WarningIcon
                                size={14}
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                              />
                              Sincronizado {Math.round(syncGapHours(selected))}h depois do
                              preenchimento — acima do limite de {SYNC_FLAG_HOURS}h, fica marcado
                              para auditoria.
                            </p>
                          ) : null}

                          {selected.releasedAt ? (
                            <div className="border-outline-variant mt-4 border-t pt-4">
                              <h4 className="text-on-surface-variant text-body-md mb-1">
                                Liberação
                              </h4>
                              <p className="text-on-surface-muted text-label-md normal-case">
                                {selected.releasedBy} ·{' '}
                                {dateTime.format(new Date(selected.releasedAt))}
                              </p>
                              <p className="text-on-surface-variant text-body-md mt-1">
                                {selected.releaseReason}
                              </p>
                            </div>
                          ) : null}

                          <div className="mt-5">
                            <h4 className="text-on-surface-variant text-body-md mb-3">
                              Itens verificados
                            </h4>
                            <ul className="flex flex-col gap-2">
                              {selected.items.map((item) => (
                                <li
                                  key={item.label}
                                  className="bg-on-surface/4 flex items-start gap-2.5 rounded-md px-3 py-2.5"
                                >
                                  {item.result === 'APROVADO' ? (
                                    <CheckCircleIcon
                                      size={16}
                                      className="text-success mt-0.5 shrink-0"
                                      aria-label="Aprovado"
                                    />
                                  ) : (
                                    <XCircleIcon
                                      size={16}
                                      className="text-error mt-0.5 shrink-0"
                                      aria-label="Reprovado"
                                    />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="text-on-surface text-body-md block">
                                      {item.label}
                                    </span>
                                    {item.note ? (
                                      <span className="text-on-surface-variant text-label-md block normal-case">
                                        {item.note}
                                      </span>
                                    ) : null}
                                  </span>
                                  {item.hasPhoto ? (
                                    <CameraIcon
                                      size={16}
                                      className="text-on-surface-muted mt-0.5 shrink-0"
                                      aria-label="Com foto anexada"
                                    />
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {isBlocked(selected) ? (
                            <div className="border-outline-variant mt-5 border-t pt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  toast.info('Liberação exige motivo', {
                                    description:
                                      'Liberar veículo bloqueado é operação auditada: exige motivo textual e fica no log imutável.',
                                  })
                                }
                                className="border-warning/40 text-warning text-label-md focus-visible:ring-secondary rounded-md border px-4 py-2 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                              >
                                Liberar veículo
                              </button>
                              <p className="text-on-surface-muted text-label-md mt-2 normal-case">
                                A liberação exige motivo e fica registrada no log de auditoria.
                              </p>
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
