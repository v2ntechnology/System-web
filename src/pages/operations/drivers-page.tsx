import { ChevronRightIcon } from '@/components/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/shared/filters';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useDrivers } from '@/hooks/use-queries';
import { formatDate, getInitials, formatPercent } from '@/lib/format';
import { driverStatusDescriptor } from '@/lib/status-maps';
import { type Driver } from '@/types';

export default function DriversPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useDrivers(search);

  const columns: DataTableColumn<Driver>[] = [
    {
      id: 'name',
      header: 'Motorista',
      cell: (d) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px]">{getInitials(d.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-muted-foreground">{d.registration}</p>
          </div>
        </div>
      ),
    },
    { id: 'cnh', header: 'CNH', cell: (d) => `Cat. ${d.cnhCategory}` },
    { id: 'cnhExp', header: 'Validade CNH', cell: (d) => formatDate(d.cnhExpiration) },
    {
      id: 'vehicle',
      header: 'Veículo atual',
      cell: (d) => d.currentVehiclePlate ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'score',
      header: 'Pontuação',
      align: 'right',
      cell: (d) => (
        <Badge
          variant={
            d.drivingScore >= 85 ? 'success' : d.drivingScore >= 75 ? 'warning' : 'destructive'
          }
        >
          {d.drivingScore}
        </Badge>
      ),
    },
    {
      id: 'consumption',
      header: 'Consumo médio',
      align: 'right',
      cell: (d) => `${d.avgConsumptionKmL} km/L`,
    },
    {
      id: 'onTime',
      header: 'No prazo',
      align: 'right',
      cell: (d) => formatPercent(d.onTimeDeliveryRate),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (d) => <StatusBadge descriptor={driverStatusDescriptor(d.status)} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: () => <ChevronRightIcon className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Desempenho, segurança e conformidade dos condutores da frota."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou matrícula"
        className="w-full md:max-w-xs"
        aria-label="Buscar motoristas"
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(d) => navigate(`/app/motoristas/${d.id}`)}
        emptyState={
          <EmptyState
            title="Nenhum motorista encontrado"
            description="Ajuste a busca e tente novamente."
          />
        }
      />
    </div>
  );
}
