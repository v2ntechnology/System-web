import { ChevronRight } from 'lucide-react';
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
import { useTrips } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { tripStatusDescriptor } from '@/lib/status-maps';
import { TRIP_STATUS_LABEL } from '@/mocks/operations/trips';
import { type Trip, type TripStatus } from '@/types';

const RISK_LABEL: Record<
  Trip['delayRisk'],
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  low: { label: 'Baixo', variant: 'success' },
  medium: { label: 'Médio', variant: 'warning' },
  high: { label: 'Alto', variant: 'destructive' },
};

export default function TripsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTrips();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TripStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let result = data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (t) =>
          t.origin.toLowerCase().includes(term) ||
          t.destination.toLowerCase().includes(term) ||
          t.vehiclePlate.toLowerCase().includes(term) ||
          t.driverName.toLowerCase().includes(term),
      );
    }
    if (status !== 'all') result = result.filter((t) => t.status === status);
    return result;
  }, [data, search, status]);

  const columns: DataTableColumn<Trip>[] = [
    {
      id: 'route',
      header: 'Rota',
      cell: (t) => (
        <div>
          <p className="font-medium">
            {t.origin} → {t.destination}
          </p>
          <p className="text-xs text-muted-foreground">{t.distanceKm} km</p>
        </div>
      ),
    },
    {
      id: 'vehicle',
      header: 'Veículo',
      cell: (t) => <span className="font-mono text-sm">{t.vehiclePlate}</span>,
    },
    { id: 'driver', header: 'Motorista', cell: (t) => t.driverName },
    {
      id: 'start',
      header: 'Início',
      cell: (t) => <span className="text-xs">{formatDateTime(t.startDate)}</span>,
    },
    {
      id: 'eta',
      header: 'Previsão',
      cell: (t) => <span className="text-xs">{formatDateTime(t.eta)}</span>,
    },
    {
      id: 'progress',
      header: 'Progresso',
      cell: (t) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-gradient"
              style={{ width: `${t.progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{t.progressPercent}%</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (t) => <StatusBadge descriptor={tripStatusDescriptor(t.status)} />,
    },
    {
      id: 'risk',
      header: 'Risco de atraso',
      cell: (t) => (
        <Badge variant={RISK_LABEL[t.delayRisk].variant}>{RISK_LABEL[t.delayRisk].label}</Badge>
      ),
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
        title="Viagens"
        description="Acompanhe as viagens em andamento, agendadas e concluídas."
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por rota, veículo ou motorista"
          className="w-full md:max-w-xs"
          aria-label="Buscar viagens"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as TripStatus | 'all')}>
          <SelectTrigger className="w-full md:w-[180px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {TRIP_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(t) => navigate(`/app/viagens/${t.id}`)}
        emptyState={
          <EmptyState
            title="Nenhuma viagem encontrada"
            description="Ajuste os filtros e tente novamente."
          />
        }
      />
    </div>
  );
}
