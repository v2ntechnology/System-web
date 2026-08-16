import { Badge, type BadgeProps } from '@/components/ui/badge';
import { severityDescriptor, type StatusDescriptor } from '@/lib/status-maps';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types';

const DOT_COLOR: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary-foreground/60',
  outline: 'bg-foreground/60',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground',
};

interface StatusBadgeProps {
  descriptor: StatusDescriptor;
  withDot?: boolean | undefined;
  className?: string | undefined;
}

export function StatusBadge({ descriptor, withDot = true, className }: StatusBadgeProps) {
  const variant = descriptor.variant;
  return (
    <Badge variant={variant} className={className}>
      {withDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLOR[variant])} aria-hidden />
      )}
      {descriptor.label}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string | undefined;
}) {
  return <StatusBadge descriptor={severityDescriptor(severity)} className={className} />;
}
