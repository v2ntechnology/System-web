import { ArrowRightIcon, GaugeIcon } from '@/components/icons';
import { Link } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ActivityEvent, Severity } from '@/types';

const DOT: Record<Severity, string> = {
  critical: 'bg-destructive',
  high: 'bg-warning',
  medium: 'bg-info',
  low: 'bg-muted-foreground',
  info: 'bg-success',
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Atividade em tempo real</CardTitle>
        <Link
          to="/app/rastreamento"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver todos
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
          >
            <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', DOT[event.severity])} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{event.vehiclePlate}</p>
              <p className="truncate text-xs text-muted-foreground">
                {event.city}, {event.state}
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs font-medium">
                {event.speedKmh !== undefined && (
                  <GaugeIcon className="h-3 w-3 text-muted-foreground" />
                )}
                {event.status}
              </p>
              <p className="text-[11px] text-muted-foreground">{formatTime(event.time)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
