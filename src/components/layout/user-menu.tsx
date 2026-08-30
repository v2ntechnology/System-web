import {
  BillingIcon,
  LogoutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserSettingsIcon,
} from '@/components/icons';
import { useNavigate } from 'react-router';

import { ROLE_LABELS, canUseDemoControls } from '@/app/permissions';
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
import { useThemeStore } from '@/stores/theme-store';

import { DemoMenu } from './demo-controls';
import { ThemeSwitch } from './theme-toggle';

export function UserMenu() {
  const { user } = useSession();
  const { hasPermission } = usePermissions();
  const logout = useSessionStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  if (!user) return null;

  const showDemoControls = canUseDemoControls(user.role);

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
          <SettingsIcon />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/configuracoes')}>
          <UserSettingsIcon />
          Perfil e conta
        </DropdownMenuItem>
        {/* Contrato e fatura são do proprietário: o menu segue a mesma permissão
            que já governa a tela `/app/planos` na navegação lateral. */}
        {hasPermission('billing.manage') && (
          <DropdownMenuItem onClick={() => navigate('/app/planos')}>
            <BillingIcon />
            Plano e cobrança
          </DropdownMenuItem>
        )}
        {showDemoControls && (
          <>
            <DropdownMenuSeparator />
            <DemoMenu />
          </>
        )}
        {hasPermission('saas.manage') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin-saas/dashboard')}>
              <ShieldCheckIcon />
              Administração SaaS
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />

        {/*
         * Rodapé do menu: tema à esquerda, sair à direita. As duas ações que não
         * levam a lugar nenhum ficam fora da lista de destinos.
         *
         * O item que embrulha o seletor é o caminho de teclado: as setas param
         * nele, o rótulo diz em que tema se está e Enter alterna. `preventDefault`
         * mantém o menu aberto, porque quem compara claro e escuro alterna duas
         * ou três vezes seguidas.
         */}
        <div className="flex items-center justify-between gap-2 px-1 py-0.5">
          <DropdownMenuItem
            asChild
            aria-label={
              theme === 'dark' ? 'Tema escuro. Ativar tema claro' : 'Tema claro. Ativar tema escuro'
            }
            onSelect={(event) => {
              event.preventDefault();
              toggleTheme();
            }}
            className="p-0 focus:bg-transparent"
          >
            <div>
              <ThemeSwitch />
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            onClick={() => {
              logout();
              navigate('/');
            }}
            /* Mesmo desenho e mesmo hover do botão de sair do painel de gestão
               (decisão do usuário em 19/08/2026, hover revisto em 30/08/2026):
               quadrado de 36px com canto de 10px e ícone de 18px. O hover era um
               contorno vermelho aparecendo, e virou a própria cor um degrau mais
               fechada, que é a mecânica de todo botão só-ícone do sistema (ver
               `.acao-*` em `globals.css`). Mexeu num, espelhe no outro.
               As classes ficam no item, e não no `<button>`: com `asChild` o
               Slot só concatena as duas listas, então o raio e o tamanho do
               ícone da base venceriam. Aqui elas passam pelo `cn` do item. */
            className="acao-sair size-9 justify-center rounded-[10px] p-0 focus:bg-transparent focus-visible:ring-2 focus-visible:ring-destructive [&_svg]:size-[18px]"
          >
            <button type="button" aria-label="Sair" title="Sair">
              <LogoutIcon />
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
