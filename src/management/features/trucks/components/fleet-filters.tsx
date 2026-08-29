import { CloseIcon, FilterIcon, SearchIcon } from '@/components/icons';
import { cn, GlassSelect } from '@/management/ui';

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

/* Piso comum para os três filtros: sem ele cada um encolhe até o tamanho do
   próprio texto e a barra fica desalinhada. Acima disso, cada um cresce com o
   rótulo selecionado, que pode ser longo ("Vence em menos de 1.000 km"). */
const selectClass = 'w-auto min-w-52';

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
        <FilterIcon size={18} aria-hidden="true" />
        Filtros
        {active > 0 ? (
          <span className="bg-primary-strong text-on-primary rounded-pill tabular text-label-sm flex size-5 items-center justify-center">
            {active}
          </span>
        ) : null}
      </p>

      <GlassSelect
        id="filter-brand"
        label="Marca"
        hideLabel
        variant="outline"
        pill
        className={selectClass}
        value={value.brand}
        onValueChange={(next) => set('brand', next)}
        options={[
          { value: 'TODAS', label: 'Todas as marcas' },
          ...brands.map((brand) => ({ value: brand, label: brand })),
        ]}
      />

      <GlassSelect
        id="filter-maintenance"
        label="Manutenção"
        hideLabel
        variant="outline"
        pill
        className={selectClass}
        value={value.maintenance}
        onValueChange={(next) => set('maintenance', next as FleetFiltersValue['maintenance'])}
        options={[
          { value: 'TODAS', label: 'Qualquer manutenção' },
          { value: 'VENCIDA', label: 'Manutenção vencida' },
          { value: 'PROXIMA', label: 'Vence em menos de 1.000 km' },
        ]}
      />

      <GlassSelect
        id="filter-sync"
        label="Sincronização"
        hideLabel
        variant="outline"
        pill
        className={selectClass}
        value={value.sync}
        onValueChange={(next) => set('sync', next as FleetFiltersValue['sync'])}
        options={[
          { value: 'TODOS', label: 'Qualquer sincronização' },
          { value: 'DESATUALIZADO', label: 'Sem sincronizar há 30 min' },
        ]}
      />

      {/* Linha inteira no mobile: dividindo espaço com os selects, sobrava "Pl…". */}
      <div className="border-outline-variant bg-surface-lowest rounded-pill focus-within:border-secondary flex min-w-0 basis-full items-center gap-2 border px-4 sm:max-w-72 sm:flex-1 sm:basis-auto">
        <SearchIcon size={18} className="text-on-surface-muted shrink-0" aria-hidden="true" />
        <label htmlFor="filter-search" className="sr-only">
          Buscar por placa, modelo ou motorista
        </label>
        <input
          id="filter-search"
          type="search"
          value={value.search}
          onChange={(event) => set('search', event.target.value)}
          placeholder="Placa, modelo ou motorista"
          className="text-body-md text-on-surface placeholder:text-placeholder h-11 w-full bg-transparent focus:outline-none"
        />
      </div>

      {active > 0 ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className={cn(
            'text-on-surface-variant hover:text-on-surface text-label-md focus-visible:ring-secondary rounded-pill hover:bg-on-surface/8 inline-flex items-center gap-1.5 px-3 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <CloseIcon size={14} aria-hidden="true" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
