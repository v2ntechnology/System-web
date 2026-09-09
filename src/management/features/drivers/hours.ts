import type { DriverHours } from './api';

/**
 * Quantos motoristas estão com alguma regra de jornada estourada.
 *
 * Fora da árvore de componentes porque a página e a lista precisam do MESMO
 * número: a contagem da aba tem de existir mesmo com a aba fechada, e recontar
 * de dois jeitos abriria espaço para os dois divergirem.
 */
export function countViolations(rows: DriverHours[]): number {
  return rows.filter((linha) => linha.violations.length > 0).length;
}
