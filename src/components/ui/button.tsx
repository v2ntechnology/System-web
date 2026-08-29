import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* Mesmo roxo e mesmo hover do `primary` do `SpectrumButton` (decisão do
           usuário em 20/08/2026): ação preenchida é `primary-strong` nos quatro
           perfis, e o hover escurece a própria cor, sem véu translúcido (com
           `/90` o indigo clareava no tema claro). */
        default:
          'bg-primary-strong text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-transparent hover:bg-secondary hover:text-secondary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        /* O gradiente saiu daqui em 20/08/2026, a pedido do usuário: ação
           principal é o mesmo roxo em todo o sistema, e o degradê indigo/cyan
           fazia o botão do operador parecer de outra família ao lado do botão
           da gestão. A variante continua por ser usada em dezenas de telas. */
        brand:
          'bg-primary-strong text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
