import { useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  SearchIcon,
  WarehouseIcon,
} from '@/components/icons';
import type { VehicleStatus } from '@/management/types';
import { GlassSelect } from '@/management/ui';
import {
  EMPTY_YARD_FILTERS,
  TODOS_OS_PATIOS,
  countActiveYardFilters,
  normalizeYardSearch,
  type YardDocsFilter,
  type YardFiltersValue,
  type YardFleetFilter,
  type YardStatusFilter,
} from '../yard-filters';
import { YARD_STATUS } from '../yard-status';

/* A ordem é a mesma dos indicadores do topo, que são o outro caminho para o
   mesmo filtro: duas listas com a mesma coisa em ordens diferentes se leem como
   listas diferentes. */
const STATUS_OPTIONS = [
  { value: 'TODAS', label: 'Todas as situações' },
  ...(Object.keys(YARD_STATUS) as VehicleStatus[]).map((status) => ({
    value: status as string,
    label: YARD_STATUS[status].plural,
  })),
];

/*
 * ⚠️ **Os rótulos falam do DOCUMENTO, nunca da saída.** "Documento irregular",
 * e não "Não pode sair": a plataforma não toma essa decisão, e um seletor que
 * dissesse o contrário ensinaria o time a esperar um bloqueio que não existe.
 */
const DOCS_OPTIONS = [
  { value: 'TODOS', label: 'Toda a documentação' },
  { value: 'IRREGULAR', label: 'Documento irregular' },
  { value: 'SEM_CONSULTA', label: 'Nunca consultado' },
];

const FLEET_OPTIONS = [
  { value: 'ATIVOS', label: 'Somente ativos' },
  { value: 'INATIVOS', label: 'Somente inativos' },
  { value: 'TODOS', label: 'Ativos e inativos' },
];

export function YardFilters({
  value,
  onChange,
  patios,
}: {
  value: YardFiltersValue;
  onChange: (next: YardFiltersValue) => void;
  patios: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  /*
   * ⚠️ **"Empresa", e não "pátio"** (pedido do usuário em 18/09/2026), e o nome
   * novo é o certo: o campo por trás disto é o `unit`, que a API monta a partir
   * da EMPRESA do fornecedor de telemetria, e não de um pátio cadastrado. São as
   * cinco da SERVIOESTE. Chamar de pátio prometia um lugar físico que o produto
   * não conhece, que é a mesma confusão que a nota do rodapé da grade desfaz.
   */
  const options = [{ value: TODOS_OS_PATIOS, label: 'Todas as empresas' }, ...patios];
  const filtered = options.filter((option) =>
    normalizeYardSearch(option.label).includes(normalizeYardSearch(query.trim())),
  );
  return (
    <div className="yard-filters" role="group" aria-label="Filtros do pátio">
      <div className="yard-unit-field">
        <span id={`${id}-label`} className="yard-field-label">
          Empresa
        </span>
        {/*
         * ⚠️ `modal`: sem ele o Popover deixa a página rolar por baixo da lista
         * aberta, e o `GlassSelect` ao lado não deixa, porque o Select do Radix
         * já é modal por padrão. Dois campos vizinhos com comportamentos
         * diferentes de rolagem se leem como defeito (pedido do usuário em
         * 18/09/2026). Ele também prende o foco na lista e marca o resto da
         * página como inerte, que é o que o Select faz.
         */}
        <Popover.Root
          modal
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery('');
          }}
        >
          <Popover.Trigger
            className="yard-unit-trigger"
            aria-labelledby={`${id}-label ${id}-selected`}
          >
            <WarehouseIcon size={19} aria-hidden="true" />
            <span id={`${id}-selected`}>
              {options.find((option) => option.value === value.unit)?.label ?? value.unit}
            </span>
            <ChevronDownIcon size={16} aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="yard-unit-menu"
              align="start"
              sideOffset={8}
              aria-label="Selecionar empresa"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                input.current?.focus();
              }}
            >
              <div className="yard-unit-search">
                <SearchIcon size={16} aria-hidden="true" />
                <input
                  ref={input}
                  aria-label="Buscar empresa"
                  placeholder="Buscar empresa…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      event.currentTarget
                        .closest('[role="dialog"]')
                        ?.querySelector<HTMLButtonElement>('.yard-unit-option')
                        ?.focus();
                    }
                    if (event.key === 'Enter' && filtered.length === 1) {
                      onChange({ ...value, unit: filtered[0]!.value });
                      setOpen(false);
                      setQuery('');
                    }
                  }}
                />
              </div>
              <div className="yard-unit-options" role="group" aria-label="Empresas disponíveis">
                {filtered.map((option) => (
                  <button
                    className="yard-unit-option"
                    type="button"
                    key={option.value}
                    aria-pressed={value.unit === option.value}
                    onClick={() => {
                      onChange({ ...value, unit: option.value });
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{option.label}</span>
                    {value.unit === option.value && <CheckIcon size={16} aria-hidden="true" />}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="yard-no-units">Nenhuma empresa encontrada.</p>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {/*
       * ⚠️ `GlassSelect`, e não `<select>` nativo: é o seletor do painel, o
       * mesmo que a barra de filtros do cadastro de frota e a de motoristas já
       * usam. `surface="light"` porque a folha do pátio é branca.
       *
       * O de Situação escreve o MESMO `filters.status` dos indicadores do topo:
       * dois controles, um estado. Cada um com o próprio seria a receita para a
       * grade mostrar um recorte e o número mostrar outro.
       */}
      {/* ⚠️ `h-12`: o gatilho do `GlassSelect` tem 44px e os campos desta barra
          têm 48px. Sem igualar, os três ficam com as bases desencontradas na
          mesma linha, que é o tipo de desalinhamento que só aparece junto. */}
      <div className="yard-select-field">
        <GlassSelect
          surface="light"
          label="Situação"
          className="h-12 rounded-[14px]"
          options={STATUS_OPTIONS}
          value={value.status}
          onValueChange={(next) => onChange({ ...value, status: next as YardStatusFilter })}
        />
      </div>
      {/*
       * ⚠️ Fica DEPOIS de Situação e antes de Cadastro: a leitura da barra é a
       * mesma da pergunta de quem despacha, que primeiro olha onde o caminhão
       * está, depois se a papelada dele responde, e por último se ele ainda
       * pertence à frota.
       */}
      <div className="yard-select-field">
        <GlassSelect
          surface="light"
          label="Documentação"
          className="h-12 rounded-[14px]"
          options={DOCS_OPTIONS}
          value={value.docs}
          onValueChange={(next) => onChange({ ...value, docs: next as YardDocsFilter })}
        />
      </div>
      <div className="yard-select-field">
        <GlassSelect
          surface="light"
          label="Cadastro"
          className="h-12 rounded-[14px]"
          options={FLEET_OPTIONS}
          value={value.fleet}
          onValueChange={(next) => onChange({ ...value, fleet: next as YardFleetFilter })}
        />
      </div>
      <label className="yard-search-field">
        <span className="yard-field-label">Encontrar veículo</span>
        <span className="yard-search">
          <SearchIcon size={18} aria-hidden="true" />
          <input
            placeholder="Placa, frota, modelo ou motorista…"
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </span>
      </label>
      {countActiveYardFilters(value) > 0 && (
        <button className="yard-clear" type="button" onClick={() => onChange(EMPTY_YARD_FILTERS)}>
          <CloseIcon size={15} aria-hidden="true" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
