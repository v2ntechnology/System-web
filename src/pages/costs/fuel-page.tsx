import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/shared/filters';
import { Badge } from '@/components/ui/badge';
import { useFuel } from '@/hooks/use-queries';
import { formatDate, formatCurrency } from '@/lib/format';
import { type FuelRecord } from '@/types';

export default function FuelPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useFuel(search);

  const columns: DataTableColumn<FuelRecord>[] = [
    { id: 'date', header: 'Data', cell: (r) => formatDate(r.date) },
    {
      id: 'vehicle',
      header: 'Veículo',
      cell: (r) => <span className="font-mono text-sm">{r.vehiclePlate}</span>,
    },
    { id: 'driver', header: 'Motorista', cell: (r) => r.driverName },
    { id: 'station', header: 'Posto', cell: (r) => r.station },
    { id: 'liters', header: 'Litros', align: 'right', cell: (r) => `${r.liters} L` },
    { id: 'value', header: 'Valor', align: 'right', cell: (r) => formatCurrency(r.totalValue) },
    { id: 'price', header: 'R$/L', align: 'right', cell: (r) => formatCurrency(r.pricePerLiter) },
    {
      id: 'odometer',
      header: 'Hodômetro',
      align: 'right',
      cell: (r) => `${r.odometerKm.toLocaleString('pt-BR')} km`,
    },
    {
      id: 'consumption',
      header: 'Consumo',
      align: 'right',
      cell: (r) =>
        r.hasAnomaly ? (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3" />
            {r.computedConsumptionKmL} km/L
          </Badge>
        ) : (
          `${r.computedConsumptionKmL} km/L`
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abastecimentos"
        description="Registros de abastecimento com cálculo de consumo e detecção de anomalias."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por veículo, motorista ou posto"
        className="w-full md:max-w-xs"
        aria-label="Buscar abastecimentos"
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={
          <EmptyState
            title="Nenhum abastecimento"
            description="Ajuste a busca e tente novamente."
          />
        }
      />
    </div>
  );
}
