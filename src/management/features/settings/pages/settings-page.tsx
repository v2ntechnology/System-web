import {
  AlertCircleIcon,
  BoxesIcon,
  CheckCircleIcon,
  IntegrationIcon,
  LockIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UsersIcon,
  WarningIcon,
} from '@/components/icons';
import type { IntegrationHealth, Role } from '@/management/types';
import { Avatar, SpectrumButton, StatusChip, cn, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
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

  const ativos = data?.members.filter((m) => m.active).length ?? 0;
  const contratados = data?.modules.filter((m) => m.contracted).length ?? 0;

  const stats: HeroStat[] = [
    {
      key: 'usuarios',
      label: 'Usuários ativos',
      value: ativos,
      outOf: data?.members.length,
      hint: 'com acesso ao painel',
      icon: UsersIcon,
    },
    {
      /* ⚠️ Sem 2FA é o número que manda agir, e por isso ele tem tom: cada conta
         sem verificação é uma senha entre a operação e quem quiser entrar. */
      key: 'sem-2fa',
      label: 'Sem verificação em duas etapas',
      value: withoutMfa,
      hint: 'contas ativas com só a senha',
      icon: ShieldAlertIcon,
      tone: withoutMfa > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'modulos',
      label: 'Módulos contratados',
      value: contratados,
      outOf: data?.modules.length,
      hint: 'o resto aparece bloqueado',
      icon: BoxesIcon,
    },
    {
      key: 'integracoes',
      label: 'Integrações com problema',
      value: unhealthy,
      hint: 'integração parada é número velho',
      icon: IntegrationIcon,
      tone: unhealthy > 0 ? 'warn' : 'neutral',
    },
  ];

  return (
    <>
      <HeroBand
        title="Configurações"
        description="Quem tem acesso, o que o plano inclui e a saúde das integrações com os fornecedores."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo da conta</h2>

        <QueryState isPending={isPending} isError={isError} label="as configurações">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState`
              ela jogaria o carregando e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
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
                  /* ⚠️ Sem `LightCard` em volta (08/09/2026): é cartão dentro de
                     cartão. O conteúdo já mora no painel branco da página, e a
                     moldura não separava nada, porque não divide a tela com
                     ninguém. Título e respiro fazem a separação, como no resto
                     do painel. */
                  <section>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
                        Usuários
                      </h2>
                      <SpectrumButton
                        type="button"
                        size="sm"
                        onClick={() =>
                          toast.info('Convidar usuário', {
                            description: 'O fluxo de convite entra numa próxima etapa.',
                          })
                        }
                      >
                        <PlusIcon size={14} aria-hidden="true" />
                        Convidar
                      </SpectrumButton>
                    </div>

                    <p className="text-on-light-variant text-body-md mb-5">
                      O papel define o que a pessoa vê e faz. A verificação real acontece no
                      servidor a cada requisição: a interface só reflete a decisão dele.
                    </p>

                    <ul className="flex flex-col gap-3">
                      {data.members.map((member) => (
                        <li key={member.id} className="bg-light-container rounded-lg p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar name={member.name} className="size-10" />

                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'font-semibold',
                                  member.active ? 'text-on-light' : 'text-on-light-muted',
                                )}
                              >
                                {member.name}
                              </p>
                              <p className="tabular text-on-light-muted text-label-md truncate normal-case">
                                {member.email}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* ⚠️ `surface="light"` em todos: a lista mora no
                                  painel claro, e o par semântico do grafite
                                  reprova AA sobre o branco. */}
                              <StatusChip tone="info" surface="light">
                                {ROLE_LABELS[member.role]}
                              </StatusChip>

                              {member.mfaEnabled ? (
                                <StatusChip
                                  tone="positive"
                                  surface="light"
                                  icon={<ShieldCheckIcon size={14} />}
                                >
                                  2FA ativa
                                </StatusChip>
                              ) : member.active ? (
                                <StatusChip
                                  tone="attention"
                                  surface="light"
                                  icon={<ShieldAlertIcon size={14} />}
                                >
                                  Sem 2FA
                                </StatusChip>
                              ) : null}

                              {!member.active ? (
                                <StatusChip tone="neutral" surface="light">
                                  Inativo
                                </StatusChip>
                              ) : null}
                            </div>
                          </div>

                          {member.lastAccessAt ? (
                            <p className="border-light-outline text-on-light-muted text-label-md mt-3 border-t pt-3 normal-case">
                              Último acesso {relative(member.lastAccessAt)} ·{' '}
                              {dateTime.format(new Date(member.lastAccessAt))}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : tab === 'PLANO' ? (
                  /* -----------------------------------------------------
                   * Plano e módulos (RF-002 / RN-004)
                   * --------------------------------------------------- */
                  <section>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
                        Plano e módulos
                      </h2>
                      <span className="text-on-light-muted text-label-md normal-case">
                        {data.planName}
                      </span>
                    </div>

                    <p className="text-on-light-variant text-body-md mb-5">
                      Módulo fora do plano continua visível no produto, em estado bloqueado: some
                      com ele e o cliente nem sabe que existe.
                    </p>

                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {data.modules.map((module) => (
                        <li
                          key={module.id}
                          className={cn(
                            'flex min-w-0 flex-col rounded-lg p-4',
                            module.contracted ? 'bg-light-container' : 'bg-light-container/60',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3
                              className={cn(
                                'font-semibold',
                                module.contracted ? 'text-on-light' : 'text-on-light-variant',
                              )}
                            >
                              {module.label}
                            </h3>
                            {module.contracted ? (
                              <CheckCircleIcon
                                size={18}
                                className="text-success-on-light shrink-0"
                                aria-label="Contratado"
                              />
                            ) : (
                              <LockIcon
                                size={18}
                                className="text-warning-on-light shrink-0"
                                aria-label="Não contratado"
                              />
                            )}
                          </div>

                          <p className="text-on-light-muted text-label-md mt-1 normal-case">
                            {module.description}
                          </p>

                          <div className="mt-auto pt-4">
                            {module.contracted ? (
                              <StatusChip tone="positive" surface="light">
                                Incluído no plano
                              </StatusChip>
                            ) : (
                              <SpectrumButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toast.info(`${module.label} não está no seu plano`, {
                                    description: 'Nosso time comercial entrará em contato.',
                                  })
                                }
                              >
                                Conhecer
                              </SpectrumButton>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  /* -----------------------------------------------------
                   * Integrações (RN-140 / RN-141)
                   * --------------------------------------------------- */
                  <section>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
                        Integrações
                      </h2>
                      {unhealthy > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {unhealthy} com problema
                        </StatusChip>
                      ) : null}
                    </div>

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
                            className="bg-light-container flex min-w-0 flex-col rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-on-light flex items-center gap-2 font-semibold">
                                  <IntegrationIcon size={16} aria-hidden="true" />
                                  {integration.provider}
                                </h3>
                                <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                                  {integration.kind}
                                </p>
                              </div>

                              <StatusChip
                                tone={health.tone}
                                surface="light"
                                icon={<HealthIcon size={14} />}
                              >
                                {health.label}
                              </StatusChip>
                            </div>

                            {integration.note ? (
                              <p
                                className={cn(
                                  'text-label-md mt-3 normal-case',
                                  integration.health === 'FALHA'
                                    ? 'text-error-on-light'
                                    : 'text-warning-on-light',
                                )}
                              >
                                {integration.note}
                              </p>
                            ) : null}

                            <div className="border-light-outline mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3">
                              <span className="tabular text-on-light-muted text-label-md normal-case">
                                Última sincronização {relative(integration.lastSuccessfulSyncAt)}
                              </span>
                              <span className="tabular text-on-light-muted text-label-md normal-case">
                                {integration.vehiclesCovered} veículos
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
