import { FunnelSimpleIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { cn } from '@/management/ui';

export interface FleetFiltersValue {
  brand: string;
  maintenance: 'TODAS' | 'VENCIDA' | 'PROXIMA';
  sync: 'TODOS' | 'DESATUALIZADO';
  search: string;
}

export const EMPTY_FILTERS: FleetFiltersValue = {
  brand: 'TODAS',
  maintenance: 'TODAS',
  sync: 'TODOS',
  search: '',
};

export function countActiveFilters(value: FleetFiltersValue) {
  return (
    (value.brand !== 'TODAS' ? 1 : 0) +
    (value.maintenance !== 'TODAS' ? 1 : 0) +
    (value.sync !== 'TODOS' ? 1 : 0) +
    (value.search.trim() ? 1 : 0)
  );
}

const selectClass =
  'border-outline-variant bg-surface-lowest text-on-surface text-body-md focus-visible:ring-secondary h-11 rounded-pill border px-4 focus-visible:outline-none focus-visible:ring-2';

/**
 * Barra de filtros da frota (Figma).
 *
 * O Figma trazia rótulos genéricos ("Filter 1", "Data", "Search"). Aqui eles
 * viram os recortes que o gestor de fato usa: marca, urgência de manutenção e
 * saúde da integração.
 */
export function FleetFilters({
  value,
  onChange,
  brands,
}: {
  value: FleetFiltersValue;
  onChange: (next: FleetFiltersValue) => void;
  brands: string[];
}) {
  const active = countActiveFilters(value);
  const set = <K extends keyof FleetFiltersValue>(key: K, next: FleetFiltersValue[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-on-surface-variant text-body-md flex items-center gap-2">
        <FunnelSimpleIcon size={18} weight="duotone" aria-hidden="true" />
        Filtros
        {active > 0 ? (
          <span className="bg-primary-strong text-on-primary rounded-pill tabular text-label-sm flex size-5 items-center justify-center">
            {active}
          </span>
        ) : null}
      </p>

      <label className="sr-only" htmlFor="filter-brand">
        Marca
      </label>
      <select
        id="filter-brand"
        value={value.brand}
        onChange={(event) => set('brand', event.target.value)}
        className={selectClass}
      >
        <option value="TODAS">Todas as marcas</option>
        {brands.map((brand) => (
          <option key={brand} value={brand}>
            {brand}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-maintenance">
        Manutenção
      </label>
      <select
        id="filter-maintenance"
        value={value.maintenance}
        onChange={(event) =>
          set('maintenance', event.target.value as FleetFiltersValue['maintenance'])
        }
        className={selectClass}
      >
        <option value="TODAS">Qualquer manutenção</option>
        <option value="VENCIDA">Manutenção vencida</option>
        <option value="PROXIMA">Vence em menos de 1.000 km</option>
      </select>

      <label className="sr-only" htmlFor="filter-sync">
        Sincronização
      </label>
      <select
        id="filter-sync"
        value={value.sync}
        onChange={(event) => set('sync', event.target.value as FleetFiltersValue['sync'])}
        className={selectClass}
      >
        <option value="TODOS">Qualquer sincronização</option>
        <option value="DESATUALIZADO">Sem sincronizar há 30 min</option>
      </select>

      {/* Linha inteira no mobile: dividindo espaço com os selects, sobrava "Pl…". */}
      <div className="border-outline-variant bg-surface-lowest rounded-pill focus-within:border-secondary flex min-w-0 basis-full items-center gap-2 border px-4 sm:max-w-72 sm:flex-1 sm:basis-auto">
        <MagnifyingGlassIcon
          size={18}
          className="text-on-surface-muted shrink-0"
          aria-hidden="true"
        />
        <label htmlFor="filter-search" className="sr-only">
          Buscar por placa, modelo ou motorista
        </label>
        <input
          id="filter-search"
          type="search"
          value={value.search}
          onChange={(event) => set('search', event.target.value)}
          placeholder="Placa, modelo ou motorista"
          className="text-body-md text-on-surface placeholder:text-on-surface-muted h-11 w-full bg-transparent focus:outline-none"
        />
      </div>

      {active > 0 ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className={cn(
            'text-on-surface-variant hover:text-on-surface text-label-md focus-visible:ring-secondary rounded-pill hover:bg-white/8 inline-flex items-center gap-1.5 px-3 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <XIcon size={14} weight="bold" aria-hidden="true" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
