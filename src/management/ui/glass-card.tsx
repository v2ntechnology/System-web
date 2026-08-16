import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './lib/cn';

export interface GlassCardProps extends ComponentPropsWithoutRef<'div'> {
  /** Superfície de foco (modais, diálogos) — rgba .08 + blur 24px. */
  elevated?: boolean | undefined;
}

/**
 * Container padrão do RookHub (FE-06).
 * Raio de 16px conforme FE-02.
 */
export function GlassCard({ className, elevated = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass',
        // Item de CSS Grid tem `min-width: auto` e não encolhe abaixo do conteúdo —
        // sem isto o card estoura o viewport no mobile.
        'min-w-0',
        elevated && 'glass-elevated',
        className,
      )}
      {...props}
    />
  );
}
