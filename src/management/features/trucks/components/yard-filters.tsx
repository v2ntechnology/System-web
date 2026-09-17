import { useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  SearchIcon,
  WarehouseIcon,
} from '@/components/icons';
import {
  EMPTY_YARD_FILTERS,
  TODOS_OS_PATIOS,
  countActiveYardFilters,
  normalizeYardSearch,
  type YardFiltersValue,
} from '../yard-filters';

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
  const options = [{ value: TODOS_OS_PATIOS, label: 'Todos os pátios' }, ...patios];
  const filtered = options.filter((option) =>
    normalizeYardSearch(option.label).includes(normalizeYardSearch(query.trim())),
  );
  return (
    <div className="yard-filters" role="group" aria-label="Filtros do pátio">
      <div className="yard-unit-field">
        <span id={`${id}-label`} className="yard-field-label">
          Filial / pátio
        </span>
        <Popover.Root
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
              aria-label="Selecionar pátio"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                input.current?.focus();
              }}
            >
              <div className="yard-unit-search">
                <SearchIcon size={16} aria-hidden="true" />
                <input
                  ref={input}
                  aria-label="Buscar filial"
                  placeholder="Buscar filial…"
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
              <div className="yard-unit-options" role="group" aria-label="Filiais disponíveis">
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
                  <p className="yard-no-units">Nenhuma filial encontrada.</p>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
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
