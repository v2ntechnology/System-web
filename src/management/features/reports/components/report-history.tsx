import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import type { ReportRunStatus } from '@/management/types';
import { Spinner, StatusChip, type StatusTone } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { toast } from 'sonner';

import { getReportRuns } from '../api';

const STATUS: Record<
  ReportRunStatus,
  { label: string; tone: StatusTone; icon: ComponentType<{ size?: number; weight?: 'fill' }> }
> = {
  PRONTO: { label: 'Pronto', tone: 'positive', icon: CheckCircleIcon },
  PROCESSANDO: { label: 'Processando', tone: 'info', icon: ArrowClockwiseIcon },
  FALHOU: { label: 'Falhou', tone: 'critical', icon: WarningCircleIcon },
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Gerações recentes do tenant — quem pediu o quê, quando, e o que saiu. */
export function ReportHistory() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['report-runs'],
    queryFn: getReportRuns,
  });

  if (isPending) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Spinner className="text-on-light-muted size-6" label="Carregando o histórico" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-on-light-variant text-body-md py-10 text-center">
        Não foi possível carregar o histórico.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-sora text-primary text-headline-md">Gerações recentes</h2>
        <p className="text-on-light-variant text-body-md mt-1">
          Todo arquivo gerado fica registrado com autor, período e horário — é o que sustenta uma
          auditoria depois.
        </p>
      </div>

      <ul className="grid gap-3 xl:grid-cols-2">
        {data.map((run) => {
          const status = STATUS[run.status];
          const StatusIcon = status.icon;

          return (
            <li key={run.id} className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-on-surface font-semibold">{run.reportTitle}</h3>
                  <p className="text-on-surface-muted text-label-md mt-1 flex flex-wrap items-center gap-x-3 normal-case">
                    <span className="tabular">{run.format}</span>
                    <span>{run.periodLabel}</span>
                    <span>{run.requestedBy}</span>
                    <span className="tabular">{dateTime.format(new Date(run.requestedAt))}</span>
                  </p>
                </div>

                <StatusChip tone={status.tone} icon={<StatusIcon size={14} weight="fill" />}>
                  {status.label}
                </StatusChip>
              </div>

              {run.error ? (
                <p className="text-error text-label-md mt-3 normal-case">{run.error}</p>
              ) : null}

              <div className="border-outline-variant mt-auto flex flex-wrap items-center gap-3 border-t pt-3">
                {run.status === 'PRONTO' ? (
                  <>
                    <span className="tabular text-on-surface-muted text-label-md normal-case">
                      {run.sizeKb} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => toast.success(`Baixando "${run.reportTitle}"`)}
                      className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-white/5 px-3 py-1.5 normal-case transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                    >
                      <DownloadSimpleIcon size={14} weight="bold" aria-hidden="true" />
                      Baixar
                      <span className="sr-only">{run.reportTitle}</span>
                    </button>
                  </>
                ) : run.status === 'PROCESSANDO' ? (
                  <span className="text-on-surface-muted text-label-md normal-case">
                    Você será avisado quando o arquivo ficar pronto.
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toast.info(`Gerando "${run.reportTitle}" novamente`)}
                    className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary ml-auto inline-flex items-center gap-1.5 rounded-md border bg-white/5 px-3 py-1.5 normal-case transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <ArrowClockwiseIcon size={14} weight="bold" aria-hidden="true" />
                    Tentar de novo
                    <span className="sr-only">— {run.reportTitle}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
