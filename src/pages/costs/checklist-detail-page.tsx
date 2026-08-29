import {
  ArrowLeftIcon,
  CameraIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  WarningIcon,
  XCircleIcon,
} from '@/components/icons';
import { useNavigate, useParams } from 'react-router';

import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChecklist } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { checklistStatusDescriptor } from '@/lib/status-maps';
import { cn } from '@/lib/utils';
import { type ChecklistItem } from '@/types';

const ITEM_STYLE: Record<
  ChecklistItem['status'],
  { icon: typeof CheckCircleIcon; className: string; label: string }
> = {
  ok: { icon: CheckCircleIcon, className: 'text-success', label: 'OK' },
  attention: { icon: WarningIcon, className: 'text-warning', label: 'Atenção' },
  critical: { icon: XCircleIcon, className: 'text-destructive', label: 'Crítico' },
  not_applicable: { icon: MinusCircleIcon, className: 'text-muted-foreground', label: 'N/A' },
};

export default function ChecklistDetailPage() {
  const { checklistId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useChecklist(checklistId);

  if (isLoading) return <LoadingState label="Carregando checklist…" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/checklists')}
          aria-label="Voltar"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Checklist · <span className="font-mono">{data.vehiclePlate}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.driverName} · {formatDateTime(data.date)}
          </p>
        </div>
        <StatusBadge descriptor={checklistStatusDescriptor(data.status)} />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="muted">{totalItems} itens verificados</Badge>
        {data.irregularItems > 0 && (
          <Badge variant="warning">{data.irregularItems} irregularidades</Badge>
        )}
        <Badge variant="info">
          <CameraIcon className="h-3 w-3" />
          {data.photosCount} evidências
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {section.items.map((item) => {
                const style = ITEM_STYLE[item.status];
                const Icon = style.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 border-b border-border/50 py-2 last:border-0"
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.className)} />
                    <div className="flex-1">
                      <p className="text-sm">{item.label}</p>
                      {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
