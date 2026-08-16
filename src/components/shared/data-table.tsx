import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { ErrorState, TableSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortField?: string;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

export interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

const ALIGN: Record<'left' | 'right' | 'center', string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  isError,
  onRetry,
  emptyState,
  onRowClick,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  if (isLoading) return <TableSkeleton />;
  if (isError) return <ErrorState onRetry={onRetry} />;

  function handleSort(field?: string) {
    if (!field || !onSortChange) return;
    const dir: 'asc' | 'desc' = sort?.field === field && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ field, dir });
  }

  if (data.length === 0 && emptyState) {
    return <div className="rounded-lg border border-border">{emptyState}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const isSorted = sort?.field === col.sortField;
              const SortIcon = !isSorted
                ? ChevronsUpDown
                : sort?.dir === 'asc'
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={col.id}
                  className={cn(col.align && ALIGN[col.align], col.headerClassName)}
                >
                  {col.sortField ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.sortField)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                        isSorted && 'text-foreground',
                      )}
                    >
                      {col.header}
                      <SortIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(col.align && ALIGN[col.align], col.className)}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: DataTablePaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Exibindo <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> de{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
