import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface AlertProps {
  severity?: 'error' | 'warning' | 'info' | 'success' | undefined;
  children: ReactNode;
  className?: string | undefined;
}

const severityStyles: Record<NonNullable<AlertProps['severity']>, string> = {
  error: 'border-error/40 bg-error/10 text-error',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
  success: 'border-success/40 bg-success/10 text-success',
};

/** Faixa de feedback inline. Sempre com role="alert" para leitores de tela. */
export function Alert({ severity = 'info', children, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'text-body-md rounded-md border px-3 py-2.5',
        severityStyles[severity],
        className,
      )}
    >
      {children}
    </div>
  );
}
