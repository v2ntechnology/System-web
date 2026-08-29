import {
  InboxIcon,
  LockIcon,
  ShieldAlertIcon,
  SparklesIcon,
  SpinnerIcon,
  WarningIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';
import { type ReactNode } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Carregando                                                                  */
/* -------------------------------------------------------------------------- */

export function LoadingState({
  label = 'Carregando…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <SpinnerIcon className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-label="Carregando tabela">
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vazio                                                                       */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Erro                                                                        */
/* -------------------------------------------------------------------------- */

interface ErrorStateProps {
  title?: string | undefined;
  description?: string | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

export function ErrorState({
  title = 'Não foi possível carregar os dados',
  description = 'Ocorreu um erro ao buscar as informações. Verifique sua conexão e tente novamente.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <WarningIcon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-semibold">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sem permissão / bloqueado por plano                                         */
/* -------------------------------------------------------------------------- */

export function NoAccessState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <ShieldAlertIcon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-semibold">Acesso restrito</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Seu perfil não possui permissão para visualizar esta área. Fale com o administrador da sua
          empresa caso precise de acesso.
        </p>
      </div>
    </div>
  );
}

export function PlanLockedState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <LockIcon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-semibold">Recurso disponível em outro plano</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Este módulo não está incluído no plano atual da sua empresa. Faça upgrade para desbloquear
          recursos avançados de inteligência e integrações.
        </p>
      </div>
      <Button asChild size="sm" variant="brand">
        <Link to="/app/planos">
          <SparklesIcon className="h-4 w-4" />
          Ver planos
        </Link>
      </Button>
    </div>
  );
}
