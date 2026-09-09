import { SearchIcon } from '@/components/icons';
import { GlassInput, GlassSelect } from '@/management/ui';

export type DriverSort = 'score' | 'events' | 'km' | 'name';

const SORTS: { value: DriverSort; label: string }[] = [
  { value: 'score', label: 'Melhor score' },
  { value: 'events', label: 'Mais eventos' },
  { value: 'km', label: 'Mais km' },
  { value: 'name', label: 'Nome' },
];

/**
 * Barra de filtros da equipe, no desenho da barra da frota.
 *
 * ⚠️ Os controles moram DENTRO do painel branco (decisão do usuário em
 * 08/09/2026, a mesma de `/gestao/caminhoes`), e não no papel acima dele. Eles
 * recortam a lista que está logo abaixo, então ficar do lado de fora separava o
 * controle do que ele controla, e ainda deixava a barra na família de token do
 * papel: um cinza frio ao lado do branco. Dentro do painel a ordem é a do funil,
 * aba primeiro e refino depois.
 *
 * ⚠️ Rótulo visível em cima de cada campo, e não pastilha achatada: "Melhor
 * score" é um valor, e não uma pergunta. Com o rótulo em cima, a pergunta e a
 * resposta ficam visíveis ao mesmo tempo.
 */
export function DriverFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: DriverSort;
  onSortChange: (value: DriverSort) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtros da equipe"
      className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
    >
      <GlassInput
        id="driver-search"
        surface="light"
        label="Buscar"
        placeholder="Nome do motorista"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        leading={<SearchIcon size={16} aria-hidden="true" />}
      />

      <GlassSelect
        id="driver-sort"
        surface="light"
        label="Ordenar por"
        value={sort}
        onValueChange={(next) => onSortChange(next as DriverSort)}
        options={SORTS.map((option) => ({ value: option.value, label: option.label }))}
      />
    </div>
  );
}
