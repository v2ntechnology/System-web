import { InfoIcon } from '@/components/icons';
import type { IncomeStatement, IncomeStatementLine } from '@/management/types';
import { LightCard, cn } from '@/management/ui';
import { Fragment } from 'react';

import { brlWhole, percent, signedPercent } from '@/management/lib/format';

/**
 * O sinal com que cada natureza de linha entra no resultado.
 *
 * Os valores chegam sempre positivos do backend — quem decide o sinal é o
 * `kind`. Guardar "-1.640.000" no custo obrigaria cada tela a adivinhar a
 * convenção, e uma delas adivinharia errado.
 */
function signOf(line: IncomeStatementLine) {
  if (line.kind === 'DEDUCAO' || line.kind === 'CUSTO') return '−';
  if (line.kind === 'RESULTADO' && line.value < 0) return '−';
  return '';
}

export interface IncomeStatementCardProps {
  statement: IncomeStatement;
  className?: string | undefined;
}

/**
 * DRE do período (visão do dono).
 *
 * Tabela e não gráfico de propósito: a DRE é lida linha por linha, e o que
 * importa é o encadeamento receita → dedução → custo → resultado. Cada linha
 * declara a participação na receita líquida e a variação contra o período
 * anterior, porque valor absoluto sozinho não diz se melhorou.
 */
export function IncomeStatementCard({ statement, className }: IncomeStatementCardProps) {
  return (
    <LightCard
      title="Demonstrativo de resultado"
      className={className}
      action={
        <span className="text-on-light-muted text-label-md normal-case">
          {statement.periodLabel}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-140 w-full text-left">
          <caption className="sr-only">
            Demonstrativo de resultado do exercício no período, com participação na receita líquida
            e variação contra o período anterior
          </caption>
          <thead>
            <tr className="border-light-outline border-b">
              <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4">
                Linha
              </th>
              <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4 text-right">
                Valor
              </th>
              <th scope="col" className="text-on-light-variant text-label-md py-2 pr-4 text-right">
                % da receita
              </th>
              <th scope="col" className="text-on-light-variant text-label-md py-2 text-right">
                vs. anterior
              </th>
            </tr>
          </thead>

          <tbody className="tabular">
            {statement.lines.map((line) => {
              const isResult = line.kind === 'RESULTADO';
              const isFinal = line.id === 'resultado';
              /* Custo e dedução que sobem são ruins; receita que sobe é boa. */
              const worse =
                line.kind === 'CUSTO' || line.kind === 'DEDUCAO'
                  ? line.deltaPercent > 0
                  : line.deltaPercent < 0;

              return (
                <Fragment key={line.id}>
                  <tr
                    className={cn(
                      'border-light-outline/60 border-b',
                      isFinal && 'border-light-outline border-t-2',
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        'text-body-md py-2.5 pr-4 font-normal',
                        isResult ? 'text-on-light font-semibold' : 'text-on-light',
                      )}
                    >
                      {line.label}
                    </th>

                    <td
                      className={cn(
                        'text-body-md py-2.5 pr-4 text-right',
                        isFinal
                          ? line.value >= 0
                            ? 'text-success-on-light font-semibold'
                            : 'text-error-on-light font-semibold'
                          : isResult
                            ? 'text-on-light font-semibold'
                            : 'text-on-light-variant',
                      )}
                    >
                      {signOf(line)}
                      {brlWhole.format(Math.abs(line.value))}
                    </td>

                    <td className="text-on-light-variant text-body-md py-2.5 pr-4 text-right">
                      {percent(Math.abs(line.sharePercent))}
                    </td>

                    <td
                      className={cn(
                        'text-body-md py-2.5 text-right',
                        line.deltaNote
                          ? line.value >= 0
                            ? 'text-success-on-light'
                            : 'text-error-on-light'
                          : line.deltaPercent === 0
                            ? 'text-on-light-muted'
                            : worse
                              ? 'text-error-on-light'
                              : 'text-success-on-light',
                      )}
                    >
                      {/* A frase tem precedência: existe justamente porque o percentual mentiria. */}
                      {line.deltaNote ??
                        (line.deltaPercent === 0 ? '—' : signedPercent(line.deltaPercent))}
                    </td>
                  </tr>

                  {/* Detalhamento do custo: o dono quer ver de onde vem sem trocar de tela. */}
                  {line.children?.map((child) => (
                    <tr
                      key={`${line.id}-${child.label}`}
                      className="border-light-outline/40 border-b"
                    >
                      <th
                        scope="row"
                        className="text-on-light-variant text-body-md py-2 pl-5 pr-4 font-normal"
                      >
                        {child.label}
                      </th>
                      <td className="text-on-light-variant text-body-md py-2 pr-4 text-right">
                        −{brlWhole.format(child.value)}
                      </td>
                      <td className="text-on-light-muted text-body-md py-2 pr-4 text-right">
                        {percent((child.value / statement.netRevenue) * 100)}
                      </td>
                      <td
                        className={cn(
                          'text-body-md py-2 text-right',
                          child.deltaPercent === 0
                            ? 'text-on-light-muted'
                            : child.deltaPercent > 0
                              ? 'text-error-on-light'
                              : 'text-success-on-light',
                        )}
                      >
                        {child.deltaPercent === 0 ? '—' : signedPercent(child.deltaPercent)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RN-121 — o número vem com a procedência colada nele. */}
      <p className="text-on-light-muted text-label-md mt-auto flex items-start gap-1.5 pt-5 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        {statement.source}
      </p>
    </LightCard>
  );
}
