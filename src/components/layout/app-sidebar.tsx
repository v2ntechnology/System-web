import { MenuIcon } from '@/components/icons';
import { Link } from 'react-router';

import type { NavGroup } from '@/app/navigation';
import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';

import { SidebarFooter } from './sidebar-footer';
import { SidebarNav } from './sidebar-nav';

/**
 * Barra lateral do painel operacional.
 *
 * ⚠️ Desenho de TRILHO, pedido pelo usuário em 09/09/2026 a partir de uma
 * referência. Recolhida, a barra não tem casca própria: ela é o mesmo papel do
 * conteúdo, e quem desenha a coluna são as pastilhas redondas soltas em cima
 * dele. Por isso não há mais traço divisório nem fundo `bg-sidebar` no estado
 * recolhido: um retângulo cinza atrás dos discos devolveria a caixa que o
 * desenho quer justamente dissolver.
 *
 * Expandida ela volta a ser painel (com rótulo, grupo e traço), porque uma
 * coluna de 256px de texto sem nenhuma divisa encosta no conteúdo.
 */
export function AppSidebar({ navigation }: { navigation: NavGroup[] }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  const toggleLabel = collapsed ? 'Expandir menu' : 'Recolher menu';

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon"
      /* ⚠️ Este botão MANTÉM fundo, e não é exceção à regra dos botões só-ícone.
         O que a regra proíbe é o fundo APARECER no hover como realce; aqui ele
         já existe em repouso, porque a pastilha é o próprio alvo de clique no
         trilho. Quem responde ao cursor continua sendo a cor do traço, via
         `.acao-neutra`. O `hover:bg-card` anula o `hover:bg-transparent` que o
         botão herda de ghost + icon. */
      className={cn(
        'h-11 w-11 shrink-0 rounded-full bg-card',
        'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
        'hover:bg-card',
      )}
      onClick={toggleCollapsed}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <MenuIcon className="h-[18px] w-[18px]" />
    </Button>
  );

  return (
    <aside
      className={cn(
        /*
         * ⚠️ A curva e as durações são as MESMAS do drawer do assistente (pedido
         * do usuário em 09/09/2026, que queria o trilho abrindo com a mesma
         * fluidez): `ease-out` no lugar de `ease-in-out`, e o tempo assimétrico
         * de lá, 300ms para abrir e 200ms para fechar. Abrir merece o gesto
         * inteiro; fechar quer sair da frente.
         *
         * ⚠️ O tempo vai na classe do ESTADO ALVO, e é isso que faz a assimetria
         * funcionar: quando `collapsed` vira verdadeiro a transição para 84px já
         * lê `duration-200`, e a volta para 256px lê `duration-300`.
         *
         * ⚠️ Igualar mais que isso não dá, e o motivo é estrutural: o drawer
         * desliza uma peça pronta, enquanto aqui o CONTEÚDO troca no caminho (a
         * marca vira o símbolo, o botão muda de lugar, os rótulos somem). Animar
         * largura também custa refluxo a cada quadro, coisa que `transform` não
         * paga. Trocar isso mudaria o layout inteiro, porque o trilho empurra o
         * conteúdo em vez de flutuar sobre ele.
         */
        'relative hidden h-svh shrink-0 flex-col transition-[width] ease-out will-change-[width] lg:flex',
        collapsed
          ? 'w-[84px] bg-background duration-200'
          : 'w-64 border-r border-border/60 bg-sidebar duration-300',
      )}
    >
      {/* Véu de marca no pé da coluna, como na referência: dá profundidade ao
          trilho sem desenhar nenhuma linha. Decorativo, nunca carrega texto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-primary-strong/[0.10] to-transparent"
      />

      <div
        className={cn(
          'relative flex h-16 shrink-0 items-center',
          collapsed ? 'justify-center' : 'justify-between border-b border-sidebar-border px-4',
        )}
      >
        <Link to="/app/dashboard" aria-label="RookHub — início">
          {collapsed ? <RookMark className="h-8 w-8" /> : <BrandLogo />}
        </Link>
        {!collapsed && toggleButton}
      </div>

      {collapsed && (
        <div className="relative flex justify-center pt-1">
          <Tooltip>
            <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
            <TooltipContent side="right">{toggleLabel}</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarNav navigation={navigation} collapsed={collapsed} />
      </div>

      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
