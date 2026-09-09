import { LogoutIcon, SettingsIcon } from '@/components/icons';
import { Link, useNavigate } from 'react-router';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { useSessionStore } from '@/stores/session-store';

export function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  const { user, tenant } = useSession();
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();

  if (!user) return null;

  const signOut = () => {
    logout();
    navigate('/');
  };

  /* Mesmo desenho e mesma mecânica do "sair" do menu da conta: a cor é a de
     remover (`.acao-sair`) e o hover fecha um degrau dessa cor, sem desenhar
     forma nova. Mexeu num, espelhe no outro. */
  const logoutButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={signOut}
      aria-label="Sair"
      title="Sair"
      className={cn(
        'acao-sair h-11 w-11 shrink-0 rounded-full bg-card hover:bg-card',
        'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
      )}
    >
      <LogoutIcon className="h-[18px] w-[18px]" />
    </Button>
  );

  /*
   * Recolhida a barra é um trilho de pastilhas, e o rodapé segue a mesma
   * gramática: avatar em cima, sair embaixo, os dois como discos soltos sobre o
   * papel. Sem traço divisório: no trilho não existe casca para dividir.
   */
  if (collapsed) {
    return (
      <div className="relative flex flex-col items-center gap-2 p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/app/configuracoes"
              aria-label={`${user.name}: configurações`}
              className="rounded-full"
            >
              <Avatar className="h-11 w-11 border border-border/60">
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Configurações</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
          <TooltipContent side="right">Sair</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="relative border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 border border-sidebar-border">
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{tenant?.name}</p>
        </div>
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link to="/app/configuracoes" aria-label="Configurações">
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="Sair"
          title="Sair"
          className="acao-sair h-8 w-8 shrink-0"
        >
          <LogoutIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
