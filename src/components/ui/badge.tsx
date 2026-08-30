import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      /*
       * ⚠️ A TINTA do texto não é o mesmo token do fundo, e essa diferença é o
       * conserto de 30/08/2026.
       *
       * O chip é a matiz a 15% com a MESMA matiz por cima. Cada token semântico
       * foi escolhido para ter 4,5:1 contra o papel BRANCO, mas o papel do chip
       * não é branco: é ele mesmo diluído, que já subiu meio caminho na direção
       * da tinta. Medido nas telas: "Bloqueia" ficou em 2,99:1, "Alta" em 3,34,
       * "Média" em 3,68 e o indigo do avatar em 3,34. Todos reprovam AA.
       *
       * A família `-on-light` existe justamente para esse caso e já era usada no
       * painel de gestão. Ela desce a matiz até a faixa de texto sem mexer no
       * token do fundo cheio, que continua servindo a botão e barra de gráfico.
       */
      variant: {
        default: 'border-transparent bg-primary/15 text-primary-on-light',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success/15 text-success-on-light',
        warning: 'border-transparent bg-warning/15 text-warning-on-light',
        info: 'border-transparent bg-info/15 text-info-on-light',
        destructive: 'border-transparent bg-destructive/15 text-error-on-light',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
