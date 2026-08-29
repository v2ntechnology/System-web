import {
  BillingIcon,
  CheckIcon,
  CloseIcon,
  ExtensionIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  PaletteIcon,
  SettingsIcon,
} from '@/components/icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Avatar, cn } from '@/management/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { RookhubLogo } from '@/management/components/brand/rookhub-logo';
import { NotificationsBell } from '@/management/features/notifications/components/notifications-bell';
import { ThemeSwitch } from '@/management/features/appearance/components/theme-switch';
import { useAppearanceStore } from '@/management/features/appearance/store';
import { useSession } from '@/management/features/auth/store';
import { HUB_ROLES, ROLE_LABELS } from '@/app/permissions';
import { useSessionStore } from '@/stores/session-store';
import { useThemeStore } from '@/stores/theme-store';

import { AppNav, AppNavMobile } from './app-nav';

/**
 * Linha do menu. Extraído porque já são sete itens repetindo a mesma string.
 *
 * `opacity-60` e não menos no item desabilitado: a 45% o texto cai para 3,8:1
 * sobre `surface-low`. A WCAG isenta controle inativo, mas o aviso de um item
 * travado precisa **poder ser lido**; a 60% dá 5,8:1 e continua visivelmente
 * apagado ao lado dos ativos.
 */
const itemClass =
  'text-on-surface text-body-md data-[highlighted]:bg-on-surface/8 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none transition-colors data-[disabled]:cursor-default data-[disabled]:opacity-60';

/**
 * Barra superior do painel, sobreposta ao banner.
 *
 * Fundo transparente: a legibilidade vem do gradiente escuro que o banner aplica
 * no próprio topo, não de uma superfície aqui.
 */
export function AppTopbar() {
  const session = useSession();
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = session?.user.role === 'OWNER';
  /* Quem escolheu entrar pela hub precisa da porta de volta para ela. */
  const usesHub = session ? HUB_ROLES.includes(session.user.role) : false;

  /* O tema é do produto inteiro, não do painel: mesma store do painel operacional. */
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const highPerformance = useAppearanceStore((state) => state.highPerformance);
  const setHighPerformance = useAppearanceStore((state) => state.setHighPerformance);

  function signOut() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    /* z-[1000]: o menu suspenso vive dentro desta barra, e um contexto de
       empilhamento baixo aqui prenderia o z-index dele. */
    <div className="relative z-[1000]">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-4 sm:px-6">
        <Link
          to="/gestao"
          aria-label="RookHub — ir para a visão geral"
          className="focus-visible:ring-secondary shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2"
        >
          <RookhubLogo variant="lockup" className="h-7 sm:h-8" />
        </Link>

        <AppNav />

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <NotificationsBell />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`Conta de ${session?.user.name ?? 'usuário'}`}
                className="rounded-pill focus-visible:ring-secondary focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {/* Sobre a foto do banner: o anel é branco nos dois temas. */}
                <Avatar
                  name={session?.user.name ?? 'Usuário'}
                  className="size-10 ring-2 ring-white/20"
                />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="bg-surface-low ring-outline-variant z-[1000] min-w-56 rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1"
              >
                <div className="border-outline-variant mb-1 border-b px-3 pb-3 pt-1">
                  <p className="text-on-surface truncate font-medium">{session?.user.name}</p>
                  <p className="text-on-surface-muted text-label-md truncate normal-case">
                    {session ? ROLE_LABELS[session.user.role] : null} · {session?.tenant.name}
                  </p>
                </div>

                {/*
                 * A hub é a antessala de quem escolhe entre IA e gestão (dono e
                 * gestor). Única porta de volta: por decisão do usuário em
                 * 19/08/2026 o atalho saiu da barra e vive só aqui.
                 */}
                {usesHub ? (
                  <DropdownMenu.Item asChild>
                    <Link to="/painel" className={itemClass}>
                      <HomeIcon size={16} aria-hidden="true" />
                      Painel de escolha
                    </Link>
                  </DropdownMenu.Item>
                ) : null}

                {/* Cobrança e extensões mexem no contrato — só o dono (RF-003). */}
                {isOwner ? (
                  <>
                    <DropdownMenu.Item asChild>
                      <Link to="/gestao/cobranca" className={itemClass}>
                        <BillingIcon size={16} aria-hidden="true" />
                        Plano e cobrança
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item asChild>
                      <Link to="/gestao/extensoes" className={itemClass}>
                        <ExtensionIcon size={16} aria-hidden="true" />
                        Extensões
                      </Link>
                    </DropdownMenu.Item>
                  </>
                ) : null}

                {/*
                 * Alto desempenho saiu do submenu "Aparência" e virou linha
                 * direta: com o tema no rodapé, o submenu ficaria com uma única
                 * opção dentro, e um nível a mais para chegar num interruptor.
                 */}
                <DropdownMenu.CheckboxItem
                  checked={highPerformance}
                  onCheckedChange={setHighPerformance}
                  /* Mesmo `itemClass` dos demais: o ícone fica na mesma coluna e a
                     marca de ligado vai para a direita, sem recuo extra. */
                  className={itemClass}
                >
                  <PaletteIcon size={16} aria-hidden="true" />
                  Alto desempenho
                  <DropdownMenu.ItemIndicator className="ml-auto">
                    <CheckIcon size={14} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.CheckboxItem>

                <DropdownMenu.Item asChild>
                  <Link to="/gestao/configuracoes" className={itemClass}>
                    <SettingsIcon size={16} aria-hidden="true" />
                    Configurações
                  </Link>
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="bg-outline-variant my-2 h-px" />

                {/*
                 * Rodapé: tema à esquerda, sair à direita.
                 *
                 * O item que embrulha o seletor é o caminho de teclado: a seta
                 * para nele, o rótulo diz em que tema se está e Enter alterna.
                 * `preventDefault` mantém o menu aberto, porque quem compara os
                 * dois temas alterna algumas vezes seguidas.
                 */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <DropdownMenu.Item
                    asChild
                    aria-label={
                      theme === 'dark'
                        ? 'Tema escuro. Ativar tema claro'
                        : 'Tema claro. Ativar tema escuro'
                    }
                    onSelect={(event) => {
                      event.preventDefault();
                      toggleTheme();
                    }}
                    className="outline-none data-[highlighted]:bg-transparent"
                  >
                    <div>
                      <ThemeSwitch />
                    </div>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    asChild
                    onSelect={signOut}
                    className="outline-none data-[highlighted]:bg-transparent"
                  >
                    <button
                      type="button"
                      aria-label="Sair"
                      title="Sair"
                      /* Gêmeo do botão de sair do painel operacional (decisão do
                         usuário em 19/08/2026): quadrado de canto arredondado, e o
                         hover mostra só o contorno vermelho, sem preencher o fundo. */
                      className="text-error hover:ring-error/60 focus-visible:ring-error flex size-9 cursor-pointer items-center justify-center rounded-[10px] ring-1 ring-inset ring-transparent transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <LogoutIcon size={18} />
                    </button>
                  </DropdownMenu.Item>
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(
              'text-on-media rounded-pill focus-visible:ring-secondary flex size-10 items-center justify-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 lg:hidden',
            )}
          >
            {menuOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="bg-surface-low ring-outline-variant mx-4 mb-2 rounded-lg p-2 ring-1 lg:hidden">
          <AppNavMobile onNavigate={() => setMenuOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
