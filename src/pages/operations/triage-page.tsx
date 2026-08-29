import { ChecklistIcon, ClockIcon, ImageIcon, SpinnerIcon, WarningIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SeverityBadge, StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useDecideTriage, useTriage } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StatusDescriptor } from '@/lib/status-maps';
import type { Severity } from '@/types';
import type { TriageFill, TriagePayload } from '@/services/operator';

type TabId = 'PENDENTES' | 'TRATADOS';

const SEVERITY: Record<TriageFill['failures'][number]['severity'], Severity> = {
  GRAVE: 'high',
  MEDIA: 'medium',
  LEVE: 'low',
};

const STATUS: Record<TriageFill['status'], StatusDescriptor> = {
  PENDENTE: { label: 'Na fila', variant: 'warning' },
  APROVADO: { label: 'Aprovado', variant: 'success' },
  ENVIADO_MANUTENCAO: { label: 'Em manutenção', variant: 'info' },
  ESCALADO: { label: 'Escalado ao gestor', variant: 'destructive' },
};

const ACTIONS: { id: TriagePayload['action']; label: string; hint: string }[] = [
  { id: 'APROVAR', label: 'Resolver no pátio', hint: 'A divergência foi sanada aqui mesmo.' },
  { id: 'MANUTENCAO', label: 'Mandar para a oficina', hint: 'Abre ordem, sem impedir a saída.' },
  { id: 'ESCALAR', label: 'Escalar ao gestor', hint: 'Quem autoriza a saída é o gestor.' },
];

/**
 * Tratativa de um preenchimento.
 *
 * A regra que importa: reprovação que impede a saída (RF-016) **não** se resolve
 * no pátio. O operador descreve o que verificou e escala — a autorização é do
 * gestor, e cai na fila de Liberações dele.
 */
function TriageDetail({ fill }: { fill: TriageFill }) {
  const [action, setAction] = useState<TriagePayload['action']>(
    fill.blocking ? 'ESCALAR' : 'APROVAR',
  );
  const [note, setNote] = useState('');
  const decide = useDecideTriage();

  const settled = fill.status !== 'PENDENTE';

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base tabular-nums">{fill.plate}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {fill.templateName} · {fill.driverName}
          </p>
        </div>
        <StatusBadge descriptor={STATUS[fill.status]} />
      </CardHeader>

      <CardContent className="space-y-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Preenchido</dt>
            <dd className="text-sm tabular-nums">{formatDateTime(fill.filledAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Recebido</dt>
            <dd className="text-sm tabular-nums">{formatDateTime(fill.receivedAt)}</dd>
          </div>
        </dl>

        {/* Relógio do aparelho fora de hora vira flag de auditoria (RN-054). */}
        {fill.clockSkewHours >= 6 && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {fill.clockSkewHours}h de diferença entre o relógio do aparelho e o do servidor. Confira
            a data antes de decidir.
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {fill.failures.length === 1 ? '1 reprovação' : `${fill.failures.length} reprovações`}
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {fill.failures.map((failure) => (
              <li key={failure.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{failure.label}</span>
                  <SeverityBadge severity={SEVERITY[failure.severity]} />
                  {failure.hasPhoto && (
                    <Badge variant="muted">
                      <ImageIcon className="h-3 w-3" aria-hidden />
                      Foto
                    </Badge>
                  )}
                </div>
                {failure.note && <p className="text-xs text-muted-foreground">{failure.note}</p>}
              </li>
            ))}
          </ul>
        </div>

        {settled ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Tratativa registrada</p>
            {fill.decision && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{fill.decision.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fill.decision.by} · {formatDateTime(fill.decision.at)}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {fill.blocking && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Reprovação bloqueante: o veículo só sai com autorização do gestor.
              </p>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Encaminhamento</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {ACTIONS.map((option) => {
                  const blocked = fill.blocking && option.id === 'APROVAR';
                  const active = action === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={blocked}
                      onClick={() => setAction(option.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-colors',
                        active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                        blocked && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {blocked ? 'Indisponível: a saída está bloqueada.' : option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="triage-note">O que foi verificado no pátio</Label>
              <Textarea
                id="triage-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Descreva a verificação e o que foi feito."
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de 10 caracteres — é o registro que sustenta a decisão.
              </p>
            </div>

            <Button
              variant="brand"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({ fillId: fill.id, action, note }, { onSuccess: () => setNote('') })
              }
            >
              {decide.isPending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              Concluir triagem
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Triagem — fila de checklists recebidos dos motoristas pelo app.
 *
 * Bloqueantes primeiro: um checklist leve na frente de um veículo travado é a
 * ordem errada de trabalho.
 */
export default function TriagePage() {
  const [tab, setTab] = useState<TabId>('PENDENTES');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useTriage();

  const all = useMemo(() => data ?? [], [data]);

  const visible = useMemo(
    () =>
      all
        .filter((item) =>
          tab === 'PENDENTES' ? item.status === 'PENDENTE' : item.status !== 'PENDENTE',
        )
        .sort((a, b) => {
          if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
          return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        }),
    [all, tab],
  );

  /* Sem seleção explícita, abre o primeiro da fila — que é o mais urgente. */
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];

  const pending = all.filter((item) => item.status === 'PENDENTE');
  const blocking = pending.filter((item) => item.blocking).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Triagem"
        description="Checklists recebidos dos motoristas — verificação de pátio e encaminhamento das divergências."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <ChecklistIcon className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {pending.length === 0
                ? 'Fila vazia.'
                : pending.length === 1
                  ? '1 checklist aguardando triagem.'
                  : `${pending.length} checklists aguardando triagem.`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {blocking > 0
                ? `${blocking === 1 ? '1 impede' : `${blocking} impedem`} a saída do veículo e ${
                    blocking === 1 ? 'precisa' : 'precisam'
                  } ser escalado${blocking === 1 ? '' : 's'} ao gestor.`
                : 'Nada bloqueando saída no momento.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
        <TabsList>
          <TabsTrigger value="PENDENTES">Na fila ({pending.length})</TabsTrigger>
          <TabsTrigger value="TRATADOS">Tratados ({all.length - pending.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === 'PENDENTES' ? 'Nada aguardando triagem' : 'Nenhum checklist tratado ainda'}
          description={
            tab === 'PENDENTES'
              ? 'Assim que um motorista enviar um checklist com divergência, ele aparece aqui.'
              : 'As tratativas concluídas ficam registradas nesta aba.'
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_1fr]">
          <ul className="flex flex-col gap-2">
            {visible.map((item) => {
              const active = item.id === selected?.id;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-colors',
                      active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 font-semibold tabular-nums">
                        {item.plate}
                      </span>
                      {item.blocking && <Badge variant="destructive">Bloqueia</Badge>}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.driverName} ·{' '}
                      {item.failures.length === 1
                        ? '1 reprovação'
                        : `${item.failures.length} reprovações`}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.templateName} · {formatDateTime(item.receivedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            {selected && <TriageDetail key={selected.id} fill={selected} />}
          </div>
        </div>
      )}
    </div>
  );
}
