import { httpRequest } from '@/services/http';
import type { TeamRole } from '@/management/lib/fleet-api';

/**
 * Fronteira entre o editor de cargos e o transporte.
 *
 * O cargo é o que distribui, dentro da empresa, o que o plano dela liberou: o
 * plano é o teto, e aqui se decide quem alcança o quê. Quem edita é o Dono, com
 * a permissão `roles.manage`, que não é delegável.
 *
 * ⚠️ **Alterar cargo vale na requisição SEGUINTE**, porque a escrita invalida o
 * cache de permissões da API. Não é preciso ninguém sair e entrar de novo.
 */

/** Uma permissão como o editor precisa dela. */
export interface PermissionItem {
  key: string;
  label: string;
  group: string;
  groupLabel: string;
  /** ⚠️ O módulo que o plano precisa cobrir. É o que explica o que falta. */
  module: string;
}

/**
 * O catálogo que esta empresa pode conceder.
 *
 * ⚠️ **Já vem filtrado pelo plano dela, e o parâmetro `plan` é ignorado para
 * token de empresa.** É de propósito: aceitar o plano por parâmetro deixaria o
 * Dono pedir a lista do enterprise e marcar o que não contratou. Gravaria, não
 * valeria, e viraria chamado de suporte.
 */
export function fetchPermissions(): Promise<PermissionItem[]> {
  return httpRequest<PermissionItem[]>('/v1/permissions');
}

/**
 * Os cargos da empresa.
 *
 * ⚠️ **Devolve as permissões GRAVADAS, que podem exceder o plano.** Uma empresa
 * starter tem cargos semeados com `analytics.view`, e a leitura de permissão
 * descarta o que o plano não cobre, mas a coluna continua com a chave lá. O
 * editor precisa mostrar essas chaves marcadas: gravar sem elas as apaga, e um
 * upgrade de plano não as traz de volta. Ver `roles-page`.
 */
export function fetchRoles(): Promise<TeamRole[]> {
  return httpRequest<TeamRole[]>('/v1/roles');
}

export interface RoleInput {
  /** Ausente, a chave sai do nome: "Diretor Financeiro" vira `diretor-financeiro`. */
  key?: string;
  name: string;
  description?: string;
  permissions: string[];
  /** ⚠️ `gestao` ou `operacional`, e nunca um caminho de rota. `/app` responde 400. */
  landing: 'gestao' | 'operacional';
}

/**
 * Cria um cargo.
 *
 * As recusas previstas: chave repetida responde 409, cargo sem permissão nenhuma
 * é recusado, e `team.manage` ou `roles.manage` no corpo respondem 400, porque
 * não são delegáveis.
 */
export function createRole(input: RoleInput): Promise<{ id: string }> {
  return httpRequest<{ id: string }>('/v1/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Altera um cargo. Campo ausente significa "não mexe nesse".
 *
 * ⚠️ **A chave nunca muda**, mesmo renomeando o cargo: ela é o identificador
 * interno, e o nome é o rótulo que o cliente escolheu.
 *
 * ⚠️ **Cargo de sistema não é editável nem apagável**, e responde 409.
 */
export function updateRole(id: string, changes: Partial<RoleInput>): Promise<void> {
  return httpRequest<void>(`/v1/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

/**
 * Apaga um cargo, migrando quem estava nele.
 *
 * ⚠️ **Cargo em uso EXIGE o destino**, e não migra sozinho para um padrão: a
 * pessoa herdaria um conjunto de permissões que ninguém escolheu, e aqui o cargo
 * decide quem vê custo consolidado.
 *
 * ⚠️ **Apagar, ou migrar alguém de cargo, derruba a sessão dessas pessoas**, que
 * recebem 401 na requisição seguinte. Não é defeito: é o mesmo mecanismo que faz
 * rebaixamento valer na hora.
 */
export function deleteRole(id: string, migrateTo?: string): Promise<void> {
  const destino = migrateTo ? `?migrateTo=${migrateTo}` : '';
  return httpRequest<void>(`/v1/roles/${id}${destino}`, { method: 'DELETE' });
}
