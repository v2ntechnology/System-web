import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { SeverityBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ALERT_CATEGORY_LABEL } from '@/mocks/intelligence/alerts';
import { formatRelative } from '@/lib/format';
import type { OperationAlert } from '@/types';

export function RecentAlerts({ alerts }: { alerts: OperationAlert[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alertas recentes</CardTitle>
        <Link
          to="/app/alertas"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 rounded-md border border-border/60 p-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium leading-tight">{alert.title}</p>
              <p className="text-xs text-muted-foreground">
                {ALERT_CATEGORY_LABEL[alert.category]}
                {alert.vehiclePlate ? ` · ${alert.vehiclePlate}` : ''} ·{' '}
                {formatRelative(alert.date)}
              </p>
            </div>
            <SeverityBadge severity={alert.severity} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
