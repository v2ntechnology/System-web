import { CheckIcon, SpinnerIcon, WarningIcon } from '@/components/icons';
import type { IconType } from '@/components/icons';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { tenantDomain } from '@/app/tenant-slug';
import { APPROVED_FONTS, TELEMETRY_HINT } from '@/mocks/saas';
import { cn } from '@/lib/utils';
import type { ProvisioningState, TelemetryState, TenantBranding } from '@/types';

/* -------------------------------------------------------------------------- */
/* Linha rótulo/valor                                                          */
/* -------------------------------------------------------------------------- */

/** Par rótulo/valor das fichas de detalhe. Quebra em duas linhas no mobile. */
export function DefinitionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Aviso contextual                                                            */
/* -------------------------------------------------------------------------- */

type CalloutTone = 'info' | 'warning' | 'destructive' | 'success';

const CALLOUT_TONE: Record<CalloutTone, string> = {
  info: 'border-info/30 bg-info/5 text-info-on-light',
  warning: 'border-warning/30 bg-warning/5 text-warning-on-light',
  destructive: 'border-destructive/30 bg-destructive/5 text-error-on-light',
  success: 'border-success/30 bg-success/5 text-success-on-light',
};

/** Bloco de aviso dentro de uma tela: explica um estado, não interrompe. */
export function Callout({
  tone = 'info',
  icon: Icon = WarningIcon,
  title,
  children,
  action,
  className,
}: {
  tone?: CalloutTone;
  icon?: IconType;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start',
        CALLOUT_TONE[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Endereço do cliente                                                         */
/* -------------------------------------------------------------------------- */

/**
 * O endereço final, mostrado enquanto o slug é digitado.
 *
 * É o campo que mais custa errar: o slug é subdomínio e nome do schema ao mesmo
 * tempo, e vai no e-mail de convite do Dono. Ver o endereço montado evita a
 * descoberta tardia de que "amazonas-transportes-ltda" é o que o cliente vai
 * digitar todo dia.
 */
export function DomainPreview({ slug, className }: { slug: string; className?: string }) {
  return (
    <p className={cn('font-mono text-sm', className)}>
      <span className="text-muted-foreground">https://</span>
      <span className="font-semibold text-foreground">{slug || '…'}</span>
      <span className="text-muted-foreground">.rookhub.com.br</span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Provisionamento                                                             */
/* -------------------------------------------------------------------------- */

const PROVISIONING_STEPS = [
  'Validar o endereço',
  'Criar o schema no Postgres',
  'Aplicar as migrations',
  'Semear os seis cargos',
  'Criar o Dono e enviar o convite',
];

/**
 * Linha do tempo do provisionamento.
 *
 * Existe porque a operação é assíncrona e demorada: sem ela, a tela de aprovação
 * ficaria parada num spinner sem dizer o que está acontecendo nem onde parou
 * quando falha.
 */
export function ProvisioningTimeline({
  state,
  error,
  className,
}: {
  state: ProvisioningState;
  error?: string | undefined;
  className?: string;
}) {
  /* Sem backend, o progresso é ilustrativo: pronto conclui tudo, falha para no
     passo do domínio, provisionando mostra o meio do caminho. */
  const reached = state === 'READY' ? PROVISIONING_STEPS.length : state === 'FAILED' ? 2 : 3;

  return (
    <ol className={cn('space-y-2', className)}>
      {PROVISIONING_STEPS.map((step, index) => {
        const done = index < reached;
        const failed = state === 'FAILED' && index === reached;
        const running = state === 'RUNNING' && index === reached;
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                done && 'border-success/40 bg-success/15 text-success-on-light',
                failed && 'border-destructive/40 bg-destructive/15 text-error-on-light',
                running && 'border-info/40 bg-info/15 text-info-on-light',
                !done && !failed && !running && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : failed ? (
                <WarningIcon className="h-3.5 w-3.5" />
              ) : running ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            <span className={cn(!done && !failed && !running && 'text-muted-foreground')}>
              {step}
            </span>
          </li>
        );
      })}
      {state === 'FAILED' && error && (
        <li className="pl-9 pt-1 text-xs text-error-on-light">{error}</li>
      )}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Telemetria                                                                  */
/* -------------------------------------------------------------------------- */

/** Explica em uma frase por que a frota pode aparecer vazia. */
export function TelemetryHint({ state }: { state: TelemetryState }) {
  return <p className="text-xs text-muted-foreground">{TELEMETRY_HINT[state]}</p>;
}

/* -------------------------------------------------------------------------- */
/* Marca                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Prévia da tela de login do cliente.
 *
 * A marca é lida ANTES do login, e é a primeira coisa que a transportadora vê. O
 * quadro abaixo mostra exatamente isso, para a cor ser aprovada no contexto em
 * que aparece, e não como um quadradinho solto num seletor.
 */
export function BrandPreview({
  branding,
  companyName,
  slug,
  className,
}: {
  branding: TenantBranding;
  companyName: string;
  slug: string;
  className?: string;
}) {
  const font = APPROVED_FONTS.find((f) => f.value === branding.fontFamily)?.label ?? 'Padrão';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1.5 w-full" style={{ backgroundColor: branding.colorPrimary }} />
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: branding.colorPrimary }}
            aria-hidden
          >
            {companyName.slice(0, 2).toUpperCase() || '··'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{companyName || 'Transportadora'}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{tenantDomain(slug)}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="h-2 w-16 rounded bg-muted-foreground/20" />
          <div className="h-8 rounded border border-border bg-background" />
          <div className="h-2 w-12 rounded bg-muted-foreground/20" />
          <div className="h-8 rounded border border-border bg-background" />
          <div
            className="flex h-9 items-center justify-center rounded text-xs font-medium text-white"
            style={{ backgroundColor: branding.colorPrimary }}
          >
            Entrar
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: branding.colorPrimary }}
              aria-hidden
            />
            {branding.colorPrimary}
          </Badge>
          <Badge variant="muted">{font}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
