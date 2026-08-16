import { Info, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Trend } from '@/types';

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: Trend;
  loading?: boolean;
}

/** Indicador principal: valor grande, tendência e explicação opcional. */
export function MetricCard({ label, value, hint, trend, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                  aria-label={`Sobre ${label}`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p>
        {trend && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                trend.isPositive ? 'text-success' : 'text-destructive',
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.changePercent}%
            </span>
            <span className="text-muted-foreground">vs. período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InfoCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: 'default' | 'success' | 'warning' | 'info' | 'destructive';
  className?: string;
}

const ACCENT: Record<NonNullable<InfoCardProps['accent']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  destructive: 'text-destructive',
};

/** Indicador secundário, mais compacto que o MetricCard. */
export function InfoCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
  className,
}: InfoCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 pt-6">
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md bg-muted/60',
              ACCENT[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <p className={cn('font-display text-2xl font-bold leading-none', ACCENT[accent])}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
