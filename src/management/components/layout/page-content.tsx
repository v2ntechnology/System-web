import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

/**
 * Área de conteúdo que sobe por cima do banner com cantos arredondados (Figma).
 *
 * O `-mt` negativo é o que cria a sobreposição; o `z-10` mantém os cards clicáveis.
 */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        'bg-background rounded-t-4xl relative z-10 -mt-12 pb-24 sm:-mt-16 sm:rounded-t-[40px]',
        className,
      )}
    >
      <div className="mx-auto max-w-[1600px] px-4 pt-8 sm:px-6 sm:pt-10">{children}</div>
    </main>
  );
}
