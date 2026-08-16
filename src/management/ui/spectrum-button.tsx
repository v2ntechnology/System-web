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
         * Ação primária das telas de autenticação — pill claro (Figma).
         *
         * Sem sombra: o halo branco que a variante trazia da origem lia como
         * brilho em volta do botão, e não como elevação. A resposta ao ponteiro
         * fica no `hover:bg-white` e no afundar do `active`.
         */
        bright: ['bg-bright text-on-bright', 'hover:bg-white', 'active:translate-y-px'],
        /** Ação primária do painel. O Spectrum Gradient aparece no hover. */
        primary: [
          /* `primary-strong`, não `primary`: o âncora reprova AA com texto branco. */
          'bg-primary-strong text-on-primary shadow-[0_8px_24px_-12px_rgba(99,102,241,0.9)]',
          'hover:shadow-[0_10px_32px_-10px_rgba(99,102,241,0.9)]',
          'hover:[background-image:var(--spectrum-gradient)]',
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
          'bg-secondary text-on-secondary shadow-[0_8px_24px_-12px_rgba(6,182,212,0.9)]',
          'hover:bg-[color-mix(in_oklab,var(--color-secondary)_88%,white)]',
          'hover:shadow-[0_10px_32px_-10px_rgba(6,182,212,0.9)]',
          'active:translate-y-px',
        ],
        /** Ação secundária sobre vidro. */
        ghost: [
          'border border-outline-variant bg-white/[0.04] text-on-surface',
          'hover:border-outline hover:bg-white/[0.08]',
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
