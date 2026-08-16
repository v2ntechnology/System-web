import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  DataTable,
  type DataTableColumn,
  type SortState,
  DataTablePagination,
} from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { DateRangeSelector, FilterBar, SearchInput } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionGuard } from '@/components/shared/guards';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-session';
import { useVehicleUnits, useVehicles } from '@/hooks/use-queries';
import { formatDate, formatRelative, formatKm } from '@/lib/format';
import { criticalityDescriptor, vehicleStatusDescriptor } from '@/lib/status-maps';
import { VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL } from '@/mocks/fleet/vehicles';
import { type Criticality, type Vehicle, type VehicleStatus, type VehicleType } from '@/types';

import { VehicleFormDialog } from '@/components/shared/vehicle-form-dialog';

const PAGE_SIZE = 8;

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: units } = useVehicleUnits();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VehicleStatus | 'all'>('all');
  const [type, setType] = useState<VehicleType | 'all'>('all');
  const [unit, setUnit] = useState<string>('all');
  const [criticality, setCriticality] = useState<Criticality | 'all'>('all');
  const [sort, setSort] = useState<SortState>({ field: 'updatedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useVehicles({
    search,
    status,
    type,
    unit,
    criticality,
    sortBy: sort.field as never,
    sortDir: sort.dir,
    page,
    pageSize: PAGE_SIZE,
  });

  function resetPage<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const columns: DataTableColumn<Vehicle>[] = [
    {
      id: 'vehicle',
      header: 'Veículo',
      sortField: 'plate',
      cell: (v) => (
        <div>
          <p className="font-medium">{v.fleetNumber}</p>
          <p className="text-xs text-muted-foreground">
            {v.manufacturer} {v.model}
          </p>
        </div>
      ),
    },
    {
      id: 'plate',
      header: 'Placa',
      cell: (v) => <span className="font-mono text-sm">{v.plate}</span>,
    },
    { id: 'type', header: 'Tipo', cell: (v) => VEHICLE_TYPE_LABEL[v.type] },
    { id: 'unit', header: 'Unidade', sortField: 'unit', cell: (v) => v.unit },
    {
      id: 'driver',
      header: 'Motorista',
      cell: (v) => v.currentDriver?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (v) => <StatusBadge descriptor={vehicleStatusDescriptor(v.status)} />,
    },
    {
      id: 'criticality',
      header: 'Criticidade',
      cell: (v) => (
        <StatusBadge descriptor={criticalityDescriptor(v.criticality)} withDot={false} />
      ),
    },
    {
      id: 'mileage',
      header: 'Quilometragem',
      sortField: 'mileageKm',
      align: 'right',
      cell: (v) => formatKm(v.mileageKm),
    },
    {
      id: 'nextMaintenance',
      header: 'Próx. manutenção',
      cell: (v) =>
        v.nextMaintenanceDate ? (
          formatDate(v.nextMaintenanceDate)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'updated',
      header: 'Atualizado',
      sortField: 'updatedAt',
      cell: (v) => (
        <span className="text-xs text-muted-foreground">{formatRelative(v.updatedAt)}</span>
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
        title="Veículos"
        description="Gestão completa da frota com filtros, busca e status em tempo real."
        actions={
          <>
            <DateRangeSelector value="30d" onChange={() => {}} />
            {hasPermission('vehicles.create') && (
              <Button variant="brand" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Cadastrar veículo
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={resetPage(setSearch)}
          placeholder="Buscar por placa, prefixo ou modelo"
          className="w-full md:max-w-xs"
          aria-label="Buscar veículos"
        />
        <Select
          value={status}
          onValueChange={(v) => resetPage(setStatus)(v as VehicleStatus | 'all')}
        >
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => resetPage(setType)(v as VehicleType | 'all')}>
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]).map((tp) => (
              <SelectItem key={tp} value={tp}>
                {VEHICLE_TYPE_LABEL[tp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={unit} onValueChange={(v) => resetPage(setUnit)(v)}>
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Filtrar por unidade">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {(units ?? []).map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={criticality}
          onValueChange={(v) => resetPage(setCriticality)(v as Criticality | 'all')}
        >
          <SelectTrigger className="w-full md:w-[160px]" aria-label="Filtrar por criticidade">
            <SelectValue placeholder="Criticidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda criticidade</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <PermissionGuard permission="vehicles.view">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          getRowId={(v) => v.id}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          onRowClick={(v) => navigate(`/app/veiculos/${v.id}`)}
          sort={sort}
          onSortChange={setSort}
          emptyState={
            <EmptyState
              title="Nenhum veículo encontrado"
              description="Ajuste os filtros ou cadastre um novo veículo para começar."
            />
          }
        />

        {data && data.total > 0 && (
          <DataTablePagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </PermissionGuard>

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
