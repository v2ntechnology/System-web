import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  CaretRightIcon,
  CheckIcon,
  CreditCardIcon,
  GearSixIcon,
  ListIcon,
  PaletteIcon,
  PuzzlePieceIcon,
  SignOutIcon,
  SparkleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Avatar, cn } from '@/management/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { RookhubLogo } from '@/management/components/brand/rookhub-logo';
import { NotificationsBell } from '@/management/features/notifications/components/notifications-bell';
import {
  THEME_AVAILABILITY,
  useAppearanceStore,
  type ThemeChoice,
} from '@/management/features/appearance/store';
import { useSession } from '@/management/features/auth/store';
import { HUB_ROLES, ROLE_LABELS } from '@/app/permissions';
import { useSessionStore } from '@/stores/session-store';

import { AppNav, AppNavMobile } from './app-nav';

/**
 * Linha do menu. Extraído porque já são sete itens repetindo a mesma string.
 *
 * `opacity-60` e não menos no item desabilitado: a 45% o texto cai para 3,8:1
 * sobre `surface-low`. A WCAG isenta controle inativo, mas quem lê "Claro — em
 * breve" precisa **conseguir ler** o aviso; a 60% dá 5,8:1 e continua
 * visivelmente apagado ao lado dos ativos.
 */
const itemClass =
  'text-on-surface text-body-md data-[highlighted]:bg-white/8 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none transition-colors data-[disabled]:cursor-default data-[disabled]:opacity-60';

/** Item de escolha: abre espaço à esquerda para a marca de selecionado. */
const choiceClass = `${itemClass} relative pl-8`;

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

  const theme = useAppearanceStore((state) => state.theme);
  const setTheme = useAppearanceStore((state) => state.setTheme);
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
                 * gestor). Sem a porta de volta, quem entrou no sistema ficaria
                 * preso no painel até deslogar.
                 */}
                {usesHub ? (
                  <DropdownMenu.Item asChild>
                    <Link to="/painel" className={itemClass}>
                      <SparkleIcon size={16} weight="duotone" aria-hidden="true" />
                      Painel de escolha
                    </Link>
                  </DropdownMenu.Item>
                ) : null}

                {/* Cobrança e extensões mexem no contrato — só o dono (RF-003). */}
                {isOwner ? (
                  <>
                    <DropdownMenu.Item asChild>
                      <Link to="/gestao/cobranca" className={itemClass}>
                        <CreditCardIcon size={16} weight="duotone" aria-hidden="true" />
                        Plano e cobrança
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item asChild>
                      <Link to="/gestao/extensoes" className={itemClass}>
                        <PuzzlePieceIcon size={16} weight="duotone" aria-hidden="true" />
                        Extensões
                      </Link>
                    </DropdownMenu.Item>
                  </>
                ) : null}

                {/* ---------------------------------------------------------
                 * Aparência — submenu, para não empurrar Sair para baixo da
                 * dobra num menu que já tem sete linhas.
                 * ------------------------------------------------------- */}
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={itemClass}>
                    <PaletteIcon size={16} weight="duotone" aria-hidden="true" />
                    Aparência
                    <CaretRightIcon
                      size={12}
                      weight="bold"
                      className="ml-auto"
                      aria-hidden="true"
                    />
                  </DropdownMenu.SubTrigger>

                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={6}
                      className="bg-surface-low ring-outline-variant z-[1000] min-w-60 rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1"
                    >
                      <p className="text-on-surface-muted text-label-md px-3 py-1.5 normal-case">
                        Tema
                      </p>

                      <DropdownMenu.RadioGroup
                        value={theme}
                        onValueChange={(next) => setTheme(next as ThemeChoice)}
                      >
                        <DropdownMenu.RadioItem value="dark" className={choiceClass}>
                          <DropdownMenu.ItemIndicator className="absolute left-3">
                            <CheckIcon size={14} weight="bold" />
                          </DropdownMenu.ItemIndicator>
                          Escuro
                        </DropdownMenu.RadioItem>

                        {/*
                         * Claro aparece desabilitado, não escondido: o grafite é
                         * âncora de produto (regra 1) e o tema claro exige
                         * rederivar a rampa e revisar os componentes que hoje
                         * misturam as duas famílias. Esconder viraria a pergunta
                         * "cadê o tema claro?"; mostrar travado responde antes.
                         */}
                        <DropdownMenu.RadioItem
                          value="light"
                          disabled={!THEME_AVAILABILITY.light}
                          className={choiceClass}
                        >
                          <DropdownMenu.ItemIndicator className="absolute left-3">
                            <CheckIcon size={14} weight="bold" />
                          </DropdownMenu.ItemIndicator>
                          Claro
                          <span className="text-on-surface-muted text-label-sm ml-auto normal-case">
                            em breve
                          </span>
                        </DropdownMenu.RadioItem>
                      </DropdownMenu.RadioGroup>

                      <DropdownMenu.Separator className="bg-outline-variant my-2 h-px" />

                      <DropdownMenu.CheckboxItem
                        checked={highPerformance}
                        onCheckedChange={setHighPerformance}
                        className={choiceClass}
                      >
                        <DropdownMenu.ItemIndicator className="absolute left-3">
                          <CheckIcon size={14} weight="bold" />
                        </DropdownMenu.ItemIndicator>
                        Alto desempenho
                      </DropdownMenu.CheckboxItem>

                      <p className="text-on-surface-muted text-label-sm px-3 pb-1 pt-1.5 normal-case">
                        Desliga o efeito de vidro. Ajuda em aparelho mais simples.
                      </p>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>

                <DropdownMenu.Item asChild>
                  <Link to="/gestao/configuracoes" className={itemClass}>
                    <GearSixIcon size={16} weight="duotone" aria-hidden="true" />
                    Configurações
                  </Link>
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="bg-outline-variant my-2 h-px" />

                <DropdownMenu.Item onSelect={signOut} className={itemClass}>
                  <SignOutIcon size={16} weight="duotone" aria-hidden="true" />
                  Sair
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(
              'text-on-surface rounded-pill focus-visible:ring-secondary flex size-10 items-center justify-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 lg:hidden',
            )}
          >
            {menuOpen ? <XIcon size={22} /> : <ListIcon size={22} />}
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
