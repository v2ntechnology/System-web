import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './lib/cn';

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-sans text-body-md font-medium',
    'transition-[background,box-shadow,opacity,transform,border-color] duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        /**
         * Ação primária das telas de autenticação com pill de contraste máximo
         * (Figma): claro sobre o grafite, grafite sobre o papel.
         *
         * Sem sombra: o halo branco que a variante trazia da origem lia como
         * brilho em volta do botão, e não como elevação. A resposta padrão ao
         * ponteiro é feita por opacidade porque o par `bright`/`on-bright`
         * inverte com o tema.
         */
        bright: ['bg-bright text-on-bright', 'hover:opacity-90', 'active:translate-y-px'],
        /**
         * Ação primária do painel.
         *
         * O hover **escurece a própria cor** e nada mais (decisão do usuário em
         * 20/08/2026, vale nos quatro perfis): o Spectrum Gradient que aparecia
         * aqui trocava o indigo por uma faixa rosa e cyan, e o botão parecia
         * outro elemento a cada passada do ponteiro.
         */
        primary: [
          /* `primary-strong`, não `primary`: o âncora reprova AA com texto branco. */
          'bg-primary-strong text-on-primary',
          'hover:bg-[color-mix(in_oklab,var(--color-primary-strong)_86%,black)]',
          'active:translate-y-px',
        ],
        /**
         * Ação de peso igual ao `primary`, na âncora Cyan.
         *
         * Existe para telas com **duas escolhas equivalentes**, onde rebaixar uma
         * delas a `ghost` mentiria sobre a hierarquia. Não é "botão secundário":
         * é o outro caminho. O par `secondary`/`on-secondary` dá 6,8:1.
         */
        secondary: [
          'bg-secondary text-on-secondary',
          /* `--secondary`, e não `--color-secondary`: o segundo vem do `@theme
             inline` e não existe como variável CSS fora do utilitário. */
          'hover:bg-[color-mix(in_oklab,var(--secondary)_86%,black)]',
          'active:translate-y-px',
        ],
        /** Ação secundária sobre vidro. */
        ghost: [
          /* `on-surface` e não branco: o véu precisa clarear no escuro e escurecer
             no claro, senão o botão some sobre o papel. */
          'border border-outline-variant bg-on-surface/[0.04] text-on-surface',
          'hover:border-outline hover:bg-on-surface/[0.08]',
        ],
        /** Link textual. */
        link: 'text-secondary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-label-md',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
        xl: 'h-13 px-7',
        icon: 'h-11 w-11',
      },
      shape: {
        /** FE-02 — elemento interno. */
        rounded: 'rounded-md',
        /** Telas de autenticação (Figma). */
        pill: 'rounded-pill',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'rounded',
    },
  },
);

export interface SpectrumButtonProps
  extends ComponentPropsWithoutRef<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean | undefined;
}

export function SpectrumButton({
  className,
  variant,
  size,
  shape,
  block,
  asChild = false,
  type = 'button',
  ...props
}: SpectrumButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, shape, block }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}

export { buttonVariants };
