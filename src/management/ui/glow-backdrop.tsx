import { cn } from './lib/cn';

export interface GlowBackdropProps {
  className?: string | undefined;
}

/**
 * Glows orgânicos radiais nos cantos do viewport, atrás das camadas de vidro (FE-12).
 * Desativado automaticamente em dispositivos de baixa performance via `:root.no-blur`.
 */
export function GlowBackdrop({ className }: GlowBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'glow-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      <div
        className="absolute -left-[10%] -top-[20%] h-[60vmax] w-[60vmax] rounded-full"
        style={{ backgroundImage: 'var(--glow-indigo)', filter: 'blur(100px)' }}
      />
      <div
        className="absolute -bottom-[25%] -right-[15%] h-[55vmax] w-[55vmax] rounded-full"
        style={{ backgroundImage: 'var(--glow-cyan)', filter: 'blur(100px)' }}
      />
    </div>
  );
}
