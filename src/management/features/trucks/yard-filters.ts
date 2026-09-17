import type { VehicleStatus } from '@/management/types';

export type YardStatusFilter = 'TODAS' | VehicleStatus;
export interface YardFiltersValue {
  unit: string;
  status: YardStatusFilter;
  search: string;
}
export const TODOS_OS_PATIOS = 'TODOS';
export const EMPTY_YARD_FILTERS: YardFiltersValue = {
  unit: TODOS_OS_PATIOS,
  status: 'TODAS',
  search: '',
};
export const normalizeYardSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function countActiveYardFilters(value: YardFiltersValue) {
  return (
    Number(value.unit !== TODOS_OS_PATIOS) +
    Number(value.status !== 'TODAS') +
    Number(!!value.search.trim())
  );
}
