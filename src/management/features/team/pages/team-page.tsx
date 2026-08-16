import { InfoIcon, MagnifyingGlassIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { TeamPerson } from '@/management/types';
import { GlassCard, LightCard, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';

import { getTeam } from '../api';
import { PersonCard } from '../components/person-card';

const TABS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'MOTORISTAS', label: 'Motoristas' },
  { id: 'PAINEL', label: 'Painel' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'neutral' | 'warning' | undefined;
}) {
  return (
    <div className="bg-surface-lowest min-w-0 rounded-lg p-4">
      <p className="text-on-surface-variant text-label-md normal-case">{label}</p>
      <p
        className={cn(
          'tabular font-sora mt-2 text-[24px] font-bold leading-none',
          tone === 'warning' ? 'text-warning' : 'text-on-surface',
        )}
      >
        {value}
      </p>
      <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">{hint}</p>
    </div>
  );
}

/**
 * Quadro de pessoas do tenant — dono e gestor.
 *
 * Existe porque as duas visões que havia respondiam outra pergunta: Configurações
 * responde "quem tem acesso a quê" e a tela de Motoristas responde "como este
 * motorista dirige". Nenhuma das duas responde **"quem é o time e quem pode
 * trabalhar hoje"**, que é o que o dono e o gestor perguntam.
 *
 * Por isso aqui não se edita nada: o cartão aponta para a ficha do motorista e
 * para Configurações. Duas telas donas da mesma ação divergem na primeira
 * mudança de regra.
 *
 * O gestor recebe os atalhos de tratativa; o dono, a leitura — a alçada de
 * pessoas é do gestor (RF-003).
 */
export function TeamPage() {
  const [tab, setTab] = useState<TabId>('TODOS');
  const [term, setTerm] = useState('');

  const role = useSession()?.user.role;
  const canAct = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const { data, isPending, isError } = useQuery({ queryKey: ['team'], queryFn: getTeam });

  const people = useMemo(() => data?.people ?? [], [data]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return (
      people
        .filter((person) => {
          if (tab === 'MOTORISTAS' && person.kind !== 'MOTORISTA') return false;
          if (tab === 'PAINEL' && person.kind !== 'PAINEL') return false;
          if (!needle) return true;

          const haystack = [
            person.name,
            person.roleLabel,
            person.kind === 'PAINEL' ? person.email : (person.currentVehiclePlate ?? ''),
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(needle);
        })
        /*
         * Motorista antes de usuário do painel, e dentro de cada grupo por nome.
         * Ordenar só por nome misturaria as duas naturezas e faria o card de
         * acesso aparecer entre dois motoristas sem motivo.
         */
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'MOTORISTA' ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        })
    );
  }, [people, tab, term]);

  const counts = useMemo(
    () => ({
      TODOS: people.length,
      MOTORISTAS: people.filter((person) => person.kind === 'MOTORISTA').length,
      PAINEL: people.filter((person) => person.kind === 'PAINEL').length,
    }),
    [people],
  );

  const personKey = (person: TeamPerson) => `${person.kind}-${person.id}`;

  return (
    <>
      <PageBanner
        size="inline"
        title="Equipe"
        description="Quem trabalha na operação, o que cada um faz e quem pode assumir viagem hoje."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <h2 className="sr-only">Resumo do quadro</h2>

        <QueryState isPending={isPending} isError={isError} label="a equipe">
          {data ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
              <GlassCard className="flex min-w-0 flex-col p-5 sm:p-6">
                <h3 className="text-on-surface-variant text-body-md flex items-center gap-2">
                  <UsersThreeIcon size={18} weight="duotone" aria-hidden="true" />
                  Pessoas no quadro
                </h3>

                <p className="tabular font-sora text-on-surface mt-2 text-[44px] font-bold leading-none">
                  {data.headcount}
                </p>

                <p className="text-on-surface-variant text-label-md mt-3 normal-case">
                  {data.drivers} motoristas · {data.staff} com acesso ao painel
                </p>

                {/* RN-121 — o número vem com a procedência colada nele. */}
                <p className="text-on-surface-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
                  <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Cadastro de motoristas e usuários do painel
                </p>
              </GlassCard>

              <GlassCard className="grid min-w-0 gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                <Tile
                  label="Disponíveis agora"
                  value={String(data.driversAvailable)}
                  hint="podem assumir viagem"
                />
                <Tile
                  label="Indisponíveis"
                  value={String(data.driversUnavailable)}
                  hint="descanso ou afastamento"
                  tone={data.driversUnavailable > 0 ? 'warning' : 'neutral'}
                />
                <Tile
                  label="CNH a vencer"
                  value={String(data.cnhExpiringSoon)}
                  hint="nos próximos 60 dias"
                  tone={data.cnhExpiringSoon > 0 ? 'warning' : 'neutral'}
                />
                <Tile
                  label="Acesso sem MFA"
                  value={String(data.withoutMfa)}
                  hint="tratado em Configurações"
                  tone={data.withoutMfa > 0 ? 'warning' : 'neutral'}
                />
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
          label="Recortes do quadro"
        >
          <QueryState isPending={isPending} isError={isError} label="a equipe">
            <LightCard
              title="Quadro"
              action={
                <div className="rounded-pill focus-within:border-primary-on-light bg-light-container border-light-outline flex min-w-0 items-center gap-2 border px-4 sm:w-64">
                  <MagnifyingGlassIcon
                    size={18}
                    className="text-on-light-muted shrink-0"
                    aria-hidden="true"
                  />
                  <label htmlFor="team-search" className="sr-only">
                    Buscar por nome, função, placa ou e-mail
                  </label>
                  <input
                    id="team-search"
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Nome, função ou placa"
                    className="text-body-md text-on-light placeholder:text-on-light-muted h-10 w-full bg-transparent focus:outline-none"
                  />
                </div>
              }
            >
              {visible.length === 0 ? (
                <p className="text-on-light-variant text-body-md py-10 text-center">
                  Ninguém encontrado com esse termo.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((person) => (
                    <PersonCard key={personKey(person)} person={person} canAct={canAct} />
                  ))}
                </ul>
              )}

              <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
                Ficha, advertências e histórico ficam em Motoristas. Papéis e acesso, em
                Configurações.
              </p>
            </LightCard>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
