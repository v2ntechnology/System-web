import {
  IdCardIcon,
  InfoIcon,
  PlusIcon,
  LockIcon,
  SearchIcon,
  SteeringWheelIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons';
import type { TeamPerson } from '@/management/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { HERO_PILL, HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';

import { env } from '@/app/environment';
import { PendingSource } from '@/management/components/layout/pending-source';
import {
  deleteDriver,
  deactivateTeamMember,
  fetchRoles,
  fetchTeam,
  resendTeamInvite,
  setDriverActive,
  type TeamMember,
} from '@/management/lib/fleet-api';
import { Alert, GlassModal, SpectrumButton } from '@/management/ui';
import { ApiError } from '@/services/http';

import { MemberDialog } from '../components/member-dialog';

import { getTeam } from '../api';
import { DriverRegistrationModal } from '../../drivers/components/driver-registration-modal';
import { TeamRoster } from '../components/team-roster';
import { PersonCard } from '../components/person-card';

const TABS = [
  { id: 'MOTORISTAS', label: 'Motoristas' },
  { id: 'EQUIPE', label: 'Equipe de apoio' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Quadro de pessoas do tenant: dono e gestor.
 *
 * Existe porque as duas visões que havia respondiam outra pergunta:
 * Configurações responde "quem tem acesso a quê" e a tela de Motoristas responde
 * "como este motorista dirige". Nenhuma das duas responde **"quem é o time e
 * quem pode trabalhar hoje"**, que é o que o dono e o gestor perguntam.
 *
 * Por isso aqui não se edita nada: o cartão aponta para a ficha do motorista e
 * para Configurações. Duas telas donas da mesma ação divergem na primeira
 * mudança de regra.
 *
 * O gestor recebe os atalhos de tratativa; o dono, a leitura: a alçada de
 * pessoas é do gestor (RF-003).
 */
export function TeamPage() {
  if (!env.enableMocks) return <EquipeReal />;
  return <EquipeSimulada />;
}

/**
 * Equipe com o que a telemetria e o nosso banco sabem.
 *
 * ⚠️ A tela de origem mostrava "disponíveis agora", "CNH a vencer" e "acesso sem
 * MFA". **Nenhum dos três tem origem.** Disponibilidade de motorista depende de
 * escala, CNH e admissão são do RH, e segundo fator ainda não foi implementado.
 * Uma CNH vencendo que ninguém cadastrou é pior que uma coluna vazia, porque lê
 * como "está tudo em dia".
 *
 * O que entra no lugar é o que existe: quem rodou no período, quem não rodou e
 * quem tem acesso ao painel.
 *
 * <h2>Sem registro não é indisponível</h2>
 *
 * 120 dos 132 motoristas não aparecem em trecho nenhum nos últimos 30 dias.
 * Isso NÃO significa que estão afastados: inclui folga, quem dirigiu sem se
 * identificar por tag e quem simplesmente ainda não teve dado coletado, já que
 * a coleta começou há poucos dias. Chamar isso de indisponibilidade daria uma
 * frota parada que não existe.
 */
function EquipeReal() {
  const queryClient = useQueryClient();
  const role = useSession()?.user.role;

  const [tab, setTab] = useState<TabId>('MOTORISTAS');
  /*
   * ⚠️ Guarda de TELA, e não de segurança: quem autoriza é a API, que exige
   * `team.manage` em cada uma destas rotas. Aqui o papel é a pista visual:
   * dono, gestor e super admin chegam a esta rota e podem iniciar a tratativa.
   * A API continua sendo a autoridade final e recusa qualquer escrita fora da
   * alçada do usuário.
   */
  const podeAdministrar = role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  const { data, isPending, isError } = useQuery({
    queryKey: ['equipe'],
    queryFn: () => fetchTeam(30),
  });

  /* Os ids de cargo nascem no provisionamento e são por empresa: o seletor sai
     desta lista, nunca de constante no código. */
  const cargos = useQuery({
    queryKey: ['cargos'],
    queryFn: fetchRoles,
    enabled: podeAdministrar,
  });

  /** Aberto com uma pessoa edita; aberto com `null` convida. */
  const [emEdicao, setEmEdicao] = useState<TeamMember | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [cadastroMotorista, setCadastroMotorista] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [motoristaParaAlternar, setMotoristaParaAlternar] = useState<TeamMember | null>(null);
  const [motoristaParaExcluir, setMotoristaParaExcluir] = useState<TeamMember | null>(null);

  const abrirDialogo = (pessoa: TeamMember | null) => {
    setEmEdicao(pessoa);
    setDialogoAberto(true);
  };

  const fecharDialogo = () => {
    setDialogoAberto(false);
    setEmEdicao(null);
  };

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['equipe'] });
  };

  const avisarErro = (causa: unknown, alternativa: string) => {
    toast.error(causa instanceof ApiError ? causa.message : alternativa);
  };

  const reenvio = useMutation({
    mutationFn: (pessoa: TeamMember) => resendTeamInvite(pessoa.id),
    onSuccess: (convite, pessoa) => {
      /* ⚠️ O link só volta quando a entrega por e-mail está desligada. Com ela
         ligada o campo é nulo, e um toast com descrição nula aparece vazio: quem
         reemitiu ficaria sem saber se funcionou. Sem link, o que informa é o
         destinatário. */
      if (convite.acceptUrl) {
        toast.success('Convite reemitido.', { description: convite.acceptUrl });
      } else {
        toast.success(
          pessoa.email ? `Convite enviado para ${pessoa.email}.` : 'Convite reemitido.',
        );
      }
      recarregar();
    },
    onError: (causa) => avisarErro(causa, 'Não foi possível reemitir o convite.'),
  });

  const desativacao = useMutation({
    mutationFn: (pessoa: TeamMember) => deactivateTeamMember(pessoa.id),
    onSuccess: () => {
      toast.success('Acesso desativado.');
      recarregar();
    },
    onError: (causa) => avisarErro(causa, 'Não foi possível desativar o acesso.'),
  });

  const alternarMotorista = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setDriverActive(id, active),
    onSuccess: (motorista) => {
      toast.success(`${motorista.name} foi ${motorista.active ? 'ativado' : 'inativado'}.`);
      setMotoristaParaAlternar(null);
      recarregar();
    },
    onError: (causa) => {
      avisarErro(causa, 'Não foi possível alterar o status do motorista.');
      setMotoristaParaAlternar(null);
    },
  });

  const excluirMotorista = useMutation({
    mutationFn: (id: string) => deleteDriver(id),
    onSuccess: () => {
      toast.success(`${motoristaParaExcluir?.name ?? 'O motorista'} foi excluído.`);
      setMotoristaParaExcluir(null);
      recarregar();
    },
    onError: (causa) => {
      avisarErro(causa, 'Não foi possível excluir o motorista.');
      setMotoristaParaExcluir(null);
    },
  });

  const statsDaOperacao: HeroStat[] = data
    ? [
        {
          key: 'quadro',
          label: 'Pessoas no quadro',
          value: data.headcount,
          hint: `${data.drivers} motoristas · ${data.staff} com acesso ao painel`,
          icon: UsersIcon,
        },
        {
          key: 'rodaram',
          label: 'Rodaram no período',
          value: data.driversActive,
          hint: 'com trecho registrado',
          icon: SteeringWheelIcon,
        },
        {
          /* Ver a nota do componente: isto NÃO é indisponibilidade. */
          key: 'sem-registro',
          label: 'Sem registro',
          value: data.driversWithoutRecord,
          hint: 'folga, sem tag ou sem coleta',
          icon: InfoIcon,
        },
        {
          key: 'acessos',
          label: 'Acessos ao painel',
          value: data.staff,
          hint: 'quem entra no sistema',
          icon: UserIcon,
        },
        {
          key: 'desativados',
          label: 'Acessos desativados',
          value: data.staffInactive,
          hint: 'tratado em Configurações',
          icon: LockIcon,
          tone: data.staffInactive > 0 ? 'warn' : 'neutral',
        },
      ]
    : [];

  const pessoas = data?.people ?? [];
  const motoristas = pessoas.filter((pessoa) => pessoa.kind === 'MOTORISTA');
  const equipeDeApoio = pessoas.filter((pessoa) => pessoa.kind === 'PAINEL');
  const pessoasDaAba = tab === 'MOTORISTAS' ? motoristas : equipeDeApoio;

  return (
    <>
      <HeroBand
        title="Equipe"
        description="Motoristas de um lado; gestão, operação e manutenção do outro. Cada pessoa no lugar certo."
      >
        {podeAdministrar ? (
          <button
            type="button"
            className={`${HERO_PILL} text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2`}
            onClick={() =>
              tab === 'MOTORISTAS'
                ? setCadastroMotorista({ open: true, id: null })
                : abrirDialogo(null)
            }
          >
            <PlusIcon size={15} aria-hidden="true" />
            {tab === 'MOTORISTAS' ? 'Cadastrar motorista' : 'Convidar pessoa'}
          </button>
        ) : null}
      </HeroBand>

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo do quadro</h2>

        <QueryState isPending={isPending} isError={isError} label="a equipe">
          {data ? (
            <>
              {/* A subida fica nos cards, e não na seção: em volta do
                  `QueryState` ela jogaria o carregamento e o erro por cima da
                  faixa colorida. */}
              <HeroStats items={statsDaOperacao} className="-mt-16 sm:-mt-20" />
              {/* RN-121: o número vem com a procedência colada nele. */}
              <p className="text-on-surface-muted text-label-sm mt-3 normal-case">
                Duas origens: cadastro da telemetria e cadastro do sistema.
              </p>
            </>
          ) : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="a equipe">
          <PageTabs
            tabs={[
              { id: 'MOTORISTAS', label: 'Motoristas', count: motoristas.length },
              { id: 'EQUIPE', label: 'Equipe de apoio', count: equipeDeApoio.length },
            ]}
            value={tab}
            onValueChange={setTab}
            label="Pessoas da equipe"
          >
            <div className="mb-5">
              <h2 className="font-sora text-on-light text-headline-md">
                {tab === 'MOTORISTAS' ? 'Motoristas' : 'Gestão, operação e manutenção'}
              </h2>
              <p className="text-on-light-muted text-body-sm mt-1">
                {tab === 'MOTORISTAS'
                  ? 'Quem dirige os veículos da frota.'
                  : 'Quem faz a operação acontecer fora da direção.'}
              </p>
            </div>
            <TeamRoster
              key={tab}
              people={pessoasDaAba}
              kind={tab === 'MOTORISTAS' ? 'MOTORISTA' : 'PAINEL'}
              {...(podeAdministrar
                ? {
                    onEditar: (pessoa: TeamMember) =>
                      pessoa.kind === 'MOTORISTA'
                        ? setCadastroMotorista({ open: true, id: pessoa.id })
                        : abrirDialogo(pessoa),
                    onReenviar: (pessoa: TeamMember) => reenvio.mutate(pessoa),
                    onDesativar: (pessoa: TeamMember) => desativacao.mutate(pessoa),
                    onAlternar: (pessoa: TeamMember) => setMotoristaParaAlternar(pessoa),
                    onExcluir: (pessoa: TeamMember) => setMotoristaParaExcluir(pessoa),
                  }
                : {})}
            />
          </PageTabs>

          {/* ⚠️ Escala, CNH e toxicológico são sobre MOTORISTA: na tela do dono,
              que só lista contas de painel, o bloco prometeria resolver uma
              ausência que ele nem está vendo. */}
          <div className="mt-6">
            <PendingSource
              title="Escala e documentação ainda não estão aqui"
              description="Saber quem pode assumir viagem hoje exige escala e documento em dia. A telemetria diz quem dirigiu, e não quem está apto a dirigir."
              requirements={[
                'CNH com categoria e vencimento, que vem do RH e não do rastreador',
                'Escala de trabalho, folga e afastamento',
                'Exame toxicológico e curso obrigatório, quando a operação exigir',
                'Segundo fator no acesso ao painel, que ainda não foi implementado',
              ]}
              meanwhile={[
                { label: 'Motoristas da equipe', to: '/gestao/equipe' },
                { label: 'Ranking de condução', to: '/gestao/desempenho' },
                { label: 'Papéis e acesso', to: '/gestao/configuracoes' },
              ]}
            />
          </div>
        </QueryState>
      </PageContent>

      <GlassModal
        open={dialogoAberto}
        onOpenChange={(aberto) => (aberto ? setDialogoAberto(true) : fecharDialogo())}
        title={emEdicao ? `Conta de ${emEdicao.name}` : 'Convidar para a equipe'}
        description={
          emEdicao
            ? 'Nome, e-mail e cargo. Trocar o cargo encerra a sessão da pessoa.'
            : 'A pessoa recebe um link para criar a própria senha.'
        }
      >
        {/* A chave remonta o formulário a cada abertura: sem ela, o estado da
            pessoa anterior sobreviveria à troca. */}
        <MemberDialog
          key={emEdicao?.id ?? 'novo'}
          member={emEdicao}
          roles={cargos.data ?? []}
          onClose={fecharDialogo}
          onSaved={recarregar}
        />
      </GlassModal>

      <DriverRegistrationModal
        open={cadastroMotorista.open}
        driverId={cadastroMotorista.id}
        onOpenChange={(open) =>
          setCadastroMotorista({ open, id: open ? cadastroMotorista.id : null })
        }
      />

      <ConfirmarStatusMotorista
        motorista={motoristaParaAlternar}
        pending={alternarMotorista.isPending}
        onCancel={() => setMotoristaParaAlternar(null)}
        onConfirm={() => {
          if (motoristaParaAlternar) {
            alternarMotorista.mutate({
              id: motoristaParaAlternar.id,
              active: !motoristaParaAlternar.active,
            });
          }
        }}
      />

      <ConfirmarExclusaoMotorista
        motorista={motoristaParaExcluir}
        pending={excluirMotorista.isPending}
        onCancel={() => setMotoristaParaExcluir(null)}
        onConfirm={() => motoristaParaExcluir && excluirMotorista.mutate(motoristaParaExcluir.id)}
      />
    </>
  );
}

