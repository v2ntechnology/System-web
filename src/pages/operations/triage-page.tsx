import {
  CameraIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  LockIcon,
  SpinnerIcon,
  TruckIcon,
  WarningIcon,
} from '@/components/icons';
import { useMemo, useState } from 'react';

import {
  HeroPill,
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDecideTriage, useTriage } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TriageFill, TriagePayload } from '@/services/operator';

type TabId = 'PENDENTES' | 'TRATADOS';

const TABS: { id: TabId; label: string }[] = [
  { id: 'PENDENTES', label: 'Na fila' },
  { id: 'TRATADOS', label: 'Tratados' },
];
type Severity = TriageFill['failures'][number]['severity'];

/*
 * A escada de risco, no desenho da fila de liberações do gestor.
 *
 * ⚠️ É um gêmeo local do `management/features/manager/severity.ts`, e não um
 * import: a rotina de pátio não pode acoplar em feature do painel de gestão.
 * Mexeu na escada, confira os dois.
 *
 * ⚠️ Faixa usa a família de PREENCHIMENTO (`error`, `warning`) e o rótulo usa a
 * `-on-light`: uma é elemento gráfico (pede 3:1), o outro é texto (pede 4,5:1).
 */
const SEVERITY_LABEL: Record<Severity, string> = { LEVE: 'Leve', MEDIA: 'Média', GRAVE: 'Grave' };

const SEVERITY_RAIL: Record<Severity, string> = {
  LEVE: 'bg-on-light-muted',
  MEDIA: 'bg-warning',
  GRAVE: 'bg-error',
};

const SEVERITY_TEXT: Record<Severity, string> = {
  LEVE: 'text-on-light-muted',
  MEDIA: 'text-warning-on-light',
  GRAVE: 'text-error-on-light',
};

const SEVERITY_RANK: Record<Severity, number> = { GRAVE: 0, MEDIA: 1, LEVE: 2 };

/** A partir de quantas horas a espera vira problema, e não estado. */
const LONG_WAIT_HOURS = 6;

const STATUS: Record<TriageFill['status'], { label: string; chip: string }> = {
  PENDENTE: { label: 'Aguardando triagem', chip: 'bg-warning-on-light/12 text-warning-on-light' },
  APROVADO: { label: 'Resolvido no pátio', chip: 'bg-success-on-light/12 text-success-on-light' },
  ENVIADO_MANUTENCAO: { label: 'Na oficina', chip: 'bg-info-on-light/12 text-info-on-light' },
  ESCALADO: { label: 'Escalado ao gestor', chip: 'bg-error-on-light/10 text-error-on-light' },
};

/* Poço do campo de texto, na receita do painel de decisão do gestor. */
const FIELD =
  'text-body-md text-on-light placeholder:text-placeholder bg-light-container border-light-outline focus-visible:ring-primary-on-light mt-3 w-full rounded-md border p-3 focus:outline-none focus-visible:ring-2 disabled:opacity-60';

const ACTIONS: { id: TriagePayload['action']; label: string; hint: string }[] = [
  { id: 'APROVAR', label: 'Resolver no pátio', hint: 'A divergência foi sanada aqui mesmo.' },
  { id: 'MANUTENCAO', label: 'Mandar para a oficina', hint: 'Abre ordem, sem impedir a saída.' },
  { id: 'ESCALAR', label: 'Escalar ao gestor', hint: 'Quem autoriza a saída é o gestor.' },
];

/** O degrau mais alto entre as reprovações: é ele que descreve o checklist. */
function worstSeverity(fill: TriageFill): Severity {
  return fill.failures.reduce<Severity>(
    (worst, failure) =>
      SEVERITY_RANK[failure.severity] < SEVERITY_RANK[worst] ? failure.severity : worst,
    'LEVE',
  );
}

function waitingHours(fill: TriageFill): number {
  return Math.max(0, Math.floor((Date.now() - new Date(fill.receivedAt).getTime()) / 3_600_000));
}

