import { CreditCard, LogOut, Settings, ShieldCheck, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router';

import { ROLE_LABELS } from '@/app/permissions';
import { usePermissions, useSession } from '@/hooks/use-session';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';

import { DemoMenu } from './demo-controls';
import { ThemeMenuItem } from './theme-toggle';

export function UserMenu() {
  const { user } = useSession();
  const { hasPermission } = usePermissions();
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:pl-1.5 sm:pr-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-[15px] font-medium sm:inline">
            {user.name.split(' ')[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs font-normal text-primary">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/app/configuracoes')}>
          <Settings />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/configuracoes')}>
          <UserCog />
          Perfil e conta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/planos')}>
          <CreditCard />
          Plano e cobrança
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItem />
        <DemoMenu />
        {hasPermission('saas.manage') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin-saas/dashboard')}>
              <ShieldCheck />
              Administração SaaS
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
