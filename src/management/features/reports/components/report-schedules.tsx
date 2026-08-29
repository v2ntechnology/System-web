import { MailIcon, PlusIcon, RepeatIcon } from '@/components/icons';
import type { ScheduleFrequency } from '@/management/types';
import { Spinner, StatusChip } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getReportSchedules } from '../api';

const FREQUENCY: Record<ScheduleFrequency, string> = {
  DIARIO: 'Todo dia',
  SEMANAL: 'Toda semana',
  MENSAL: 'Todo mês',
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Envios recorrentes por e-mail. O disparo é do worker (BE-08 · digest diário). */
export function ReportSchedules() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['report-schedules'],
    queryFn: getReportSchedules,
  });

  if (isPending) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Spinner className="text-on-light-muted size-6" label="Carregando os agendamentos" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-on-light-variant text-body-md py-10 text-center">
        Não foi possível carregar os agendamentos.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sora text-primary text-headline-md">Envios recorrentes</h2>
          <p className="text-on-light-variant text-body-md mt-1">
            O relatório é gerado e enviado por e-mail automaticamente, sem ninguém precisar lembrar.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            toast.info('Novo agendamento', {
              description: 'A configuração de envios recorrentes entra numa próxima etapa.',
            })
          }
          className="bg-primary-strong text-on-primary text-label-md focus-visible:ring-primary-on-light inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-2.5 normal-case transition-opacity hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        >
          <PlusIcon size={16} aria-hidden="true" />
          Novo agendamento
        </button>
      </div>

      <ul className="grid gap-3 xl:grid-cols-2">
        {data.map((schedule) => (
          <li key={schedule.id} className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-on-surface font-semibold">{schedule.reportTitle}</h3>
                <p className="text-on-surface-variant text-body-md mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <RepeatIcon size={14} aria-hidden="true" />
                    {FREQUENCY[schedule.frequency]} · {schedule.format}
                  </span>
                  <span className="tabular text-on-surface-muted text-label-md normal-case">
                    Próximo envio {dateTime.format(new Date(schedule.nextRunAt))}
                  </span>
                </p>
              </div>

              <StatusChip tone={schedule.active ? 'positive' : 'neutral'}>
                {schedule.active ? 'Ativo' : 'Pausado'}
              </StatusChip>
            </div>

            <div className="border-outline-variant mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
              <MailIcon size={14} className="text-on-surface-muted" aria-hidden="true" />
              <span className="text-on-surface-muted text-label-md normal-case">
                {schedule.recipients.length === 1
                  ? 'Destinatário:'
                  : `${schedule.recipients.length} destinatários:`}
              </span>
              {schedule.recipients.map((recipient) => (
                <span
                  key={recipient}
                  className="border-outline-variant text-on-surface-variant tabular rounded-pill text-label-md border px-2.5 py-1 normal-case"
                >
                  {recipient}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
