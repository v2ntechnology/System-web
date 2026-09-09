import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  UsersIcon,
  WarningIcon,
} from '@/components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import {
  HeroPill,
  HeroStats,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { SearchInput } from '@/components/shared/filters';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useDrivers } from '@/hooks/use-queries';
import { formatDate, getInitials, formatPercent } from '@/lib/format';
import { driverStatusDescriptor } from '@/lib/status-maps';
import { type Driver } from '@/types';

/*
 * CNH vencendo em 30 dias: é o prazo em que ainda dá para renovar sem tirar o
 * motorista da escala. Vencida também cai aqui, e é o caso urgente.
 *
 * ⚠️ Fora do componente de propósito: `Date.now()` no corpo do render é chamada
 * impura, e o React Compiler recusa (o mesmo motivo vale na triagem).
 */
function cnhExpiringSoon(expiration: string): boolean {
  return new Date(expiration).getTime() <= Date.now() + 30 * 24 * 3_600_000;
}

export default function DriversPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useDrivers(search);

  const all = useMemo(() => data?.data ?? [], [data]);

  const stats: HeroStat[] = useMemo(() => {
    const driving = all.filter((d) => d.status === 'driving').length;
    const lowScore = all.filter((d) => d.drivingScore < 75).length;
    const expiring = all.filter((d) => cnhExpiringSoon(d.cnhExpiration)).length;

    return [
      {
        key: 'total',
        label: 'Motoristas',
        value: all.length,
        hint: 'no cadastro',
        icon: UsersIcon,
      },
      {
        key: 'dirigindo',
        label: 'Em viagem',
        value: driving,
        hint: 'na estrada agora',
        icon: CheckCircleIcon,
      },
      {
        key: 'cnh',
        label: 'CNH a vencer',
        value: expiring,
        hint: expiring > 0 ? 'nos próximos 30 dias' : 'nenhuma vencendo',
        icon: ClockIcon,
        tone: expiring > 0 ? 'warn' : 'neutral',
      },
      {
        key: 'pontuacao',
        label: 'Pontuação baixa',
        value: lowScore,
        hint: lowScore > 0 ? 'abaixo de 75 pontos' : 'todos acima de 75',
        icon: WarningIcon,
        tone: lowScore > 0 ? 'alert' : 'neutral',
      },
    ];
  }, [all]);

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
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Motoristas"
        description="Desempenho, segurança e conformidade dos condutores da frota."
      >
        <HeroPill icon={UsersIcon}>
          {all.length} {all.length === 1 ? 'motorista' : 'motoristas'}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel className="space-y-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou matrícula"
          className="w-full md:max-w-xs"
          aria-label="Buscar motoristas"
        />
        <DataTable
          columns={columns}
          data={all}
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
      </PagePanel>
    </div>
  );
}
