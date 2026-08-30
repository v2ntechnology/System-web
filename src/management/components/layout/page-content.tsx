import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

/**
 * Área de conteúdo das telas do painel.
 *
 * ⚠️ Deixou de ser um cartão que sobe por cima do banner (redesign de
 * 30/08/2026). O `-mt-12`, o `rounded-t-4xl` e o `bg-background` existiam para
 * emendar o conteúdo na foto do cabeçalho: o bloco branco subia sobre a faixa
 * escura e a curva escondia o corte da imagem. Sem foto, a margem negativa
 * puxaria o conteúdo por cima do próprio título, e a curva desenharia uma borda
 * do papel contra o papel.
 *
 * O que sobrou é o container de largura e respiro. `z-10` continua: o menu
 * suspenso da topbar precisa passar por cima daqui, e sem a camada declarada o
 * empilhamento dependia da ordem no documento.
 */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('relative z-10 pb-24', className)}>
      <div className="px-4 sm:px-6 xl:px-10">{children}</div>
    </main>
  );
}
