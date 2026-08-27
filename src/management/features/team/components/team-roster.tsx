import { InfoIcon, SearchIcon } from '@/components/icons';
import type { TeamMember } from '@/management/lib/fleet-api';
import { LightCard, StatusChip, cn } from '@/management/ui';
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

export interface TeamRosterProps {
  people: TeamMember[];
  className?: string | undefined;
}

export function TeamRoster({ people, className }: TeamRosterProps) {
  const [busca, setBusca] = useState('');

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return people;

    return people.filter((pessoa) =>
      [pessoa.name, pessoa.unit ?? '', pessoa.email ?? '', pessoa.currentVehiclePlate ?? '']
        .join(' ')
        .toLowerCase()
        .includes(termo),
    );
  }, [people, busca]);

  return (
    <LightCard
      title="Quadro"
      className={className}
      action={
        <div className="rounded-pill focus-within:border-primary-on-light bg-light-container border-light-outline flex min-w-0 items-center gap-2 border px-4 sm:w-64">
          <SearchIcon size={18} className="text-on-light-muted shrink-0" aria-hidden="true" />
          <label htmlFor="team-search" className="sr-only">
            Buscar por nome, filial, placa ou e-mail
          </label>
          <input
            id="team-search"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Nome, filial ou e-mail"
            className="text-body-md text-on-light placeholder:text-placeholder h-10 w-full bg-transparent focus:outline-none"
          />
        </div>
      }
    >
      {visiveis.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">
          Ninguém encontrado com esse termo.
        </p>
      ) : (
        <div className="max-h-[640px] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <thead className="bg-light sticky top-0">
              <tr className="text-on-light-muted text-label-md normal-case">
                <th scope="col" className="py-2 text-left font-normal">
                  Pessoa
                </th>
                <th scope="col" className="py-2 text-left font-normal">
                  Onde
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  No período
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Situação
                </th>
              </tr>
            </thead>

            <tbody>
              {visiveis.map((pessoa) => (
                <tr
                  key={`${pessoa.kind}-${pessoa.id}`}
                  className="border-outline-variant/40 border-t"
                >
                  <td className="py-2.5 pr-3">
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

                  <td className="py-2.5 text-right">
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

      <p className="text-on-light-muted text-label-md mt-4 flex items-start gap-1.5 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Motorista vem do cadastro da telemetria; acesso ao painel vem do cadastro do sistema. São
        listas diferentes e quase não se cruzam.
      </p>
    </LightCard>
  );
}
