import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        /* ⚠️ Sem sombra, como as listas de select desde 18/09/2026: a borda é
           que separa o balão do fundo. E `text-label-md` no lugar do `text-xs`
           herdado, para a fonte sair da escala do sistema. */
        /*
         * ⚠️ `z-[1200]`, e não o `z-50` herdado do shadcn.
         *
         * É a camada de conteúdo flutuante do painel de gestão, a mesma da
         * lista do `GlassSelect` (ver `POPOVER_LAYER` em `field-surfaces.ts`):
         * o diálogo de lá é `z-[1101]`, e com 50 a ajuda dos campos abria ATRÁS
         * do modal. Quem passava o mouse no ícone de interrogação não via nada
         * (relatado em 18/09/2026).
         *
         * O número precisa estar AQUI, no conteúdo, e não no invólucro: o
         * Popper do Radix lê o z-index computado do conteúdo na montagem e o
         * copia para o invólucro posicionado, que é quem de fato empilha. O
         * conteúdo em si é `position: static`, onde z-index não tem efeito
         * nenhum.
         */
        'border-border bg-popover text-popover-foreground text-label-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-[1200] max-w-xs rounded-md border px-3 py-2 normal-case leading-snug',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
