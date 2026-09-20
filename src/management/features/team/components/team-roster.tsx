import {
  DeleteIcon,
  EditIcon,
  IdCardIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  SteeringWheelIcon,
  UsersIcon,
  PowerIcon,
  SearchIcon,
  TruckIcon,
} from '@/components/icons';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import type { TeamMember } from '@/management/lib/fleet-api';
import {
  GlassInput,
  GlassSelect,
  Pagination,
  SpectrumButton,
  StatusChip,
  Avatar,
  cn,
} from '@/management/ui';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

/**
 * O quadro de pessoas, com as duas origens visíveis.
 *
 * ⚠️ Motorista e usuário de painel NÃO são a mesma coisa e não têm as mesmas
 * colunas. O motorista vem da telemetria e traz quilometragem; o usuário vem do
 * nosso banco e traz papel e e-mail. Uma tabela com as colunas de um preenchidas
 * com travessão para o outro leria como dado faltando, quando é dado que não se
 * aplica.
 *
 * Por isso a coluna do meio muda de significado conforme a linha, e o rótulo ao
 * lado do nome diz qual das duas naturezas é.
 */

const PAPEL_LABEL: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gestor',
  OPERATOR: 'Operador',
  MAINTENANCE: 'Manutenção',
  DRIVER: 'Motorista',
  SUPER_ADMIN: 'Administração',
};

const numero = (valor: number | undefined) =>
  valor == null ? '–' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/** Valor de "sem recorte". Sentinela, e não string vazia: o Radix não aceita. */
const TODOS = 'TODOS';

/**
 * Trinta por página, o mesmo `PAGE_SIZE` do resto do painel.
 *
 * ⚠️ Eram cem, escolhidos quando o quadro era uma LISTA de linhas baixas, onde
 * rolar custava menos que trocar de página. Em cartão a conta virou: cem
 * cartões são vinte e cinco fileiras, e a pessoa perde a noção de tamanho que a
 * paginação existe para dar (decisão do usuário em 18/09/2026).
 */
const POR_PAGINA = 30;

/**
 * A situação é sobre ATIVIDADE, e vale só para motorista.
 *
 * ⚠️ "Rodou no período" sai da telemetria, e conta de painel não roda: oferecer
 * isto num quadro só de acesso devolveria lista vazia sempre, e filtro que nunca
 * acha nada lê como defeito.
 */
const SITUACOES = [
  { value: TODOS, label: 'Qualquer situação' },
  { value: 'RODOU', label: 'Rodou no período' },
  { value: 'SEM_REGISTRO', label: 'Sem registro' },
];

/**
 * O recorte por CADASTRO, que é outro eixo e por isso é outro seletor.
 *
 * ⚠️ **O padrão é `ATIVOS`** (decisão do usuário em 18/09/2026, a mesma do
 * Pátio): quem abre a tela quer o time que trabalha hoje, e não o histórico de
 * quem já passou pela empresa. Inativo continua alcançável escolhendo aqui,
 * porque some da tela não pode virar some do sistema.
 *
 * ⚠️ Não se mistura com a Situação acima: um motorista inativo continua tendo um
 * histórico de percursos, então juntar os dois obrigaria a escolher entre ver
 * "inativos" e ver "rodou no período".
 */
const CADASTROS = [
  { value: 'ATIVOS', label: 'Somente ativos' },
  { value: 'INATIVOS', label: 'Somente inativos' },
  { value: TODOS, label: 'Ativos e inativos' },
];

export interface TeamRosterProps {
  people: TeamMember[];
  className?: string | undefined;
  /** A aba dona do conjunto. Evita oferecer filtro de acesso para motorista e vice-versa. */
  kind?: 'MOTORISTA' | 'PAINEL' | undefined;
  /**
   * A lista é só de contas de painel, e os filtros acompanham.
   *
   * ⚠️ Filial vem do cadastro do FORNECEDOR e só existe em motorista, e
   * "rodou no período" é da telemetria: num quadro sem motorista, os dois
   * devolveriam lista vazia sempre. Filtro que nunca acha nada lê como defeito.
   */
  somentePainel?: boolean | undefined;
  /**
   * As três ações de conta, quando quem olha pode administrar a equipe.
   *
   * ⚠️ Valem só para a linha de PAINEL: motorista vem da telemetria e não tem
   * conta para editar aqui. Ausentes, a coluna de ações nem aparece, que é o
   * caso de quem só enxerga o quadro.
   */
  onEditar?: ((pessoa: TeamMember) => void) | undefined;
  onReenviar?: ((pessoa: TeamMember) => void) | undefined;
  onDesativar?: ((pessoa: TeamMember) => void) | undefined;
  onAlternar?: ((pessoa: TeamMember) => void) | undefined;
  onExcluir?: ((pessoa: TeamMember) => void) | undefined;
}

