import { CloseIcon } from '@/components/icons';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sempre obrigatório — leitor de tela anuncia o diálogo por ele. */
  title: string;
  /** Quando falso, o título fica só para tecnologia assistiva. */
  showTitle?: boolean | undefined;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * Diálogo em vidro elevado (FE-06).
 *
 * Radix cuida de foco preso, restauração de foco ao fechar, Esc e `aria-modal` —
 * comportamento que não se reimplementa à mão sem errar.
 */
export function GlassModal({
  open,
  onOpenChange,
  title,
  showTitle = true,
  description,
  children,
  className,
}: GlassModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            /*
             * ⚠️ `management-theme` no próprio conteúdo, e não só num ancestral.
             *
             * O portal do Radix monta no `body`, FORA do escopo que a
             * `ManagementLayout` abre. Sem esta classe, todo token redefinido
             * pelo painel volta ao valor do painel operacional lá dentro: o
             * `SpectrumButton` na variante `secondary` perdia o cyan e ficava
             * com texto `#00212b` sobre cinza escuro, 1,43:1 (medido em
             * 27/08/2026, relatado pelo usuário como "o texto some").
             *
             * Vale para tudo que o diálogo contém, e não para uma classe de
             * botão: era o escopo que estava faltando, não a cor.
             */
            'management-theme',
            /* Acima da topbar (z-1000): um diálogo modal cobre a navegação, não o contrário. */
            'fixed left-1/2 top-1/2 z-[1101] -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden',
            /*
             * Superfície própria, e não `.glass`: a camada de vidro a 9% deixava o
             * conteúdo da página atravessar o texto do diálogo. Um modal precisa de
             * base opaca — o blur fica para a borda e para o overlay.
             */
            'bg-surface-low/95 border-on-surface/12 rounded-lg border backdrop-blur-2xl',
            'shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
            {showTitle ? (
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-sora text-on-surface text-headline-md">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-on-surface-variant text-body-md mt-1">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
            ) : (
              <VisuallyHidden>
                <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
                ) : null}
              </VisuallyHidden>
            )}

            <DialogPrimitive.Close
              aria-label="Fechar"
              className="text-on-surface-muted hover:text-on-surface rounded-pill focus-visible:ring-secondary ml-auto flex size-9 shrink-0 items-center justify-center transition-colors hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2"
            >
              <CloseIcon size={20} />
            </DialogPrimitive.Close>
          </div>

          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
