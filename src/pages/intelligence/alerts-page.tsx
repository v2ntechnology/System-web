import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { SeverityBadge, StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        description="Central de alertas operacionais, de segurança e conformidade."
      />

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
    </div>
  );
}
