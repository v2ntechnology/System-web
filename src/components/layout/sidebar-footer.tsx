import { SettingsIcon } from '@/components/icons';
import { Link } from 'react-router';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';

export function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  const { user, tenant } = useSession();
  if (!user) return null;

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
        <Avatar className="h-9 w-9 border border-sidebar-border">
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{tenant?.name}</p>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Link to="/app/configuracoes" aria-label="Configurações">
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
