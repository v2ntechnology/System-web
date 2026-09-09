import {
  BoxesIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  MaintenanceIcon,
  PlusIcon,
  WarningIcon,
} from '@/components/icons';
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
import { HeroStats, PageHero, PagePanel, type HeroStat } from '@/components/layout/page-hero';
import { PermissionGuard } from '@/components/shared/guards';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-session';
import { useFleetOverview, useVehicleUnits, useVehicles } from '@/hooks/use-queries';
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
      cell: () => <ChevronRightIcon className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  /*
   * ⚠️ Os números vêm do resumo da frota, e NÃO da página da tabela: `data.data`
   * é só a página corrente, e "3 disponíveis" contando 20 de 180 veículos seria
   * mentira. O `useFleetOverview` é a mesma consulta de `/app/frota`, então o
   * react-query devolve do cache quem já passou por lá.
   */
  const { data: overview } = useFleetOverview();

  const stats: HeroStat[] = overview
    ? [
        { key: 'total', label: 'Total de veículos', value: overview.total, icon: BoxesIcon },
        {
          key: 'disponiveis',
          label: 'Disponíveis',
          value: overview.available,
          hint: 'prontos para sair',
          icon: CheckCircleIcon,
        },
        {
          key: 'manutencao',
          label: 'Em manutenção',
          value: overview.maintenance,
          hint: 'fora de operação',
          icon: MaintenanceIcon,
          tone: overview.maintenance > 0 ? 'warn' : 'neutral',
        },
        {
          key: 'alertas',
          label: 'Com alertas',
          value: overview.withAlerts,
          hint: overview.withAlerts > 0 ? 'exigem atenção' : 'nenhum alerta aberto',
          icon: WarningIcon,
          tone: overview.withAlerts > 0 ? 'alert' : 'neutral',
        },
      ]
    : [];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Veículos"
        description="Gestão completa da frota com filtros, busca e status em tempo real."
      >
        {/* ⚠️ Sobre a faixa o destaque é BRANCO, nunca um segundo laranja: com a
            marca reduzida a um único #D5623A, botão e fundo ficariam do mesmo
            tom. É a mesma regra do `HeroPill` do painel de gestão. */}
        {hasPermission('vehicles.create') && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="text-label-md bg-on-primary text-primary-on-light focus-visible:ring-on-primary inline-flex items-center gap-2 rounded-md px-3.5 py-2 font-medium normal-case transition-colors hover:bg-[color-mix(in_oklab,var(--color-on-primary)_88%,black)] focus-visible:outline-none focus-visible:ring-2"
          >
            <PlusIcon className="h-4 w-4" />
            Cadastrar veículo
          </button>
        )}
      </PageHero>

      {stats.length > 0 && <HeroStats items={stats} />}

      <PagePanel className={cn('space-y-6', stats.length === 0 && 'mt-6')}>
        {/* O seletor de período desceu da faixa para os filtros: ele recorta a
            lista, e é aqui que mora o resto do recorte. */}
        <FilterBar>
          <DateRangeSelector value="30d" onChange={() => {}} />
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
      </PagePanel>

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
