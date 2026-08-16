import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@phosphor-icons/react';
import type { OperationalCostCategory } from '@/management/types';
import { LightCard, cn } from '@/management/ui';

import { brl, brlWhole, percent, signedPercent } from '@/management/lib/format';

export interface CostCategoriesCardProps {
  categories: OperationalCostCategory[];
  periodLabel: string;
  className?: string | undefined;
}

/**
 * Custos operacionais globais por categoria (visão do dono).
 *
 * Barras horizontais de **uma cor só**: aqui a informação é magnitude, não
 * identidade — seis matizes categóricos para seis grandezas comparáveis seria
 * ruído, além de estourar a paleta validada de três cores (regra 8b).
 *
 * Cada linha traz o valor, a participação e a variação **em texto**. Por isso
 * não há tooltip: não existe dado escondido na geometria para revelar no hover.
 */
export function CostCategoriesCard({
  categories,
  periodLabel,
  className,
}: CostCategoriesCardProps) {
  const max = Math.max(...categories.map((category) => category.value), 1);
  const total = categories.reduce((sum, category) => sum + category.value, 0);

  return (
    <LightCard
      title="Custos operacionais"
      className={className}
      action={
        /*
         * `min-w-0` + tipo menor no mobile: em 390px o total a 24px somado ao
         * título disputava a linha do cabeçalho e o número saía cortado na borda
         * do card. O tamanho cheio volta a partir do `sm`.
         */
        <div className="min-w-0 text-right">
          <p className="tabular text-on-light text-body-lg sm:text-headline-md font-semibold">
            {brlWhole.format(total)}
          </p>
          <p className="text-on-light-muted text-label-md normal-case">{periodLabel}</p>
        </div>
      }
    >
      <ul className="flex flex-col gap-4">
        {categories.map((category) => {
          const width = Math.max((category.value / max) * 100, 3);
          /*
           * Custo que sobe é ruim, custo que cai é bom — o inverso da leitura
           * intuitiva de "seta para cima = positivo". Por isso a seta e a cor
           * vêm sempre acompanhadas do sinal do percentual.
           */
          const worse = category.deltaPercent > 0;

          return (
            <li key={category.id} className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-on-light min-w-0 font-medium">{category.label}</p>

                <p className="flex items-baseline gap-3">
                  <span className="tabular text-on-light-muted text-label-md normal-case">
                    {brl.format(category.costPerKm)}/km
                  </span>
                  <span className="tabular text-on-light font-semibold">
                    {brlWhole.format(category.value)}
                  </span>
                </p>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="bg-light-container rounded-pill h-2.5 min-w-0 flex-1 overflow-hidden"
                >
                  <span
                    className="bg-chart-1 rounded-pill block h-full"
                    style={{ width: `${width}%` }}
                  />
                </span>

                <span className="tabular text-on-light-variant text-label-md w-11 shrink-0 text-right normal-case">
                  {percent(category.sharePercent, 0)}
                </span>

                <span
                  className={cn(
                    'tabular text-label-md flex w-24 shrink-0 items-center justify-end gap-1 normal-case',
                    category.deltaPercent === 0
                      ? 'text-on-light-muted'
                      : worse
                        ? 'text-error-on-light'
                        : 'text-success-on-light',
                  )}
                >
                  {category.deltaPercent === 0 ? (
                    <MinusIcon size={12} weight="bold" aria-hidden="true" />
                  ) : worse ? (
                    <ArrowUpIcon size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <ArrowDownIcon size={12} weight="bold" aria-hidden="true" />
                  )}
                  {signedPercent(category.deltaPercent)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
        Participação no custo total e variação contra o período anterior.
      </p>
    </LightCard>
  );
}
