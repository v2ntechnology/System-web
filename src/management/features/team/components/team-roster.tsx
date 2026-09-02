import { InfoIcon, SearchIcon } from '@/components/icons';
import type { TeamMember } from '@/management/lib/fleet-api';
import {
  GlassInput,
  GlassSelect,
  LightCard,
  Pagination,
  SpectrumButton,
  StatusChip,
  cn,
} from '@/management/ui';
import { useMemo, useState } from 'react';

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
}

export function TeamRoster({ people, className }: TeamRosterProps) {
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
    <LightCard title="Quadro" className={className}>
      {/* ⚠️ `surface="light"`: os campos moram dentro do painel branco, e a
          versão escura deles inverte a hierarquia da tela. */}
      <div className="mb-4 grid items-end gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
        <GlassInput
          surface="light"
          label="Buscar"
          placeholder="Nome, filial, placa ou e-mail"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          leading={<SearchIcon size={16} aria-hidden="true" />}
        />

        <GlassSelect
          surface="light"
          label="Filial"
          options={opcoesFilial}
          value={filial}
          onValueChange={setFilial}
        />

        <GlassSelect
          surface="light"
          label="Situação"
          options={SITUACOES}
          value={situacao}
          onValueChange={setSituacao}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-on-light-muted text-label-md normal-case">
          {visiveis.length === people.length
            ? `${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`
            : `${visiveis.length} de ${people.length} pessoas`}
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
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr className="text-on-light-muted text-label-md normal-case">
                <th scope="col" className="py-2 pl-3 text-left font-normal">
                  Pessoa
                </th>
                <th scope="col" className="py-2 text-left font-normal">
                  Onde
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  No período
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Situação
                </th>
              </tr>
            </thead>

            <tbody>
              {daPagina.map((pessoa, indice) => (
                <tr
                  key={`${pessoa.kind}-${pessoa.id}`}
                  className={cn(
                    /* Linha par no branco do painel, ímpar na faixa: com o
                       quadro passando de cem pessoas, o olho perde a linha ao
                       atravessar do nome até a situação. */
                    'hover:bg-primary-on-light/[0.07] transition-colors',
                    indice % 2 === 1 && 'bg-light-stripe',
                  )}
                >
                  <td className="py-2.5 pl-3 pr-3">
                    <span className="text-on-light block truncate">{pessoa.name}</span>
                    <span className="text-on-light-muted text-label-md normal-case">
                      {pessoa.kind === 'PAINEL'
                        ? (PAPEL_LABEL[pessoa.role ?? ''] ?? 'Acesso ao painel')
                        : 'Motorista'}
                    </span>
                  </td>

                  <td className="text-on-light-variant text-label-md py-2.5 pr-3 normal-case">
                    {/* Motorista traz a filial do fornecedor; usuário traz o
                        e-mail, que é como a empresa o identifica. */}
                    <span className="block truncate">
                      {pessoa.kind === 'PAINEL' ? (pessoa.email ?? '–') : (pessoa.unit ?? '–')}
                    </span>
                    {pessoa.currentVehiclePlate ? (
                      <span className="text-on-light-muted tabular">
                        {pessoa.currentVehiclePlate}
                      </span>
                    ) : null}
                  </td>

                  <td className="py-2.5 text-right">
                    {pessoa.kind === 'MOTORISTA' ? (
                      <>
                        <span className="tabular text-on-light-variant block">
                          {numero(pessoa.distanceKm)} km
                        </span>
                        <span className="text-on-light-muted text-label-md tabular normal-case">
                          {pessoa.journeys ?? 0} {pessoa.journeys === 1 ? 'percurso' : 'percursos'}
                          {pessoa.criticalEvents ? ` · ${pessoa.criticalEvents} graves` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-on-light-muted text-label-md normal-case">
                        {pessoa.lastSeenAt
                          ? `desde ${dia.format(new Date(pessoa.lastSeenAt))}`
                          : '–'}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 pr-3 text-right">
                    {pessoa.kind === 'PAINEL' ? (
                      <StatusChip tone={pessoa.active ? 'positive' : 'neutral'} surface="light">
                        {pessoa.active ? 'Ativo' : 'Desativado'}
                      </StatusChip>
                    ) : (
                      <span
                        className={cn(
                          'text-label-md normal-case',
                          (pessoa.journeys ?? 0) > 0
                            ? 'text-on-light-variant'
                            : 'text-on-light-muted',
                        )}
                      >
                        {(pessoa.journeys ?? 0) > 0 ? 'rodou' : 'sem registro'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </LightCard>
  );
}
