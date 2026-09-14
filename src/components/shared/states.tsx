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
import { PLAN_LABELS, moduleLabel, planoQueInclui } from '@/app/plans';
import { ApiError, PlanUpgradeError } from '@/services/http';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Carregando                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A espera de uma tela do painel operacional.
 *
 * ⚠️ O desenho é o do `QueryState` do painel de gestão (pedido do usuário em
 * 09/09/2026, para os quatro perfis esperarem igual): o giro sozinho, maior e
 * centrado num bloco de altura própria. Antes eram 16px com o rótulo escrito ao
 * lado, e a diferença aparecia na troca de painel.
 *
 * ⚠️ O rótulo continua existindo, mas só para quem ouve. Ele some da tela e vive
 * no `aria-label`, que é como o giro do gestão anuncia a espera: ler
 * "Carregando ordens…" três vezes por navegação é ruído para quem enxerga, e
 * ausência total é silêncio para quem não enxerga.
 */
export function LoadingState({
  label = 'Carregando…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex min-h-60 items-center justify-center text-muted-foreground', className)}
      aria-live="polite"
    >
      <SpinnerIcon className="h-6 w-6 animate-spin" role="status" aria-label={label} />
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

export function NoAccessState({ className }: { className?: string | undefined }) {
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

/**
 * A oferta de upgrade: o plano da empresa não vai até este módulo.
 *
 * ⚠️ **É a tela do 402, e não a do 403.** O 403 é falta de permissão, e quem
 * resolve é quem administra a equipe, que é o `NoAccessState`. Aqui a permissão
 * existe e o plano é que não cobre, então o caminho é comercial. O backend separa os
 * dois códigos exatamente para esta tela poder existir.
 *
 * `modulo` e `plano` chegam do corpo do 402 (ver `PlanUpgradeError`). Com eles o
 * texto diz o que falta e em que plano vem; sem eles, sobra o genérico, que
 * ainda é melhor que um erro sem explicação.
 */
export function PlanLockedState({
  className,
  modulo,
  plano,
}: {
  className?: string | undefined;
  modulo?: string | null | undefined;
  plano?: string | null | undefined;
}) {
  const nome = moduleLabel(modulo ?? null);
  const necessario = planoQueInclui(modulo ?? null);

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
        <p className="font-display font-semibold">
          {nome ? `${nome} vem em outro plano` : 'Recurso disponível em outro plano'}
        </p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {nome
            ? `${nome} não está incluído no plano ${plano ?? 'atual'} da sua empresa.`
            : 'Este módulo não está incluído no plano atual da sua empresa.'}{' '}
          {necessario
            ? `A partir do plano ${PLAN_LABELS[necessario]} ele fica disponível.`
            : 'Fale com a RookHub para saber em qual plano ele entra.'}
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

/* -------------------------------------------------------------------------- */
/* Falha de uma consulta, pelo que ela significa                               */
/* -------------------------------------------------------------------------- */

/**
 * A tela de uma consulta que falhou, escolhida pelo código da resposta.
 *
 * Existe para que nenhuma tela precise lembrar que 402 e 403 são coisas
 * diferentes: 402 abre a oferta de upgrade com o módulo que faltou, 403 diz que
 * falta permissão, e o resto cai no erro com botão de tentar de novo.
 *
 * ⚠️ **Sem `onRetry` no 402 e no 403**, de propósito: repetir a mesma
 * requisição devolve o mesmo código, e o botão só ensinaria a insistir. O que
 * muda essas duas respostas é contratar um plano ou ganhar uma permissão.
 */
export function ApiErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}) {
  if (error instanceof PlanUpgradeError) {
    return <PlanLockedState className={className} modulo={error.modulo} plano={error.plano} />;
  }
  if (error instanceof ApiError && error.status === 403) {
    return <NoAccessState className={className} />;
  }
  return (
    <ErrorState
      className={className}
      onRetry={onRetry}
      description={
        error instanceof ApiError
          ? error.message
          : 'Ocorreu um erro ao buscar as informações. Verifique sua conexão e tente novamente.'
      }
    />
  );
}
