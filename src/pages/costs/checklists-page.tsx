import { Camera, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

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
import { useChecklists } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { checklistStatusDescriptor } from '@/lib/status-maps';
import { CHECKLIST_STATUS_LABEL } from '@/mocks/costs/checklists';
import { type Checklist, type ChecklistStatus } from '@/types';

export default function ChecklistsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useChecklists();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ChecklistStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let result = data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (c) =>
          c.vehiclePlate.toLowerCase().includes(term) || c.driverName.toLowerCase().includes(term),
      );
    }
    if (status !== 'all') result = result.filter((c) => c.status === status);
    return result;
  }, [data, search, status]);

  const columns: DataTableColumn<Checklist>[] = [
    {
      id: 'vehicle',
      header: 'Veículo',
      cell: (c) => <span className="font-mono text-sm">{c.vehiclePlate}</span>,
    },
    { id: 'driver', header: 'Motorista', cell: (c) => c.driverName },
    {
      id: 'date',
      header: 'Data',
      cell: (c) => <span className="text-xs">{formatDateTime(c.date)}</span>,
    },
    {
      id: 'irregular',
      header: 'Irregularidades',
      align: 'right',
      cell: (c) =>
        c.irregularItems > 0 ? (
          <Badge variant="warning">{c.irregularItems}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      id: 'photos',
      header: 'Evidências',
      align: 'right',
      cell: (c) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" />
          {c.photosCount}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (c) => <StatusBadge descriptor={checklistStatusDescriptor(c.status)} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: () => <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        description="Inspeções digitais de devolução dos veículos, com evidências e ocorrências."
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por veículo ou motorista"
          className="w-full md:max-w-xs"
          aria-label="Buscar checklists"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as ChecklistStatus | 'all')}>
          <SelectTrigger className="w-full md:w-[190px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(CHECKLIST_STATUS_LABEL) as ChecklistStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CHECKLIST_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(c) => c.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(c) => navigate(`/app/checklists/${c.id}`)}
        emptyState={
          <EmptyState
            title="Nenhum checklist encontrado"
            description="Ajuste os filtros e tente novamente."
          />
        }
      />
    </div>
  );
}
