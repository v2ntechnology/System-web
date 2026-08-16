import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFines } from '@/hooks/use-queries';
import { formatDate, formatCurrency } from '@/lib/format';
import { fineStatusDescriptor } from '@/lib/status-maps';
import { FINE_STATUS_LABEL } from '@/mocks/costs/fines';
import { type Fine, type FineStatus } from '@/types';

export default function FinesPage() {
  const { data, isLoading, isError, refetch } = useFines();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FineStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let result = data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (f) =>
          f.vehiclePlate.toLowerCase().includes(term) ||
          f.driverName.toLowerCase().includes(term) ||
          f.infractionType.toLowerCase().includes(term),
      );
    }
    if (status !== 'all') result = result.filter((f) => f.status === status);
    return result;
  }, [data, search, status]);

  const columns: DataTableColumn<Fine>[] = [
    {
      id: 'vehicle',
      header: 'Veículo',
      cell: (f) => <span className="font-mono text-sm">{f.vehiclePlate}</span>,
    },
    { id: 'driver', header: 'Motorista', cell: (f) => f.driverName },
    {
      id: 'infraction',
      header: 'Infração',
      cell: (f) => (
        <div>
          <p className="font-medium">{f.infractionType}</p>
          <p className="text-xs text-muted-foreground">{f.location}</p>
        </div>
      ),
    },
    { id: 'date', header: 'Data', cell: (f) => formatDate(f.date) },
    {
      id: 'points',
      header: 'Pontos',
      align: 'right',
      cell: (f) => <Badge variant={f.points >= 5 ? 'warning' : 'muted'}>{f.points}</Badge>,
    },
    { id: 'due', header: 'Prazo', cell: (f) => formatDate(f.dueDate) },
    { id: 'value', header: 'Valor', align: 'right', cell: (f) => formatCurrency(f.value) },
    {
      id: 'status',
      header: 'Tratativa',
      cell: (f) => <StatusBadge descriptor={fineStatusDescriptor(f.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multas"
        description="Controle das infrações, prazos e tratativas da frota."
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por veículo, motorista ou infração"
          className="w-full md:max-w-xs"
          aria-label="Buscar multas"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as FineStatus | 'all')}>
          <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tratativas</SelectItem>
            {(Object.keys(FINE_STATUS_LABEL) as FineStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {FINE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(f) => f.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={
          <EmptyState
            title="Nenhuma multa encontrada"
            description="Ajuste os filtros e tente novamente."
          />
        }
      />
    </div>
  );
}
