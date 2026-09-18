import {
  ArrowRightIcon,
  DeleteIcon,
  EditIcon,
  InfoIcon,
  MailIcon,
  PowerIcon,
  SearchIcon,
  TruckIcon,
} from '@/components/icons';
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
 * Cem por página, como na lista de percursos.
 *
 * A linha é baixa e a leitura é de varredura: rolar cem custa menos que trocar
 * de página quatro vezes para achar uma pessoa.
 */
const POR_PAGINA = 100;

/** As duas que valem para conta de painel. Ver `somentePainel`. */
const SITUACOES_DE_ACESSO = [
  { value: TODOS, label: 'Qualquer situação' },
  { value: 'ATIVO', label: 'Acesso ativo' },
  { value: 'DESATIVADO', label: 'Acesso desativado' },
];

const SITUACOES = [
  { value: TODOS, label: 'Qualquer situação' },
  { value: 'RODOU', label: 'Rodou no período' },
  { value: 'SEM_REGISTRO', label: 'Sem registro' },
  { value: 'ATIVO', label: 'Acesso ativo' },
  { value: 'DESATIVADO', label: 'Acesso desativado' },
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

      /* ⚠️ As quatro situações não são o mesmo eixo: "rodou" é do motorista e
         "acesso ativo" é de quem entra no painel. Um filtro que misturasse os
         dois devolveria sempre a lista inteira. */
      if (situacao === 'RODOU') return pessoa.kind === 'MOTORISTA' && (pessoa.journeys ?? 0) > 0;
      if (situacao === 'SEM_REGISTRO') {
        return pessoa.kind === 'MOTORISTA' && (pessoa.journeys ?? 0) === 0;
      }
      if (situacao === 'ATIVO') return pessoa.kind === 'PAINEL' && pessoa.active;
      if (situacao === 'DESATIVADO') return pessoa.kind === 'PAINEL' && !pessoa.active;

      return true;
    });
  }, [people, busca, filial, situacao]);

  /* A página é presa ao total durante o render: filtrar na página 2 de uma
     lista que passou a ter 30 deixaria a tela vazia. */
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const filtrando = busca !== '' || filial !== TODOS || situacao !== TODOS;

  const limparFiltros = () => {
    setBusca('');
    setFilial(TODOS);
    setSituacao(TODOS);
    setPagina(1);
  };

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
      {/* ⚠️ `surface="light"`: os campos moram dentro do painel branco, e a
          versão escura deles inverte a hierarquia da tela. */}
      <div className="mb-4 grid items-end gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
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

        <GlassSelect
          surface="light"
          label="Situação"
          options={
            soPainel ? SITUACOES_DE_ACESSO : soMotoristas ? SITUACOES.slice(0, 3) : SITUACOES
          }
          value={situacao}
          onValueChange={setSituacao}
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <p className="text-on-light-muted text-label-md mt-4 flex items-start gap-1.5 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Motorista vem do cadastro da telemetria; acesso ao painel vem do cadastro do sistema. São
        listas diferentes e quase não se cruzam.
      </p>
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
    <li
      {...(motorista && !comAcoes
        ? {
            role: 'button',
            tabIndex: 0,
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
        'bg-light-container border-light-outline hover:border-primary-on-light/30 min-w-0 rounded-xl border p-4 transition-colors',
        motorista &&
          'focus-visible:ring-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={pessoa.name} className="size-11 shrink-0" />
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
          <dl className="border-light-outline mt-4 grid grid-cols-2 gap-3 border-y py-3">
            <div>
              <dt className="text-on-light-muted text-label-sm normal-case">No período</dt>
              <dd className="text-on-light text-body-sm tabular">{numero(pessoa.distanceKm)} km</dd>
            </div>
            <div>
              <dt className="text-on-light-muted text-label-sm normal-case">Percursos</dt>
              <dd className="text-on-light text-body-sm tabular">{pessoa.journeys ?? 0}</dd>
            </div>
          </dl>
          <p className="text-on-light-variant text-label-md mt-3 flex items-center gap-1.5 normal-case">
            <TruckIcon size={14} className="text-on-light-muted" aria-hidden="true" />
            {pessoa.currentVehiclePlate ?? pessoa.unit ?? 'Sem veículo identificado'}
          </p>
          {pessoa.criticalEvents ? (
            <p className="text-error-on-light text-label-md mt-1.5 normal-case">
              {pessoa.criticalEvents}{' '}
              {pessoa.criticalEvents === 1 ? 'evento crítico' : 'eventos críticos'}
            </p>
          ) : null}
          <p className="text-accent text-label-md mt-4 normal-case">Abrir ficha do motorista</p>
        </>
      ) : (
        <>
          <p className="text-on-light-variant text-body-sm mt-4 truncate">
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
        <div className="border-light-outline mt-4 flex items-center justify-end gap-1 border-t pt-3">
          {motorista ? (
            <button
              type="button"
              className="acao-neutra mr-auto"
              onClick={abrirFicha}
              aria-label={`Abrir ficha de ${pessoa.name}`}
              title="Abrir ficha"
            >
              <ArrowRightIcon size={16} />
            </button>
          ) : null}
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
              <EditIcon size={16} />
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
              <PowerIcon size={16} />
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
              <DeleteIcon size={16} />
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
              <MailIcon size={16} />
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
              <PowerIcon size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
