import { BellIcon, CheckCircleIcon, ClockIcon, WarningIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { SeverityBadge, StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import {
  HeroPill,
  HeroStats,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlerts } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { alertStatusDescriptor } from '@/lib/status-maps';
import { ALERT_CATEGORY_LABEL } from '@/mocks/intelligence/alerts';
import { type AlertCategory, type OperationAlert, type Severity } from '@/types';

export default function AlertsPage() {
  const { data, isLoading, isError, refetch } = useAlerts();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [category, setCategory] = useState<AlertCategory | 'all'>('all');

  const filtered = useMemo(() => {
    let result = data ?? [];
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          (a.vehiclePlate ?? '').toLowerCase().includes(term),
      );
    }
    if (severity !== 'all') result = result.filter((a) => a.severity === severity);
    if (category !== 'all') result = result.filter((a) => a.category === category);
    return result;
  }, [data, search, severity, category]);

  const columns: DataTableColumn<OperationAlert>[] = [
    { id: 'severity', header: 'Severidade', cell: (a) => <SeverityBadge severity={a.severity} /> },
    {
      id: 'title',
      header: 'Alerta',
      cell: (a) => (
        <div>
          <p className="font-medium">{a.title}</p>
          <p className="text-xs text-muted-foreground">{a.source}</p>
        </div>
      ),
    },
    { id: 'category', header: 'Categoria', cell: (a) => ALERT_CATEGORY_LABEL[a.category] },
    {
      id: 'vehicle',
      header: 'Veículo',
      cell: (a) =>
        a.vehiclePlate ? <span className="font-mono text-sm">{a.vehiclePlate}</span> : '—',
    },
    {
      id: 'date',
      header: 'Data',
      cell: (a) => <span className="text-xs">{formatDateTime(a.date)}</span>,
    },
    {
      id: 'assignee',
      header: 'Responsável',
      cell: (a) => a.assignee ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'status',
      header: 'Tratativa',
      cell: (a) => <StatusBadge descriptor={alertStatusDescriptor(a.status)} />,
    },
  ];

  const all = data ?? [];
  const critical = all.filter((a) => a.severity === 'critical').length;
  const high = all.filter((a) => a.severity === 'high').length;
  const open = all.filter((a) => a.status === 'open').length;
  const resolved = all.filter((a) => a.status === 'resolved').length;

  const stats: HeroStat[] = [
    { key: 'total', label: 'Alertas', value: all.length, hint: 'no período', icon: BellIcon },
    {
      key: 'criticos',
      label: 'Críticos',
      value: critical,
      hint: critical > 0 ? 'exigem ação agora' : 'nenhum crítico',
      icon: WarningIcon,
      tone: critical > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'abertos',
      label: 'Em aberto',
      value: open,
      hint: `${high} de severidade alta`,
      icon: ClockIcon,
      tone: high > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'resolvidos',
      label: 'Resolvidos',
      value: resolved,
      hint: 'já tratados',
      icon: CheckCircleIcon,
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Alertas"
        description="Central de alertas operacionais, de segurança e conformidade."
      >
        <HeroPill icon={BellIcon}>
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
            placeholder="Buscar alerta ou veículo"
            className="w-full md:max-w-xs"
            aria-label="Buscar alertas"
          />
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | 'all')}>
            <SelectTrigger className="w-full md:w-[170px]" aria-label="Filtrar por severidade">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda severidade</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => setCategory(v as AlertCategory | 'all')}>
            <SelectTrigger className="w-full md:w-[170px]" aria-label="Filtrar por categoria">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(Object.keys(ALERT_CATEGORY_LABEL) as AlertCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {ALERT_CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          getRowId={(a) => a.id}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          emptyState={
            <EmptyState
              title="Nenhum alerta encontrado"
              description="Ajuste os filtros e tente novamente."
            />
          }
        />
      </PagePanel>
    </div>
  );
}
