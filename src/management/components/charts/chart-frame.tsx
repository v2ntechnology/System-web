import { ChartLineIcon, TableIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/**
 * Peças compartilhadas por todo gráfico do painel.
 *
 * Existem porque o alternador tabela/gráfico, a legenda e o balão de tooltip
 * estavam sendo recopiados em cada card novo — e as três coisas são obrigatórias
 * em todo gráfico do projeto (regra 8b). Copiar significava esquecer uma delas.
 */

/**
 * Alternador gráfico ↔ tabela.
 *
 * Não é conveniência: é a visão equivalente que a regra 8b exige de todo
 * gráfico. Sem ela o dado fica inacessível a leitor de tela.
 */
export function ChartViewToggle({ asTable, onToggle }: { asTable: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={asTable}
      className="border-light-outline text-on-light-variant hover:bg-light-container focus-visible:ring-primary-on-light text-label-md flex items-center gap-2 rounded-md border px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      {asTable ? <ChartLineIcon size={16} /> : <TableIcon size={16} />}
      {asTable ? 'Ver gráfico' : 'Ver tabela'}
    </button>
  );
}

export interface ChartLegendItem {
  label: string;
  color: string;
  /** Valor mais recente da série, já formatado. */
  value?: string | undefined;
}

/**
 * Legenda do gráfico.
 *
 * Obrigatória a partir de duas séries. O valor ao lado do rótulo não é enfeite:
 * garante que a identidade da série nunca dependa só da cor.
 */
export function ChartLegend({
  items,
  note,
}: {
  items: ChartLegendItem[];
  /** Recorte exibido, alinhado à direita. */
  note?: string | undefined;
}) {
  return (
    <ul className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-[3px]"
            style={{ background: item.color }}
          />
          <span className="text-on-light-variant text-body-md">{item.label}</span>
          {item.value ? (
            <span className="tabular text-on-light text-body-md font-semibold">{item.value}</span>
          ) : null}
        </li>
      ))}
      {note ? (
        <li className="ml-auto">
          <span className="text-on-light-muted text-label-md normal-case">{note}</span>
        </li>
      ) : null}
    </ul>
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string | undefined;
}

/**
 * Balão do tooltip.
 *
 * Superfície escura sobre o painel claro de propósito: o balão precisa se
 * separar do fundo do gráfico, e `surface-lowest` é o poço da escala.
 */
export function ChartTooltipShell({
  label,
  rows,
  footer,
}: {
  label: ReactNode;
  rows: TooltipRow[];
  footer?: { label: string; value: string };
}) {
  return (
    <div className="bg-surface-lowest ring-outline-variant rounded-md p-3 shadow-xl ring-1">
      <p className="text-on-surface text-label-md mb-2 normal-case">{label}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: row.color }}
              />
            ) : null}
            <span className="text-on-surface-variant text-label-md flex-1 normal-case">
              {row.label}
            </span>
            <span className="tabular text-on-surface text-label-md">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer ? (
        <p className="border-outline-variant mt-2 flex justify-between gap-4 border-t pt-2">
          <span className="text-on-surface-variant text-label-md normal-case">{footer.label}</span>
          <span className="tabular text-on-surface text-label-md font-semibold">
            {footer.value}
          </span>
        </p>
      ) : null}
    </div>
  );
}
