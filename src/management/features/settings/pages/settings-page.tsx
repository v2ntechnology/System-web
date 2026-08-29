import {
  AlertCircleIcon,
  CheckCircleIcon,
  IntegrationIcon,
  LockIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  WarningIcon,
} from '@/components/icons';
import type { IntegrationHealth, Role } from '@/management/types';
import { Avatar, GlassCard, LightCard, StatusChip, cn, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';

import { getSettings } from '../api';

const TABS = [
  { id: 'USUARIOS', label: 'Usuários e papéis' },
  { id: 'PLANO', label: 'Plano e módulos' },
  { id: 'INTEGRACOES', label: 'Integrações' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gestor',
  OPERATOR: 'Operador',
  MAINTENANCE: 'Manutenção',
  SUPER_ADMIN: 'Super admin',
  DRIVER: 'Motorista',
};

const HEALTH: Record<
  IntegrationHealth,
  { label: string; tone: StatusTone; icon: typeof CheckCircleIcon }
> = {
  OK: { label: 'Sincronizando', tone: 'positive', icon: CheckCircleIcon },
  ATRASADA: { label: 'Atrasada', tone: 'attention', icon: WarningIcon },
  FALHA: { label: 'Com falha', tone: 'critical', icon: AlertCircleIcon },
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** "há 4 min", "há 8 h", "há 3 d". */
function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function SettingsPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [tab, setTab] = useState<TabId>('USUARIOS');

  const withoutMfa = data?.members.filter((m) => m.active && !m.mfaEnabled).length ?? 0;
  const unhealthy = data?.integrations.filter((i) => i.health !== 'OK').length ?? 0;

  return (
    <>
      <PageBanner
        size="inline"
        title="Configurações"
        description="Quem tem acesso, o que o plano inclui e a saúde das integrações com os fornecedores."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Resumo da conta</h2>

        <QueryState isPending={isPending} isError={isError} label="as configurações">
          {data ? (
            <GlassCard className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
              {[
                { label: 'Usuários ativos', value: data.members.filter((m) => m.active).length },
                {
                  label: 'Sem verificação em duas etapas',
                  value: withoutMfa,
                  alert: withoutMfa > 0,
                },
                {
                  label: 'Módulos contratados',
                  value: `${data.modules.filter((m) => m.contracted).length} de ${data.modules.length}`,
                },
                { label: 'Integrações com problema', value: unhealthy, alert: unhealthy > 0 },
              ].map((metric) => (
                <div key={metric.label} className="bg-surface-lowest min-w-0 rounded-lg p-4">
                  <p className="text-on-surface-variant text-label-md normal-case">
                    {metric.label}
                  </p>
                  <p
                    className={cn(
                      'tabular font-sora mt-2 text-[28px] font-bold leading-none',
                      metric.alert ? 'text-warning' : 'text-on-surface',
                    )}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </GlassCard>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs tabs={TABS} value={tab} onValueChange={setTab} label="Seções de configuração">
          <QueryState isPending={isPending} isError={isError} label="as configurações">
            {data ? (
              <div className="pb-4">
                {/* -------------------------------------------------------
                 * Usuários e papéis (RF-003 a RF-007)
                 * ----------------------------------------------------- */}
                {tab === 'USUARIOS' ? (
                  <LightCard
                    title="Usuários"
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          toast.info('Convidar usuário', {
                            description: 'O fluxo de convite entra numa próxima etapa.',
                          })
                        }
                        className="bg-primary-strong text-on-primary text-label-md focus-visible:ring-primary-on-light inline-flex items-center gap-1.5 rounded-md px-4 py-2 normal-case transition-opacity hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
                      >
                        <PlusIcon size={14} aria-hidden="true" />
                        Convidar
                      </button>
                    }
                  >
                    <p className="text-on-light-variant text-body-md mb-5">
                      O papel define o que a pessoa vê e faz. A verificação real acontece no
                      servidor a cada requisição — a interface só reflete a decisão dele.
                    </p>

                    <ul className="flex flex-col gap-3">
                      {data.members.map((member) => (
                        <li key={member.id} className="bg-surface-lowest rounded-lg p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar name={member.name} className="size-10" />

                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'font-semibold',
                                  member.active ? 'text-on-surface' : 'text-on-surface-muted',
                                )}
                              >
                                {member.name}
                              </p>
                              <p className="tabular text-on-surface-muted text-label-md truncate normal-case">
                                {member.email}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <StatusChip tone="info">{ROLE_LABELS[member.role]}</StatusChip>

                              {member.mfaEnabled ? (
                                <StatusChip tone="positive" icon={<ShieldCheckIcon size={14} />}>
                                  2FA ativa
                                </StatusChip>
                              ) : member.active ? (
                                <StatusChip tone="attention" icon={<ShieldAlertIcon size={14} />}>
                                  Sem 2FA
                                </StatusChip>
                              ) : null}

                              {!member.active ? (
                                <StatusChip tone="neutral">Inativo</StatusChip>
                              ) : null}
                            </div>
                          </div>

                          {member.lastAccessAt ? (
                            <p className="border-outline-variant text-on-surface-muted text-label-md mt-3 border-t pt-3 normal-case">
                              Último acesso {relative(member.lastAccessAt)} ·{' '}
                              {dateTime.format(new Date(member.lastAccessAt))}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                ) : tab === 'PLANO' ? (
                  /* -----------------------------------------------------
                   * Plano e módulos (RF-002 / RN-004)
                   * --------------------------------------------------- */
                  <LightCard
                    title="Plano e módulos"
                    action={
                      <span className="text-on-light-muted text-label-md normal-case">
                        {data.planName}
                      </span>
                    }
                  >
                    <p className="text-on-light-variant text-body-md mb-5">
                      Módulo fora do plano continua visível no produto, em estado bloqueado — some
                      com ele e o cliente nem sabe que existe.
                    </p>

                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {data.modules.map((module) => (
                        <li
                          key={module.id}
                          className={cn(
                            'flex min-w-0 flex-col rounded-lg p-4',
                            module.contracted ? 'bg-surface-lowest' : 'bg-surface-lowest/60',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3
                              className={cn(
                                'font-semibold',
                                module.contracted ? 'text-on-surface' : 'text-on-surface-variant',
                              )}
                            >
                              {module.label}
                            </h3>
                            {module.contracted ? (
                              <CheckCircleIcon
                                size={18}
                                className="text-success shrink-0"
                                aria-label="Contratado"
                              />
                            ) : (
                              <LockIcon
                                size={18}
                                className="text-warning shrink-0"
                                aria-label="Não contratado"
                              />
                            )}
                          </div>

                          <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                            {module.description}
                          </p>

                          <div className="mt-auto pt-4">
                            {module.contracted ? (
                              <StatusChip tone="positive">Incluído no plano</StatusChip>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  toast.info(`${module.label} não está no seu plano`, {
                                    description: 'Nosso time comercial entrará em contato.',
                                  })
                                }
                                className="border-warning/40 text-warning text-label-md focus-visible:ring-secondary rounded-md border px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                              >
                                Conhecer
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                ) : (
                  /* -----------------------------------------------------
                   * Integrações (RN-140 / RN-141)
                   * --------------------------------------------------- */
                  <LightCard
                    title="Integrações"
                    action={
                      unhealthy > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {unhealthy} com problema
                        </StatusChip>
                      ) : null
                    }
                  >
                    <p className="text-on-light-variant text-body-md mb-5">
                      Integração parada significa número velho no painel inteiro. Por isso o horário
                      da última sincronização bem-sucedida fica visível aqui, e não escondido no
                      log.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-2">
                      {data.integrations.map((integration) => {
                        const health = HEALTH[integration.health];
                        const HealthIcon = health.icon;

                        return (
                          <li
                            key={integration.id}
                            className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-on-surface flex items-center gap-2 font-semibold">
                                  <IntegrationIcon size={16} aria-hidden="true" />
                                  {integration.provider}
                                </h3>
                                <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                  {integration.kind}
                                </p>
                              </div>

                              <StatusChip tone={health.tone} icon={<HealthIcon size={14} />}>
                                {health.label}
                              </StatusChip>
                            </div>

                            {integration.note ? (
                              <p
                                className={cn(
                                  'text-label-md mt-3 normal-case',
                                  integration.health === 'FALHA' ? 'text-error' : 'text-warning',
                                )}
                              >
                                {integration.note}
                              </p>
                            ) : null}

                            <div className="border-outline-variant mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3">
                              <span className="tabular text-on-surface-muted text-label-md normal-case">
                                Última sincronização {relative(integration.lastSuccessfulSyncAt)}
                              </span>
                              <span className="tabular text-on-surface-muted text-label-md normal-case">
                                {integration.vehiclesCovered} veículos
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
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
