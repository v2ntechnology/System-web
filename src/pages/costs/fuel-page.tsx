import { FuelIcon, GaugeIcon, MoneyIcon, WarningIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/states';
import {
  HeroPill,
  HeroStats,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { SearchInput } from '@/components/shared/filters';
import { Badge } from '@/components/ui/badge';
import { useFuel } from '@/hooks/use-queries';
import { formatDate, formatCurrency } from '@/lib/format';
import { type FuelRecord } from '@/types';

export default function FuelPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useFuel(search);

  const all = useMemo(() => data ?? [], [data]);

  const stats: HeroStat[] = useMemo(() => {
    const anomalies = all.filter((r) => r.hasAnomaly).length;
    const liters = all.reduce((total, r) => total + r.liters, 0);
    const spent = all.reduce((total, r) => total + r.totalValue, 0);
    /* Média ponderada pelos litros, e não média das médias: um abastecimento de
       40 L não pesa o mesmo que um de 400 L. */
    const consumption = liters
      ? all.reduce((total, r) => total + r.computedConsumptionKmL * r.liters, 0) / liters
      : 0;

    return [
      {
        key: 'registros',
        label: 'Abastecimentos',
        value: all.length,
        hint: `${liters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} litros no total`,
        icon: FuelIcon,
      },
      {
        key: 'gasto',
        label: 'Valor abastecido',
        value: formatCurrency(spent),
        hint: 'soma dos registros listados',
        icon: MoneyIcon,
      },
      {
        key: 'consumo',
        label: 'Consumo médio',
        value: `${consumption.toFixed(1)} km/L`,
        hint: 'ponderado pelos litros',
        icon: GaugeIcon,
      },
      {
        key: 'anomalias',
        label: 'Com anomalia',
        value: anomalies,
        hint: anomalies > 0 ? 'consumo fora da curva' : 'nada fora da curva',
        icon: WarningIcon,
        tone: anomalies > 0 ? 'alert' : 'neutral',
      },
    ];
  }, [all]);

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
            <WarningIcon className="h-3 w-3" />
            {r.computedConsumptionKmL} km/L
          </Badge>
        ) : (
          `${r.computedConsumptionKmL} km/L`
        ),
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Abastecimentos"
        description="Registros de abastecimento com cálculo de consumo e detecção de anomalias."
      >
        <HeroPill icon={FuelIcon}>
          {all.length} {all.length === 1 ? 'registro' : 'registros'}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel className="space-y-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por veículo, motorista ou posto"
          className="w-full md:max-w-xs"
          aria-label="Buscar abastecimentos"
        />
        <DataTable
          columns={columns}
          data={all}
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
      </PagePanel>
    </div>
  );
}
