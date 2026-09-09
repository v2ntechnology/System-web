import {
  CameraIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClockIcon,
  WarningIcon,
} from '@/components/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import {
  HeroPill,
  HeroStats,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
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

  const all = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    let result = all;
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (c) =>
          c.vehiclePlate.toLowerCase().includes(term) || c.driverName.toLowerCase().includes(term),
      );
    }
    if (status !== 'all') result = result.filter((c) => c.status === status);
    return result;
  }, [all, search, status]);

  /* Os números abrem a tela e não dependem do filtro: eles descrevem a operação
     inteira, e o filtro é recorte de quem está procurando alguma coisa. */
  const stats: HeroStat[] = useMemo(() => {
    const critical = all.filter((c) => c.status === 'critical').length;
    const withIssue = all.filter((c) => c.status === 'with_issue').length;
    const pending = all.filter((c) => c.status === 'pending').length;
    const irregular = all.reduce((total, c) => total + c.irregularItems, 0);

    return [
      {
        key: 'total',
        label: 'Checklists',
        value: all.length,
        hint: 'recebidos no período',
        icon: ChecklistIcon,
      },
      {
        key: 'criticos',
        label: 'Críticos',
        value: critical,
        hint: critical > 0 ? 'exigem tratativa agora' : 'nenhum crítico aberto',
        icon: WarningIcon,
        tone: critical > 0 ? 'alert' : 'neutral',
      },
      {
        key: 'ocorrencias',
        label: 'Com ocorrência',
        value: withIssue,
        hint: `${irregular} ${irregular === 1 ? 'item irregular' : 'itens irregulares'} no total`,
        icon: CameraIcon,
        tone: withIssue > 0 ? 'warn' : 'neutral',
      },
      {
        key: 'pendentes',
        label: 'Pendentes',
        value: pending,
        hint: 'aguardando preenchimento',
        icon: ClockIcon,
      },
    ];
  }, [all]);

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
          <CameraIcon className="h-3.5 w-3.5" />
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
      cell: () => <ChevronRightIcon className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Checklists"
        description="Inspeções digitais de devolução dos veículos, com evidências e ocorrências."
      >
        <HeroPill icon={ChecklistIcon}>
          {filtered.length === all.length
            ? `${all.length} no total`
            : `${filtered.length} de ${all.length}`}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel className="space-y-6">
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
      </PagePanel>
    </div>
  );
}
