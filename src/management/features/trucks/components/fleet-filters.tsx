import { CloseIcon, SearchIcon } from '@/components/icons';
import { cn, GlassInput, GlassSelect } from '@/management/ui';

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
    /*
     * ⚠️ Desenho do filtro do cadastro de frota (decisão do usuário em
     * 08/09/2026): campo com RÓTULO VISÍVEL em cima, alinhados num grid.
     *
     * A barra achatada de pastilhas que estava aqui exigia abrir cada seletor
     * para saber o que ele recorta: "Todas as marcas" e "Qualquer manutenção"
     * são valores, e não perguntas. Com o rótulo em cima, a pergunta e a
     * resposta ficam visíveis ao mesmo tempo, e as colunas alinham os campos.
     *
     * ⚠️ Sem cartão em volta: no cadastro os campos moram num `GlassCard` sobre
     * o papel, mas aqui a barra já vive dentro do painel branco, e cartão dentro
     * de cartão é moldura sobre moldura.
     *
     * ⚠️ `surface="light"` em todos: os campos estão no painel branco, e a
     * versão escura deles inverte a hierarquia da tela.
     */
    <div
      role="group"
      aria-label="Filtros da frota"
      className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
    >
      <GlassInput
        id="filter-search"
        surface="light"
        label="Buscar"
        placeholder="Placa, modelo ou motorista"
        value={value.search}
        onChange={(event) => set('search', event.target.value)}
        leading={<SearchIcon size={16} aria-hidden="true" />}
      />

      <GlassSelect
        id="filter-brand"
        surface="light"
        label="Marca"
        value={value.brand}
        onValueChange={(next) => set('brand', next)}
        options={[
          { value: 'TODAS', label: 'Todas as marcas' },
          ...brands.map((brand) => ({ value: brand, label: brand })),
        ]}
      />

      <GlassSelect
        id="filter-maintenance"
        surface="light"
        label="Manutenção"
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
        surface="light"
        label="Sincronização"
        value={value.sync}
        onValueChange={(next) => set('sync', next as FleetFiltersValue['sync'])}
        options={[
          { value: 'TODOS', label: 'Qualquer sincronização' },
          { value: 'DESATUALIZADO', label: 'Sem sincronizar há 30 min' },
        ]}
      />

      {/* ⚠️ Coluna inteira e alinhado à esquerda: dentro do grid, o "Limpar"
          numa célula própria abriria uma quinta coluna vazia quando não há
          filtro, e os quatro campos encolheriam para abrir espaço a nada. */}
      {active > 0 ? (
        <div className="lg:col-span-4">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className={cn(
              'text-on-light-variant hover:text-on-light text-label-md focus-visible:ring-primary rounded-pill hover:bg-on-light/8 inline-flex items-center gap-1.5 px-3 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            <CloseIcon size={14} aria-hidden="true" />
            Limpar
          </button>
        </div>
      ) : null}
    </div>
  );
}
