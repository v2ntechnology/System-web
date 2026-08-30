import { CheckIcon, MinusIcon } from '@/components/icons';
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { cn } from '@/lib/utils';

/**
 * Caixa de marcação do painel do operador e da manutenção.
 *
 * ⚠️ **Mesma mecânica e mesmas medidas do `management/ui/checkbox.tsx`**, que é
 * o do dono e do gestor (alinhado em 30/08/2026). O que separa os dois arquivos
 * é a pele: aqui os tokens são os do painel operacional, lá são os do de gestão.
 * Desenho, tamanho, raio e cor de marcação são os mesmos nos quatro perfis.
 *
 * O que mudou nesta passagem, e por quê:
 *
 * - **`primary-strong` no lugar de `primary`.** Medido: o âncora `#6366F1` dá
 *   4,32:1 contra o branco do visto e reprova AA, que pede 4,5:1. `#5457EE` dá
 *   5,12:1. O visto é um traço fino, e é justamente o desenho que sofre quando
 *   o contraste fica no limite. Mesmo par do `SpectrumButton`.
 * - **20px no lugar de 16px**, e raio de 6px. Uma caixa de 16px é um alvo
 *   pequeno demais para quem marca uma lista inteira de preferências.
 * - **`MinusIcon` para o estado indeterminado**, que antes nem existia aqui: o
 *   Radix já expõe o estado, e sem desenho ele ficava idêntico ao desmarcado.
 * - **O traço do visto vai a 3**, senão em 12px ele some dentro do indigo.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-input transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-primary-strong data-[state=checked]:bg-primary-strong',
      'data-[state=indeterminate]:border-primary-strong data-[state=indeterminate]:bg-primary-strong',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-on-primary">
      {props.checked === 'indeterminate' ? (
        <MinusIcon size={12} strokeWidth={3} aria-hidden="true" />
      ) : (
        <CheckIcon size={12} strokeWidth={3} aria-hidden="true" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