export function TeamRoster({
  people,
  className,
  kind,
  somentePainel = false,
  onEditar,
  onReenviar,
  onDesativar,
  onAlternar,
  onExcluir,
}: TeamRosterProps) {
  const soMotoristas = kind === 'MOTORISTA';
  const soPainel = kind === 'PAINEL' || somentePainel;
  const comAcoes = Boolean(onEditar ?? onReenviar ?? onDesativar ?? onAlternar ?? onExcluir);
  const [busca, setBusca] = useState('');
  const [filial, setFilial] = useState(TODOS);
  const [situacao, setSituacao] = useState(TODOS);
  /* Ver a nota em `CADASTROS`: a tela abre mostrando só quem está ativo. */
  const [cadastro, setCadastro] = useState('ATIVOS');
  const [pagina, setPagina] = useState(1);

  /* As opções saem do próprio quadro: oferecer uma filial sem ninguém é
     oferecer uma lista vazia. */
  const opcoesFilial = useMemo(
    () => [
      { value: TODOS, label: 'Todas as filiais' },
      ...[...new Set(people.flatMap((pessoa) => (pessoa.unit ? [pessoa.unit] : [])))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((valor) => ({ value: valor, label: valor })),
    ],
    [people],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return people.filter((pessoa) => {
      if (
        termo &&
        ![pessoa.name, pessoa.unit ?? '', pessoa.email ?? '', pessoa.currentVehiclePlate ?? '']
          .join(' ')
          .toLowerCase()
          .includes(termo)
      ) {
        return false;
      }

      if (filial !== TODOS && pessoa.unit !== filial) return false;

      /* O recorte por cadastro vale para as duas naturezas: motorista desligado
         e conta desativada somem juntos do padrão da tela. */
      if (cadastro === 'ATIVOS' && !pessoa.active) return false;
      if (cadastro === 'INATIVOS' && pessoa.active) return false;

      /* ⚠️ Estas duas são da telemetria e só existem em motorista. */
      if (situacao === 'RODOU') return pessoa.kind === 'MOTORISTA' && (pessoa.journeys ?? 0) > 0;
      if (situacao === 'SEM_REGISTRO') {
        return pessoa.kind === 'MOTORISTA' && (pessoa.journeys ?? 0) === 0;
      }

      return true;
    });
  }, [people, busca, filial, situacao, cadastro]);

  /* A página é presa ao total durante o render: filtrar na página 2 de uma
     lista que passou a ter 30 deixaria a tela vazia. */
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  /* `cadastro` é comparado com o PADRÃO, e não com "todos": abrir a tela já é um
     recorte, e contá-lo sempre deixaria o "Limpar filtros" aceso desde o
     primeiro segundo, sem nada para limpar. */
  const filtrando = busca !== '' || filial !== TODOS || situacao !== TODOS || cadastro !== 'ATIVOS';

  const limparFiltros = () => {
    setBusca('');
    setFilial(TODOS);
    setSituacao(TODOS);
    setCadastro('ATIVOS');
    setPagina(1);
  };

  /**
   * Os indicadores da aba, que também são filtro.
   *
   * ⚠️ **A contagem sai do MESMO conjunto que a lista usa** (pedido do usuário
   * em 18/09/2026, espelhando o Pátio). Contar sobre `people` cru daria um
   * cartão dizendo 113 e uma lista mostrando 71, e ao clicar nele a tela
   * mudaria para um terceiro número. O escopo aqui é `people` já recortado por
   * FILIAL, que é o único filtro que não tem cartão próprio; busca, situação e
   * cadastro são justamente o que os cartões trocam.
   *
   * ⚠️ Eles mudam com a aba, e não por enfeite: "rodou no período" sai da
   * telemetria e não existe em conta de painel, e "acesso desativado" não existe
   * em motorista. Um cartão que nunca sai do zero ensina a ignorar a fileira.
   */
  const escopo = useMemo(
    () => people.filter((pessoa) => filial === TODOS || pessoa.unit === filial),
    [people, filial],
  );

  const indicadores: HeroStat[] = useMemo(() => {
    const ativos = escopo.filter((p) => p.active);
    const trocar = (proximaSituacao: string, proximoCadastro: string) => () => {
      setSituacao(proximaSituacao);
      setCadastro(proximoCadastro);
      setBusca('');
      setPagina(1);
    };

    if (soPainel) {
      return [
        {
          key: 'contas',
          label: 'Contas no painel',
          value: ativos.length,
          hint: 'quem entra no sistema',
          icon: UsersIcon,
          onSelect: trocar(TODOS, 'ATIVOS'),
          selected: cadastro === 'ATIVOS',
        },
        {
          key: 'desativadas',
          label: 'Acessos desativados',
          value: escopo.length - ativos.length,
          hint: 'sem entrar no painel',
          icon: LockIcon,
          tone: escopo.length - ativos.length > 0 ? 'warn' : 'neutral',
          onSelect: trocar(TODOS, 'INATIVOS'),
          selected: cadastro === 'INATIVOS',
        },
        {
          key: 'todas',
          label: 'Todas as contas',
          value: escopo.length,
          hint: 'ativas e desativadas',
          icon: IdCardIcon,
          onSelect: trocar(TODOS, TODOS),
          selected: cadastro === TODOS,
        },
      ];
    }

    const rodaram = ativos.filter((p) => (p.journeys ?? 0) > 0).length;
    return [
      {
        key: 'motoristas',
        label: 'Motoristas ativos',
        value: ativos.length,
        hint: 'no quadro hoje',
        icon: UsersIcon,
        onSelect: trocar(TODOS, 'ATIVOS'),
        selected: cadastro === 'ATIVOS' && situacao === TODOS,
      },
      {
        key: 'rodaram',
        label: 'Rodaram no período',
        value: rodaram,
        hint: 'com trecho registrado',
        icon: SteeringWheelIcon,
        onSelect: trocar('RODOU', 'ATIVOS'),
        selected: situacao === 'RODOU',
      },
      {
        /* Ver a nota do componente: isto NÃO é indisponibilidade. */
        key: 'sem-registro',
        label: 'Sem registro',
        value: ativos.length - rodaram,
        hint: 'folga, sem tag ou sem coleta',
        icon: InfoIcon,
        onSelect: trocar('SEM_REGISTRO', 'ATIVOS'),
        selected: situacao === 'SEM_REGISTRO',
      },
      {
        key: 'inativos',
        label: 'Desligados',
        value: escopo.length - ativos.length,
        hint: 'fora do quadro',
        icon: LockIcon,
        onSelect: trocar(TODOS, 'INATIVOS'),
        selected: cadastro === 'INATIVOS',
      },
    ];
  }, [escopo, soPainel, cadastro, situacao]);

  return (
    /*
     * ⚠️ Sem `LightCard` em volta (08/09/2026): é CARTÃO DENTRO DE CARTÃO. O
     * quadro já mora no painel branco da página, e esta moldura não separava
     * nada, porque não dividia a tela com ninguém.
     *
     * ⚠️ Não é que ele sumisse: o `LightCard` tem sombra. Onde ele continua
     * certo é como UMA das colunas de um master-detail (ver os painéis de
     * detalhe), que é quando a moldura de fato distingue duas coisas.
     *
     * O título "Quadro" saiu junto: a faixa já diz "Equipe" e os filtros vêm
     * logo abaixo. Era o segundo rótulo para a mesma lista.
     */
    <div className={className}>
      {/* Os indicadores da aba vêm antes dos filtros, como no Pátio: primeiro o
          número que resume, depois o que recorta. Eles também SÃO filtro. */}
      <HeroStats items={indicadores} className="mb-5" />

      {/* ⚠️ `surface="light"`: os campos moram dentro do painel branco, e a
          versão escura deles inverte a hierarquia da tela. */}
      {/* A busca fica com o dobro da largura dos seletores, e o número de
          colunas acompanha quantos campos a aba tem: motorista leva filial e
          situação, conta de painel não leva nenhum dos dois. */}
      <div
        className={cn(
          'mb-4 grid items-end gap-3',
          soPainel
            ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]',
        )}
      >
        <GlassInput
          surface="light"
          label="Buscar"
          placeholder={
            soPainel
              ? 'Nome, cargo ou e-mail'
              : soMotoristas
                ? 'Nome, filial ou placa'
                : 'Nome, filial, placa ou e-mail'
          }
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          leading={<SearchIcon size={16} aria-hidden="true" />}
        />

        {soPainel ? null : (
          <GlassSelect
            surface="light"
            label="Filial"
            options={opcoesFilial}
            value={filial}
            onValueChange={setFilial}
          />
        )}

        {soPainel ? null : (
          <GlassSelect
            surface="light"
            label="Situação"
            options={SITUACOES}
            value={situacao}
            onValueChange={setSituacao}
          />
        )}

        <GlassSelect
          surface="light"
          label="Cadastro"
          options={CADASTROS}
          value={cadastro}
          onValueChange={setCadastro}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-on-light-muted text-label-md normal-case">
          {visiveis.length === people.length
            ? `${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`
            : `${visiveis.length} de ${people.length} pessoas`}
          {soPainel ? ' com acesso ao painel' : ''}
        </p>

        {filtrando ? (
          <SpectrumButton type="button" variant="ghost" size="sm" onClick={limparFiltros}>
            Limpar filtros
          </SpectrumButton>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">
          Ninguém encontrado com esses filtros.
        </p>
      ) : (
        /* ⚠️ Até 4 por fileira desde 18/09/2026, a pedido do usuário, contra as
           3 de antes: o cartão encolheu e a tela cabe mais gente sem rolar. A
           grade segue a do Pátio, que é a referência das duas telas. */
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {daPagina.map((pessoa) => (
            <TeamCard
              key={`${pessoa.kind}-${pessoa.id}`}
              pessoa={pessoa}
              comAcoes={comAcoes}
              onEditar={onEditar}
              onReenviar={onReenviar}
              onDesativar={onDesativar}
              onAlternar={onAlternar}
              onExcluir={onExcluir}
            />
          ))}
        </ul>
      )}

      <Pagination
        className="mt-5"
        page={paginaAtual}
        total={visiveis.length}
        pageSize={POR_PAGINA}
        onPageChange={setPagina}
        label="pessoas"
      />

      {/* A nota sobre as duas origens saiu em 18/09/2026, a pedido do usuário:
          as abas já separam motorista de conta de painel, e o rótulo embaixo do
          nome de cada pessoa repete a natureza em cada cartão. */}
    </div>
  );
}