function ConfirmarStatusMotorista({
  motorista,
  pending,
  onCancel,
  onConfirm,
}: {
  motorista: TeamMember | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ativando = motorista != null && !motorista.active;

  return (
    <GlassModal
      open={motorista != null}
      onOpenChange={(open) => !open && onCancel()}
      title={ativando ? 'Ativar motorista' : 'Inativar motorista'}
      className="w-[calc(100vw-2rem)] max-w-[460px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-surface text-body-md">
          {ativando ? 'Ativar ' : 'Inativar '}
          <strong>{motorista?.name}</strong>?
          {ativando
            ? ' A pessoa volta a aparecer nas listas de motorista ativo.'
            : ' O histórico é preservado; apenas deixa de aparecer nas listas de motorista ativo.'}
        </p>
        <div className="flex justify-end gap-2">
          <SpectrumButton type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="button" onClick={onConfirm} disabled={pending}>
            {pending ? (ativando ? 'Ativando…' : 'Inativando…') : ativando ? 'Ativar' : 'Inativar'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}

function ConfirmarExclusaoMotorista({
  motorista,
  pending,
  onCancel,
  onConfirm,
}: {
  motorista: TeamMember | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <GlassModal
      open={motorista != null}
      onOpenChange={(open) => !open && onCancel()}
      title="Excluir motorista"
      className="w-[calc(100vw-2rem)] max-w-[480px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-surface text-body-md">
          Excluir <strong>{motorista?.name}</strong>? Essa ação não pode ser desfeita.
        </p>
        <Alert severity="warning">
          Só é possível excluir um cadastro sem vínculo. Para quem já tem viagens, eventos ou
          veículo associado, use inativar e preserve o histórico.
        </Alert>
        <div className="flex justify-end gap-2">
          <SpectrumButton type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Excluindo…' : 'Excluir'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}

function EquipeSimulada() {
  const [tab, setTab] = useState<TabId>('MOTORISTAS');
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
          if (tab === 'EQUIPE' && person.kind !== 'PAINEL') return false;
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
          return a.name.localeCompare(b.name, 'pt-BR');
        })
    );
  }, [people, tab, term]);

  const counts = useMemo(
    () => ({
      MOTORISTAS: people.filter((person) => person.kind === 'MOTORISTA').length,
      EQUIPE: people.filter((person) => person.kind === 'PAINEL').length,
    }),
    [people],
  );

  const personKey = (person: TeamPerson) => `${person.kind}-${person.id}`;

  const stats: HeroStat[] = data
    ? [
        {
          key: 'quadro',
          label: 'Pessoas no quadro',
          value: data.headcount,
          hint: `${data.drivers} motoristas · ${data.staff} com acesso ao painel`,
          icon: UsersIcon,
        },
        {
          key: 'disponiveis',
          label: 'Disponíveis agora',
          value: data.driversAvailable,
          hint: 'podem assumir viagem',
          icon: SteeringWheelIcon,
        },
        {
          key: 'indisponiveis',
          label: 'Indisponíveis',
          value: data.driversUnavailable,
          hint: 'descanso ou afastamento',
          icon: InfoIcon,
          tone: data.driversUnavailable > 0 ? 'warn' : 'neutral',
        },
        {
          key: 'cnh',
          label: 'CNH a vencer',
          value: data.cnhExpiringSoon,
          hint: 'nos próximos 60 dias',
          icon: IdCardIcon,
          tone: data.cnhExpiringSoon > 0 ? 'warn' : 'neutral',
        },
        {
          key: 'mfa',
          label: 'Acesso sem MFA',
          value: data.withoutMfa,
          hint: 'tratado em Configurações',
          icon: LockIcon,
          tone: data.withoutMfa > 0 ? 'warn' : 'neutral',
        },
      ]
    : [];

  return (
    <>
      <HeroBand
        title="Equipe"
        description="Quem trabalha na operação, o que cada um faz e quem pode assumir viagem hoje."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo do quadro</h2>

        <QueryState isPending={isPending} isError={isError} label="a equipe">
          {data ? (
            <>
              {/* A subida fica nos cards, e não na seção: em volta do
                  `QueryState` ela jogaria o carregamento e o erro por cima da
                  faixa colorida. */}
              <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
              {/* RN-121: o número vem com a procedência colada nele. */}
              <p className="text-on-surface-muted text-label-sm mt-3 normal-case">
                Cadastro de motoristas e usuários do painel.
              </p>
            </>
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
            {/*
             * ⚠️ Sem `LightCard` em volta (08/09/2026): é CARTÃO DENTRO DE CARTÃO.
             *
             * Ele envolvia o conteúdo inteiro da aba, e esse conteúdo é uma grade
             * de `PersonCard`, que já são cartões. Somando o painel branco da
             * página, eram três molduras encaixadas para uma lista só, cada uma
             * cobrando o próprio padding.
             *
             * ⚠️ Não é que ele sumisse: o `LightCard` tem sombra e se destaca. O
             * problema é ele não separar nada, porque não divide a tela com
             * ninguém. Onde o `LightCard` continua certo é como UMA das colunas
             * de um master-detail (ver os painéis de detalhe), que é quando a
             * moldura de fato distingue duas coisas.
             *
             * O título "Quadro" saiu junto: a faixa já diz "Equipe", as abas já
             * dizem o recorte. Era o terceiro rótulo para a mesma lista.
             */}
            <div className="mb-5">
              {/* ⚠️ `on-light-muted` no placeholder, e não `placeholder`: aquele é
                  o token da família do papel, e aqui o campo vive no painel
                  branco. Mesmo poço da busca da frota. */}
              <div className="rounded-pill focus-within:border-primary bg-light-container border-light-outline flex min-w-0 items-center gap-2 border px-4 sm:max-w-80">
                <SearchIcon size={18} className="text-on-light-muted shrink-0" aria-hidden="true" />
                <label htmlFor="team-search" className="sr-only">
                  Buscar por nome, função, placa ou e-mail
                </label>
                <input
                  id="team-search"
                  type="search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Nome, função ou placa"
                  className="text-body-md text-on-light placeholder:text-on-light-muted h-11 w-full bg-transparent focus:outline-none"
                />
              </div>
            </div>

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

            {/* ⚠️ `mt-8`, e não `mt-auto`: o `mt-auto` empurrava para o rodapé da
                coluna flex do `LightCard`, que não existe mais. */}
            <p className="text-on-light-muted text-label-md mt-8 normal-case">
              {tab === 'MOTORISTAS'
                ? 'Ficha, advertências e histórico de direção ficam reunidos nesta lista.'
                : 'Papéis e acesso são gerenciados por quem tem permissão para administrar a equipe.'}
            </p>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
