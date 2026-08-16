import { DownloadSimpleIcon, InfoIcon, LockSimpleIcon, RowsIcon } from '@phosphor-icons/react';
import type { ReportDefinition, ReportFormat, AnalyticsPeriod } from '@/management/types';
import { Spinner, StatusChip } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PERIOD_LABELS } from '@/management/components/layout/period-labels';

import { getReportPreview } from '../api';

const number = new Intl.NumberFormat('pt-BR');
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function ReportDetailPanel({
  report,
  period,
  locked,
}: {
  report: ReportDefinition;
  period: AnalyticsPeriod;
  locked: boolean;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['report-preview', report.id, period],
    queryFn: () => getReportPreview(report.id, period),
    enabled: !locked,
  });

  function download(format: ReportFormat) {
    toast.success(`Gerando "${report.title}" em ${format}`, {
      description: `${PERIOD_LABELS[period]} · você receberá um aviso quando o arquivo estiver pronto.`,
    });
  }

  return (
    <section
      aria-label={`Detalhes do relatório ${report.title}`}
      className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
    >
      <header className="border-outline-variant flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h3 className="font-sora text-on-surface text-headline-md font-bold">{report.title}</h3>
          <p className="text-on-surface-variant text-body-md mt-1">{report.description}</p>
        </div>

        {locked ? (
          <StatusChip tone="attention" icon={<LockSimpleIcon size={14} weight="fill" />}>
            Não contratado
          </StatusChip>
        ) : null}
      </header>

      {locked ? (
        /* RN-004 — módulo não contratado aparece bloqueado, com CTA, e não some. */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <LockSimpleIcon size={40} weight="duotone" className="text-warning" aria-hidden="true" />
          <p className="text-on-surface-variant text-body-md max-w-sm">
            Este relatório faz parte de um módulo que não está no seu plano. Fale com o time
            comercial para liberar o acesso.
          </p>
          <button
            type="button"
            onClick={() =>
              toast.info('Módulo não incluído no seu plano', {
                description: 'Nosso time comercial entrará em contato.',
              })
            }
            className="border-warning/40 text-warning text-label-md focus-visible:ring-secondary rounded-md border px-4 py-2 normal-case transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
          >
            Conhecer o módulo
          </button>
        </div>
      ) : (
        <>
          {/* Metadados do recorte */}
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="bg-white/4 rounded-md p-3">
              <dt className="text-on-surface-muted text-label-md normal-case">Período</dt>
              <dd className="text-on-surface text-body-md mt-1">{PERIOD_LABELS[period]}</dd>
            </div>
            <div className="bg-white/4 rounded-md p-3">
              <dt className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
                <RowsIcon size={14} weight="duotone" aria-hidden="true" />
                Linhas estimadas
              </dt>
              <dd className="tabular text-on-surface text-body-md mt-1">
                {data ? number.format(data.totalRows) : '—'}
              </dd>
            </div>
            <div className="bg-white/4 rounded-md p-3">
              <dt className="text-on-surface-muted text-label-md normal-case">Última geração</dt>
              <dd className="tabular text-on-surface text-body-md mt-1">
                {dateTime.format(new Date(report.generatedAt))}
              </dd>
            </div>
          </dl>

          {/* Colunas que saem no arquivo */}
          <div className="mt-5">
            <h4 className="text-on-surface-variant text-body-md mb-2">
              Colunas incluídas ({report.columns.length})
            </h4>
            <ul className="flex flex-wrap gap-2">
              {report.columns.map((column) => (
                <li
                  key={column}
                  className="border-outline-variant text-on-surface-variant rounded-pill text-label-md border px-2.5 py-1 normal-case"
                >
                  {column}
                </li>
              ))}
            </ul>
          </div>

          {/* Prévia — conferir antes de gerar o arquivo inteiro */}
          <div className="mt-5 min-h-0 flex-1">
            <h4 className="text-on-surface-variant text-body-md mb-2">Prévia</h4>

            {isPending ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="text-on-surface-muted size-5" label="Carregando a prévia" />
              </div>
            ) : isError || !data ? (
              <p className="text-error text-body-md">Não foi possível carregar a prévia.</p>
            ) : data.rows.length === 0 ? (
              <p className="bg-white/4 text-on-surface-variant text-body-md rounded-md px-4 py-3">
                Prévia indisponível para este relatório. O arquivo completo traz as colunas acima.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-160 w-full border-collapse text-left">
                  <caption className="sr-only">
                    Primeiras linhas de {report.title} — {PERIOD_LABELS[period]}
                  </caption>
                  <thead>
                    <tr className="border-outline-variant border-b">
                      {data.columns.map((column, index) => (
                        <th
                          key={column}
                          scope="col"
                          className="text-on-surface-variant text-label-md py-2 pr-4 font-medium"
                          style={index > 0 ? { textAlign: 'right' } : undefined}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {data.rows.map((row) => (
                      <tr
                        key={String(row[0])}
                        className="border-outline-variant/60 border-b last:border-0"
                      >
                        {row.map((cell, index) => (
                          <td
                            key={index}
                            className="text-on-surface text-body-md py-2 pr-4"
                            style={index > 0 ? { textAlign: 'right' } : undefined}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* RN-121 — a procedência acompanha o número e vai no cabeçalho do arquivo. */}
            {data ? (
              <p className="text-on-surface-muted text-label-md mt-3 flex items-start gap-1.5 normal-case">
                <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {data.source}
                {data.rows.length > 0
                  ? ` · exibindo ${data.rows.length} de ${number.format(data.totalRows)} linhas`
                  : ''}
              </p>
            ) : null}
          </div>

          <div className="border-outline-variant mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-on-surface-variant text-body-md">Exportar como</span>
            {report.formats.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => download(format)}
                className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border bg-white/5 px-3 py-2 normal-case transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
              >
                <DownloadSimpleIcon size={16} weight="bold" aria-hidden="true" />
                {format}
                <span className="sr-only">— baixar {report.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
