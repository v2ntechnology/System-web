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
        /* ⚠️ O traço saiu no redesign de 30/08/2026. `--color-light-edge` virou
           transparente também no claro: o card é branco sobre papel morno, e a
           diferença de superfície já separa os dois. Borda somada a essa
           diferença é o que fazia cada bloco parecer um campo de formulário.
           Quem dá a profundidade agora é a sombra, com deslocamento e desfoque. */
        'bg-light ring-light-edge rounded-xl p-6 ring-1 sm:p-7',
        'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
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
         * ⚠️ O título deixou de ser indigo (redesign de 30/08/2026).
         *
         * O indigo virou a cor do que é acionável e do que é dado: botão, link,
         * primeira série de gráfico. Título de card não é nenhum dos três, e
         * pintá-lo de indigo fazia cada cabeçalho da tela pedir a mesma atenção
         * que a única ação da tela. Em tinta ele fica mais legível (16.8:1
         * contra 3.7:1) e devolve o indigo para quem precisa dele.
         */}
        <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">{title}</h2>
        {action}
      </header>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