function TeamCard({
  pessoa,
  comAcoes,
  onEditar,
  onReenviar,
  onDesativar,
  onAlternar,
  onExcluir,
}: {
  pessoa: TeamMember;
  comAcoes: boolean;
  onEditar?: ((pessoa: TeamMember) => void) | undefined;
  onReenviar?: ((pessoa: TeamMember) => void) | undefined;
  onDesativar?: ((pessoa: TeamMember) => void) | undefined;
  onAlternar?: ((pessoa: TeamMember) => void) | undefined;
  onExcluir?: ((pessoa: TeamMember) => void) | undefined;
}) {
  const navigate = useNavigate();
  const motorista = pessoa.kind === 'MOTORISTA';
  const rodou = (pessoa.journeys ?? 0) > 0;
  const abrirFicha = () => navigate(`/gestao/equipe/motoristas/${pessoa.id}`);

  return (
    /*
     * ⚠️ **O cartão do motorista leva à ficha MESMO com as ações no rodapé**
     * (pedido do usuário em 18/09/2026), como o cartão do Pátio faz. Antes o
     * clique só valia quando não havia ações, então o gestor, que é justamente
     * quem administra, era o único que não conseguia abrir a ficha clicando.
     * Quem separa os dois gestos é o `stopPropagation` de cada botão.
     */
    <li
      {...(motorista
        ? {
            role: 'button',
            tabIndex: 0,
            /* ⚠️ O rótulo existe porque a LINHA "Abrir ficha do motorista" saiu
               do corpo em 19/09/2026, a pedido do usuário. Era ela que dizia o
               que o cartão faz; sem rótulo, o leitor de tela anunciaria só o
               nome e os números e ninguém saberia que o cartão abre alguma
               coisa. */
            'aria-label': `Abrir ficha de ${pessoa.name}`,
            onClick: abrirFicha,
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                abrirFicha();
              }
            },
          }
        : {})}
      className={cn(
        /* ⚠️ `bg-light`, e não o poço: o cartão passou a ser papel branco sobre
           a folha, igual ao do Pátio, e o contorno é que o separa do fundo. */
        'bg-light border-light-outline hover:border-primary-on-light/30 min-w-0 rounded-xl border p-3 transition-colors',
        motorista &&
          'focus-visible:ring-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={pessoa.name} className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-on-light truncate font-semibold">{pessoa.name}</p>
          <p className="text-on-light-muted text-label-md truncate normal-case">
            {motorista ? 'Motorista' : (PAPEL_LABEL[pessoa.role ?? ''] ?? 'Equipe de apoio')}
          </p>
        </div>
        {motorista ? (
          <StatusChip tone={pessoa.active && rodou ? 'positive' : 'neutral'} surface="light">
            {pessoa.active ? (rodou ? 'Em atividade' : 'Sem registro') : 'Inativo'}
          </StatusChip>
        ) : (
          <StatusChip tone={pessoa.active ? 'positive' : 'neutral'} surface="light">
            {pessoa.active ? 'Ativo' : 'Inativo'}
          </StatusChip>
        )}
      </div>

      {motorista ? (
        <>
          <dl className="border-light-outline mt-3 grid grid-cols-2 gap-3 border-y py-2.5">
            <div>
              <dt className="text-on-light-muted text-label-sm normal-case">No período</dt>
              <dd className="text-on-light text-body-sm tabular">{numero(pessoa.distanceKm)} km</dd>
            </div>
            <div>
              <dt className="text-on-light-muted text-label-sm normal-case">Percursos</dt>
              <dd className="text-on-light text-body-sm tabular">{pessoa.journeys ?? 0}</dd>
            </div>
          </dl>
          <p className="text-on-light-variant text-label-md mt-2.5 flex items-center gap-1.5 normal-case">
            <TruckIcon size={14} className="text-on-light-muted" aria-hidden="true" />
            {pessoa.currentVehiclePlate ?? pessoa.unit ?? 'Sem veículo identificado'}
          </p>
          {pessoa.criticalEvents ? (
            <p className="text-error-on-light text-label-md mt-1.5 normal-case">
              {pessoa.criticalEvents}{' '}
              {pessoa.criticalEvents === 1 ? 'evento crítico' : 'eventos críticos'}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-on-light-variant text-body-sm mt-3 truncate">
            {pessoa.email ?? 'E-mail não informado'}
          </p>
          <p className="text-on-light-muted text-label-md mt-1.5 normal-case">
            {pessoa.lastSeenAt
              ? `Último acesso em ${dia.format(new Date(pessoa.lastSeenAt))}`
              : 'Ainda não acessou'}
          </p>
        </>
      )}

      {comAcoes ? (
        /* ⚠️ A seta de "abrir ficha" saiu daqui em 18/09/2026: o cartão inteiro
           passou a levar à ficha, e um botão que repete o que o corpo já faz só
           gasta a barra de ações. Quem anuncia o destino hoje é o `aria-label`
           do cartão, porque o texto que fazia isso saiu em 19/09/2026. */
        <div className="border-light-outline acoes-divididas mt-3 flex items-center justify-end gap-1.5 border-t pt-2.5">
          {onEditar ? (
            <button
              type="button"
              className="acao-editar"
              onClick={(event) => {
                event.stopPropagation();
                onEditar(pessoa);
              }}
              aria-label={`Editar cadastro de ${pessoa.name}`}
            >
              <EditIcon size={17} />
            </button>
          ) : null}
          {motorista && onAlternar ? (
            <button
              type="button"
              className={pessoa.active ? 'acao-excluir' : 'acao-ativar'}
              onClick={(event) => {
                event.stopPropagation();
                onAlternar(pessoa);
              }}
              aria-label={`${pessoa.active ? 'Inativar' : 'Ativar'} motorista ${pessoa.name}`}
              title={pessoa.active ? 'Inativar motorista' : 'Ativar motorista'}
            >
              <PowerIcon size={17} />
            </button>
          ) : null}
          {motorista && onExcluir ? (
            <button
              type="button"
              className="acao-excluir"
              onClick={(event) => {
                event.stopPropagation();
                onExcluir(pessoa);
              }}
              aria-label={`Excluir cadastro de ${pessoa.name}`}
              title="Excluir cadastro"
            >
              <DeleteIcon size={17} />
            </button>
          ) : null}
          {!motorista && !pessoa.active && onReenviar ? (
            <button
              type="button"
              className="acao-neutra"
              onClick={(event) => {
                event.stopPropagation();
                onReenviar(pessoa);
              }}
              aria-label={`Reenviar o convite de ${pessoa.name}`}
            >
              <MailIcon size={17} />
            </button>
          ) : null}
          {!motorista && pessoa.active && onDesativar ? (
            <button
              type="button"
              className="acao-excluir"
              onClick={(event) => {
                event.stopPropagation();
                onDesativar(pessoa);
              }}
              aria-label={`Desativar o acesso de ${pessoa.name}`}
            >
              <PowerIcon size={17} />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
