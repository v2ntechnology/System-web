import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './lib/cn';

export interface LightCardProps extends ComponentPropsWithoutRef<'section'> {
  /** Título do painel. Renderizado em indigo, ≥24px bold (AA Large sobre o claro). */
  title: string;
  /** Ação ou métrica no canto oposto ao título. */
  action?: ReactNode | undefined;
  children: ReactNode;
}

/**
 * Painel claro do dashboard (Figma).
 *
 * Inverte a lógica do login — claro sobre grafite — e por isso NÃO usa `.glass`.
 * Todo texto interno precisa usar os tokens `on-light-*`; `on-surface-*` é
 * praticamente invisível aqui.
 */
export function LightCard({ title, action, children, className, ...props }: LightCardProps) {
  return (
    <section
      className={cn(
        'bg-light rounded-xl p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.8)] sm:p-6',
        // `min-w-0`: item de grid tem `min-width: auto` e se recusa a encolher abaixo
        // do conteúdo — sem isso o card estoura o viewport no mobile.
        // `flex flex-col`: permite que o conteúdo estique até o fim do card quando a
        // linha do grid é alta por causa de um vizinho.
        'flex min-w-0 flex-col',
        className,
      )}
      {...props}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        {/*
         * `primary` (o indigo vivo do Figma) sobre o painel claro dá 3.7:1 —
         * suficiente porque o título é 24px bold, que exige apenas AA Large (3:1).
         * Texto menor em indigo tem que usar `primary-on-light`.
         */}
        <h2 className="font-sora text-primary text-headline-md">{title}</h2>
        {action}
      </header>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