/** Acima de dois dias a conta vira dias: "822 h" é um número que ninguém lê. */
function formatWait(hours: number): string {
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function countLabel(total: number): string {
  return total === 1 ? '1 reprovação' : `${total} reprovações`;
}

/**
 * Tratativa de um preenchimento, no molde do painel de decisão do gestor.
 *
 * A regra que importa: reprovação que impede a saída (RF-016) **não** se resolve
 * no pátio. O operador descreve o que verificou e escala: a autorização é do
 * gestor, e cai na fila de Liberações dele.
 */
function TriageDetail({ fill }: { fill: TriageFill }) {
  const [action, setAction] = useState<TriagePayload['action']>(
    fill.blocking ? 'ESCALAR' : 'APROVAR',
  );
  const [note, setNote] = useState('');
  const decide = useDecideTriage();

  const settled = fill.status !== 'PENDENTE';
  const hours = waitingHours(fill);

  const status = STATUS[fill.status];

  return (
    <LightCard
      title={<span className="tabular-nums">{fill.plate}</span>}
      action={
        <span
          className={cn(
            'rounded-pill text-label-md inline-flex items-center gap-1.5 px-2.5 py-1 normal-case',
            status.chip,
          )}
        >
          {status.label}
        </span>
      }
    >
      {/*
       * ⚠️ ZONA 1: o VEREDITO. É a única coisa que o operador precisa ler
       * antes de decidir, então é o elemento mais forte depois da placa.
       * A espera entra aqui porque é pressão, e pressão é assunto do veredito.
       */}
      <div
        className={cn(
          'flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg p-3.5',
          fill.blocking ? 'bg-error-on-light/10' : 'bg-light-container',
        )}
      >
        <p
          className={cn(
            'text-body-md min-w-0 flex-1 font-medium',
            fill.blocking ? 'text-error-on-light' : 'text-on-light-variant',
          )}
        >
          {fill.blocking ? (
            <LockIcon size={16} className="mr-1.5 inline shrink-0" aria-hidden />
          ) : null}
          {fill.blocking
            ? 'Saída bloqueada. Só o gestor autoriza, depois da sua verificação.'
            : 'Sem bloqueio de saída: dá para resolver no pátio ou abrir ordem na oficina.'}
        </p>

        <p
          className={cn(
            'text-body-md flex shrink-0 items-center gap-1.5 font-semibold tabular-nums',
            hours >= LONG_WAIT_HOURS ? 'text-error-on-light' : 'text-on-light-variant',
          )}
        >
          <ClockIcon size={15} aria-hidden />
          {formatWait(hours)} parado
        </p>
      </div>

      {/* ⚠️ ZONA 2: o CONTEXTO, numa linha só e num peso só. Modelo, motorista
            e as duas datas dizem QUAL preenchimento é este, e são o mesmo tipo
            de fato: partidos em pastilhas, viravam gaveta. */}
      <p className="text-on-light-muted text-label-md mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 normal-case">
        <TruckIcon size={14} aria-hidden className="shrink-0" />
        <span className="text-on-light-variant font-medium">{fill.templateName}</span>
        <span aria-hidden>·</span>
        <span>{fill.driverName}</span>
        <span aria-hidden>·</span>
        <span>preenchido em {formatDateTime(fill.filledAt)}</span>
        <span aria-hidden>·</span>
        <span>recebido em {formatDateTime(fill.receivedAt)}</span>
      </p>

      {/* Relógio do aparelho fora de hora vira flag de auditoria (RN-054). */}
      {fill.clockSkewHours >= 6 && (
        <p className="text-warning-on-light bg-warning-on-light/10 text-label-md mt-3 flex items-start gap-2 rounded-lg p-3 normal-case">
          <ClockIcon size={15} className="mt-0.5 shrink-0" aria-hidden />
          {fill.clockSkewHours}h de diferença entre o relógio do aparelho e o do servidor. Confira a
          data antes de decidir.
        </p>
      )}

      {/* ⚠️ ZONA 3: a EVIDÊNCIA. Mais respiro acima do título do que abaixo:
            é o que separa esta zona da anterior sem precisar de traço. */}
      <h3 className="text-on-light-variant text-body-md mt-7 font-semibold">
        Reprovações apontadas
      </h3>
      <ul className="mt-2.5 flex flex-col gap-2">
        {fill.failures.map((failure) => (
          <li key={failure.id} className="bg-light-container flex gap-3 rounded-md p-3">
            {/* Mesma faixa da fila ao lado: as duas superfícies falam a mesma
                  língua, e a cor repete o rótulo sem substituí-lo. */}
            <span
              className={cn(
                'w-1 shrink-0 self-stretch rounded-full',
                SEVERITY_RAIL[failure.severity],
              )}
              aria-hidden
            />

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-on-light min-w-0 flex-1 font-medium">{failure.label}</span>
                {failure.hasPhoto ? (
                  <CameraIcon
                    size={16}
                    className="text-on-light-muted shrink-0"
                    aria-label="Com foto"
                  />
                ) : null}
                <span
                  className={cn(
                    'text-label-md shrink-0 font-medium normal-case',
                    SEVERITY_TEXT[failure.severity],
                  )}
                >
                  {SEVERITY_LABEL[failure.severity]}
                </span>
              </span>
              {failure.note && (
                <span className="text-on-light-muted text-label-md mt-1 block normal-case">
                  {failure.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* ⚠️ ZONA 4: a DECISÃO, fechada em bloco próprio. O contorno separa o
            que se lê do que se preenche, sem precisar de um segundo cartão. */}
      {settled ? (
        <div className="border-light-outline mt-6 rounded-lg border p-4">
          <p className="text-on-light-variant text-body-md font-semibold">Tratativa registrada</p>
          {fill.decision && (
            <>
              <p className="text-on-light-variant text-body-md mt-1">{fill.decision.note}</p>
              <p className="text-on-light-muted text-label-md mt-1 normal-case">
                {fill.decision.by} · {formatDateTime(fill.decision.at)}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border-light-outline mt-6 rounded-lg border p-4">
          <fieldset>
            <legend className="text-on-light-variant text-body-md font-semibold">
              Encaminhamento
            </legend>
            <p className="text-on-light-muted text-label-md mt-1 normal-case">
              Obrigatório: fica no histórico do veículo e do motorista.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                      'rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/10'
                        : 'border-light-outline hover:bg-light-container',
                      blocked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="text-on-light block font-medium">{option.label}</span>
                    <span className="text-on-light-muted text-label-md mt-1 block normal-case">
                      {blocked ? 'Indisponível: a saída está bloqueada.' : option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Label
            htmlFor="triage-note"
            className="text-on-light-variant text-body-md mt-5 block font-semibold"
          >
            O que foi verificado no pátio
          </Label>
          <p className="text-on-light-muted text-label-md mt-1 normal-case">
            Mínimo de 10 caracteres: é o registro que sustenta a decisão.
          </p>
          <textarea
            id="triage-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Ex.: extintor substituído no pátio e conferido antes da saída."
            className={FIELD}
          />

          <div className="mt-4 flex flex-wrap gap-3">
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
        </div>
      )}
    </LightCard>
  );
}

/**
 * Triagem: fila de checklists recebidos dos motoristas pelo app.
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

  /* Sem seleção explícita, abre o primeiro da fila, que é o mais urgente. */
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];

  const pending = all.filter((item) => item.status === 'PENDENTE');
  const blocking = pending.filter((item) => item.blocking).length;
  const oldestHours = pending.length ? Math.max(...pending.map(waitingHours)) : 0;

  const stats: HeroStat[] = [
    {
      key: 'fila',
      label: 'Na fila',
      value: pending.length,
      hint: 'aguardando sua triagem',
      icon: ChecklistIcon,
    },
    {
      key: 'bloqueiam',
      label: 'Bloqueiam a saída',
      value: blocking,
      hint: blocking > 0 ? 'só o gestor autoriza' : 'nada travado agora',
      icon: WarningIcon,
      tone: blocking > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'espera',
      label: 'Espera mais longa',
      value: formatWait(oldestHours),
      hint: 'do checklist mais antigo',
      icon: ClockIcon,
      tone: oldestHours >= LONG_WAIT_HOURS ? 'warn' : 'neutral',
    },
    {
      key: 'tratados',
      label: 'Tratados',
      value: all.length - pending.length,
      hint: 'decisões já registradas',
      icon: CheckCircleIcon,
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Triagem"
        description="Checklists recebidos dos motoristas: verificação de pátio e encaminhamento das divergências."
      >
        <HeroPill icon={ClockIcon}>
          {pending.length === 0 ? 'Fila vazia' : `${pending.length} para tratar`}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel>
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
          <TabsList className="bg-surface-lowest rounded-pill mb-7 flex h-auto w-fit max-w-full justify-start gap-1 overflow-x-auto p-1.5">
            {TABS.map((entry) => (
              <TabsTrigger
                key={entry.id}
                value={entry.id}
                className="group text-body-md rounded-pill focus-visible:ring-primary text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.06] data-[state=active]:bg-surface-low data-[state=active]:text-accent shrink-0 px-5 py-2 font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 data-[state=active]:font-medium data-[state=active]:shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)] data-[state=active]:hover:bg-surface-low data-[state=active]:hover:text-accent"
              >
                {entry.label}
                <span className="ml-2 tabular-nums opacity-70 group-data-[state=active]:opacity-100">
                  {entry.id === 'PENDENTES' ? pending.length : all.length - pending.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              tab === 'PENDENTES' ? 'Nada aguardando triagem' : 'Nenhum checklist tratado ainda'
            }
            description={
              tab === 'PENDENTES'
                ? 'Assim que um motorista enviar um checklist com divergência, ele aparece aqui.'
                : 'As tratativas concluídas ficam registradas nesta aba.'
            }
          />
        ) : (
          <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,360px)_1fr]">
            <div className="min-w-0">
              <ul className="flex flex-col gap-2">
                {visible.map((item) => {
                  const active = item.id === selected?.id;
                  const severity = worstSeverity(item);
                  const hours = waitingHours(item);

                  return (
                    <li key={item.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'focus-visible:ring-primary-on-light flex w-full gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                          active ? 'bg-primary-strong' : 'hover:bg-light-container',
                        )}
                      >
                        {/* A cor repete o rótulo de severidade, nunca o substitui.
                          Bloqueio manda na faixa: um checklist médio que trava a
                          saída é o caso mais grave da fila. */}
                        <span
                          className={cn(
                            'w-1 shrink-0 self-stretch rounded-full',
                            active
                              ? 'bg-on-primary'
                              : item.blocking
                                ? 'bg-error'
                                : SEVERITY_RAIL[severity],
                          )}
                          aria-hidden
                        />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <TruckIcon
                              size={18}
                              aria-hidden
                              className={cn(
                                'mt-0.5 shrink-0 self-start',
                                active ? 'text-on-primary' : 'text-primary-on-light',
                              )}
                            />
                            <span
                              className={cn(
                                'min-w-0 flex-1 font-semibold tabular-nums',
                                active ? 'text-on-primary' : 'text-on-light',
                              )}
                            >
                              {item.plate}
                            </span>

                            {/* A espera é o que ordena a fila, então tem peso de
                              dado e não de rodapé. Passando do limite ela vira
                              vermelha, o mesmo corte do chip "N h parado". */}
                            <span
                              className={cn(
                                'shrink-0 font-semibold tabular-nums',
                                active
                                  ? 'text-on-primary'
                                  : hours >= LONG_WAIT_HOURS
                                    ? 'text-error-on-light'
                                    : 'text-on-light-variant',
                              )}
                            >
                              {formatWait(hours)}
                            </span>
                          </span>

                          <span
                            className={cn(
                              'text-label-md mt-1 block normal-case',
                              active ? 'text-on-primary' : 'text-on-light-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'font-medium',
                                active ? 'text-on-primary' : 'text-on-light-variant',
                              )}
                            >
                              {item.blocking ? 'Bloqueia a saída' : SEVERITY_LABEL[severity]}
                            </span>{' '}
                            · {countLabel(item.failures.length)}
                          </span>

                          {/* O checklist e o motorista são contexto, não risco:
                            linha própria, senão a corrente de pontos quebra em
                            três na coluna de 360px. */}
                          <span
                            className={cn(
                              'text-label-md mt-0.5 block truncate normal-case',
                              active ? 'text-on-primary' : 'text-on-light-muted',
                            )}
                          >
                            {item.templateName} · {item.driverName}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ⚠️ `xl:sticky`: no monitor a fila rola e a ficha fica. Numa fila
                longa o operador perdia de vista o checklist aberto ao procurar o
                próximo, e `self-start` é o que dá altura ao grudado no grid. */}
            <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
              {selected && <TriageDetail key={selected.id} fill={selected} />}
            </div>
          </div>
        )}
      </PagePanel>
    </div>
  );
}
