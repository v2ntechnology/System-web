import { MenuIcon } from '@/components/icons';

import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/sidebar-store';

import { Breadcrumbs } from './breadcrumbs';
import { NotificationMenu } from './notification-menu';
import { UserMenu } from './user-menu';

export function Topbar() {
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  return (
    /*
     * ⚠️ BARRA DE VIDRO FLUTUANTE, pedida pelo usuário em 09/09/2026.
     *
     * Ela não é mais uma faixa colada no topo da coluna: é uma placa que
     * **paira** sobre a área de rolagem, e o conteúdo corre por baixo dela. Isso
     * é o que faz o `backdrop-filter` ter o que desfocar: encostada acima do
     * `<main>`, como era antes, nada passava atrás do vidro e o desfoque só
     * gastava GPU para embaçar o papel liso. Quem tira a barra do fluxo é o
     * `absolute` daqui, e quem devolve o espaço é o `pt` do `AppShell`: mexeu
     * na altura de uma, mexa na outra.
     *
     * ⚠️ Isto NÃO revive o `.glass` no tema claro (`--glass-blur: 0px` desde
     * 30/08/2026, ver a memória). Aquela decisão é sobre CARD: vidro em bloco
     * parado sobre papel liso é custo de GPU sem efeito. Aqui o material é
     * local, escrito à mão, e existe justamente onde ele tem função: a única
     * superfície do produto que tem conteúdo correndo por trás.
     */
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6">
      <div
        className={[
          'pointer-events-auto relative flex h-14 items-center gap-3 rounded-[20px] px-3 sm:px-4',
          /* Superfície do card diluída, e não `bg-white/70`: branco fixo é o que
             some quando a rampa escura voltar. */
          'bg-[color-mix(in_oklab,var(--color-surface-low)_70%,transparent)]',
          'backdrop-blur-xl backdrop-saturate-150',
          /* Traço interno em vez de borda: a placa fica com 1px de luz na volta
             sem crescer um pixel e sem empurrar o conteúdo. */
          'ring-1 ring-on-surface/[0.07]',
          'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_16px_40px_-20px_rgba(28,26,24,0.35)]',
          /* O brilho do vidro: um fio de luz na aresta de cima, que se apaga nas
             pontas. É o que separa uma placa translúcida de um retângulo cinza. */
          'before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-on-surface/20 before:to-transparent',
        ].join(' ')}
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>

        <Breadcrumbs />

        <div className="ml-auto flex items-center gap-2">
          {/* O chip de vidro é um véu da própria tinta, e não uma placa
              branca: sobre o vidro, uma segunda superfície sólida quebra a
              ilusão de material único. */}
          <div className="flex items-center rounded-full bg-on-surface/[0.05] p-0.5 ring-1 ring-on-surface/[0.05]">
            <NotificationMenu />
            <span className="mx-0.5 h-6 w-px bg-on-surface/10" aria-hidden />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
