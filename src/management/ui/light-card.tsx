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
 * Painel do dashboard (Figma).
 *
 * ⚠️ O nome é herança: era o painel **claro** sobre o grafite. Desde 19/08/2026
 * ele acompanha o tema (ver `--color-light` em `palette.css`), então é o card
 * escuro no tema escuro e o branco no claro. Não usa `.glass` de propósito: é
 * superfície sólida, e o vidro pertence aos blocos de indicador.
 *
 * Todo texto interno usa os tokens `on-light-*`, que invertem junto.
 */
export function LightCard({ title, action, children, className, ...props }: LightCardProps) {
  return (
    <section
      className={cn(
        /* `ring-light-edge` é transparente no tema escuro, onde o contraste com o
           grafite já basta, e vira um traço no claro, onde o card branco encostaria
           no fundo sem nenhuma divisa. */
        'bg-light ring-light-edge rounded-xl p-5 ring-1 sm:p-6',
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
