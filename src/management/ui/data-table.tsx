import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  /** Célula. Sem isso, o valor bruto de `sortValue` é renderizado. */
  cell?: (row: T) => ReactNode;
  /** Valor usado na ordenação. Ausente = coluna não ordenável. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | undefined;
  /** Some abaixo de `lg` — para colunas de apoio em telas estreitas. */
  hideOnMobile?: boolean | undefined;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  /** Mensagem quando não há linhas — nunca deixar tabela vazia sem explicação. */
  emptyMessage?: string | undefined;
  className?: string | undefined;
}

/**
 * Tabela do painel, sobre superfície clara (RNF-027).
 *
 * Números em `tabular` para que as colunas alinhem. A ordenação é client-side:
 * com paginação por cursor no backend (BE-04) isso vira parâmetro de query.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = 'Nada para exibir.',
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;

    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  if (rows.length === 0) {
    return <p className="text-on-light-variant text-body-md py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className={cn('-mx-1 overflow-x-auto px-1', className)}>
      <table className="min-w-160 w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-light-outline border-b">
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const sortable = Boolean(column.sortValue);

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'text-on-light-variant text-label-md py-2.5 pr-4 font-medium',
                    column.align === 'right' && 'text-right',
                    column.hideOnMobile && 'hidden lg:table-cell',
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        'hover:text-on-light focus-visible:ring-primary-on-light inline-flex items-center gap-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2',
                        column.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {column.header}
                      {active ? (
                        sort.dir === 'asc' ? (
                          <ChevronUpIcon size={12} />
                        ) : (
                          <ChevronDownIcon size={12} />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-light-outline/60 hover:bg-light-container border-b transition-colors last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'text-on-light text-body-md py-3 pr-4',
                    column.align === 'right' && 'tabular text-right',
                    column.hideOnMobile && 'hidden lg:table-cell',
                  )}
                >
                  {column.cell ? column.cell(row) : String(column.sortValue?.(row) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
