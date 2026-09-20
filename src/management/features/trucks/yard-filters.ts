import type { VehicleStatus } from '@/management/types';

export type YardStatusFilter = 'TODAS' | VehicleStatus;

/**
 * O recorte por cadastro, que é OUTRA pergunta e não se mistura com a situação.
 *
 * ⚠️ `status` é o que a telemetria diz agora (parado, rodando, mudo); isto é o
 * que o cadastro diz sobre o caminhão pertencer à frota. Um veículo inativo
 * continua tendo um último status conhecido, então juntar os dois num seletor só
 * obrigaria a escolher entre ver "inativos" e ver "em viagem".
 */
export type YardFleetFilter = 'ATIVOS' | 'INATIVOS' | 'TODOS';

/**
 * O recorte pela documentação do DETRAN, que é a TERCEIRA pergunta desta barra.
 *
 * ⚠️ **Nenhuma destas opções bloqueia o caminhão.** Ela só encontra: com 40
 * cartões na tela, achar os 12 com pendência a olho é trabalho, e sem um
 * caminho até eles a marca no cartão vira enfeite. Quem decide se o veículo sai
 * continua sendo o gestor.
 */
export type YardDocsFilter = 'TODOS' | 'IRREGULAR' | 'SEM_CONSULTA';

export interface YardFiltersValue {
  unit: string;
  status: YardStatusFilter;
  /** Quem aparece na grade. Ver {@link YardFleetFilter}. */
  fleet: YardFleetFilter;
  /** O que o DETRAN diz sobre o veículo. Ver {@link YardDocsFilter}. */
  docs: YardDocsFilter;
  search: string;
}
export const TODOS_OS_PATIOS = 'TODOS';

/**
 * ⚠️ **O padrão é `ATIVOS`, e não "tudo"** (decisão do usuário em 18/09/2026).
 * Quem abre o pátio de manhã quer saber o que pode rodar hoje, e caminhão
 * inativo é o que saiu da frota: vendido, devolvido, fim de contrato. Ele
 * continua alcançável escolhendo "Inativos" no filtro, porque some da tela não
 * pode virar some do sistema.
 */
export const EMPTY_YARD_FILTERS: YardFiltersValue = {
  unit: TODOS_OS_PATIOS,
  status: 'TODAS',
  fleet: 'ATIVOS',
  docs: 'TODOS',
  search: '',
};
export const normalizeYardSearch = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function countActiveYardFilters(value: YardFiltersValue) {
  return (
    Number(value.unit !== TODOS_OS_PATIOS) +
    Number(value.status !== 'TODAS') +
    /* Comparado com o PADRÃO, e não com "todos": abrir a tela já é um recorte,
       e contá-lo sempre deixaria o "Limpar filtros" aceso desde o primeiro
       segundo, sem nada para limpar. */
    Number(value.fleet !== EMPTY_YARD_FILTERS.fleet) +
    Number(value.docs !== 'TODOS') +
    Number(!!value.search.trim())
  );
}
