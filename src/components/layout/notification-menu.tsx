import { Bell } from 'lucide-react';
import { Link } from 'react-router';

import { SeverityBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlerts } from '@/hooks/use-queries';
import { formatRelative } from '@/lib/format';

export function NotificationMenu() {
  const { data: alerts } = useAlerts();
  const openAlerts = (alerts ?? []).filter(
    (a) => a.status === 'open' || a.status === 'in_progress',
  );
  const preview = openAlerts.slice(0, 4);
  const badge = openAlerts.length > 9 ? '9+' : String(openAlerts.length);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // O `size-4` que o Button aplica a todo svg vence a classe do ícone; o tamanho do sino tem que vir daqui.
          className="relative h-10 w-10 rounded-full [&_svg]:size-[22px]"
          aria-label={
            openAlerts.length > 0
              ? `Notificações: ${openAlerts.length} ativas`
              : 'Notificações: nenhuma ativa'
          }
        >
          <Bell />
          {openAlerts.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
              {badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notificações</p>
          <span className="text-xs text-muted-foreground">{openAlerts.length} ativas</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação ativa.
            </p>
          ) : (
            preview.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col gap-1 border-b border-border/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">{alert.title}</p>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {alert.vehiclePlate ? `${alert.vehiclePlate} · ` : ''}
                  {formatRelative(alert.date)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/app/alertas">Ver todos os alertas</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
