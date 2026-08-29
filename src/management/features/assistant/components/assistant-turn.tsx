import { ArrowRightIcon, InfoIcon, SparklesIcon } from '@/components/icons';
import type { AssistantTurn as Turn } from '@/management/types';
import { Spinner } from '@/management/ui';
import { Link } from 'react-router';

import { AnswerChart } from './answer-chart';

export function AssistantTurn({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  return (
    <article className="flex flex-col gap-3">
      {/* Pergunta */}
      <p className="bg-primary-strong text-on-primary ml-auto max-w-[85%] rounded-lg rounded-br-sm px-4 py-2.5">
        {turn.question}
      </p>

      {/* Resposta */}
      <div className="flex gap-3">
        <span className="bg-primary/20 text-primary rounded-pill mt-0.5 flex size-8 shrink-0 items-center justify-center">
          <SparklesIcon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          {turn.status === 'pending' ? (
            <p className="text-on-surface-muted flex items-center gap-2 py-2">
              <Spinner label="Consultando" />
              Consultando os dados da sua frota…
            </p>
          ) : turn.status === 'error' ? (
            <p className="text-error">
              Não consegui consultar agora. Tente novamente em instantes.
            </p>
          ) : turn.answer ? (
            <>
              <p className="text-on-surface text-body-md whitespace-pre-line">{turn.answer.text}</p>

              {turn.answer.chart ? <AnswerChart chart={turn.answer.chart} /> : null}

              {turn.answer.table ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-100 w-full border-collapse text-left">
                    <thead>
                      <tr className="border-outline-variant border-b">
                        {turn.answer.table.columns.map((column, index) => (
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
                      {turn.answer.table.rows.map((row) => (
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
              ) : null}

              {/*
               * RN-121 — fonte e período. O gestor precisa saber sobre que dado o
               * número foi calculado ANTES de decidir com base nele.
               */}
              {turn.answer.source ? (
                <p className="text-on-surface-muted text-label-md mt-3 flex items-start gap-1.5 normal-case">
                  <InfoIcon size={14} className="mt-0.5 shrink-0" />
                  {turn.answer.source}
                </p>
              ) : null}

              {/* RN-116 — ação contextual embutida na resposta. */}
              {turn.answer.actions?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {turn.answer.actions.map((action) =>
                    action.to ? (
                      <Link
                        key={action.label}
                        to={action.to}
                        onClick={onNavigate}
                        className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border bg-on-surface/5 px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2"
                      >
                        {action.label}
                        <ArrowRightIcon size={14} />
                      </Link>
                    ) : null,
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
