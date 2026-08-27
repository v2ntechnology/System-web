import { InfoIcon } from '@/components/icons';
import type { UnitPerformance } from '@/management/lib/fleet-api';
import { LightCard, cn } from '@/management/ui';

/**
 * Comparação entre filiais.
 *
 * ⚠️ A ordem é por QUILOMETRAGEM, e o destaque é por taxa. A filial com mais
 * caminhões gera mais eventos e roda mais quilômetros por definição: ranquear
 * por total absoluto premiaria a menor unidade todo mês, o que não diz nada
 * sobre quem opera melhor.
 *
 * O que compara é evento por mil quilômetros e consumo médio. Filial que não
 * rodou no período mostra travessão, não zero: zero em "eventos por mil km"
 * leria como frota exemplar quando significa que ninguém saiu.
 */

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export interface UnitPerformanceCardProps {
  units: UnitPerformance[];
  periodLabel: string;
  className?: string | undefined;
}

export function UnitPerformanceCard({ units, periodLabel, className }: UnitPerformanceCardProps) {
  /* A referência é a frota inteira, e não a melhor filial: comparar com a melhor
     faria todas as outras parecerem ruins, inclusive as que vão bem. */
  const comRodagem = units.filter((u) => u.eventsPer1000Km != null);
  const referencia =
    comRodagem.length > 0
      ? comRodagem.reduce((soma, u) => soma + (u.eventsPer1000Km ?? 0), 0) / comRodagem.length
      : null;

  return (
    <LightCard
      title="Comparação entre filiais"
      className={className}
      action={<span className="text-on-light-muted text-label-md normal-case">{periodLabel}</span>}
    >
      {units.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-6 text-center">
          Nenhuma filial com veículos cadastrados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-on-light-muted text-label-md normal-case">
                <th scope="col" className="py-2 text-left font-normal">
                  Filial
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Veículos
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Km rodados
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Eventos / mil km
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Consumo
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Motor parado
                </th>
              </tr>
            </thead>

            <tbody>
              {units.map((unidade) => {
                const acimaDaMedia =
                  referencia != null &&
                  unidade.eventsPer1000Km != null &&
                  unidade.eventsPer1000Km > referencia;

                return (
                  <tr key={unidade.unit} className="border-outline-variant/40 border-t">
                    <td className="py-2.5 pr-3">
                      <span className="text-on-light">{unidade.unit}</span>
                      {/* Veículo cadastrado que não reporta é problema de instalação,
                          não de operação. Some da conta de desempenho e aparece aqui. */}
                      {unidade.reporting < unidade.vehicles ? (
                        <span className="text-on-light-muted text-label-md ml-2 normal-case">
                          {unidade.vehicles - unidade.reporting} sem sinal
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {unidade.vehicles}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {numero(unidade.distanceKm)}
                    </td>
                    <td
                      className={cn(
                        'tabular py-2.5 text-right',
                        acimaDaMedia ? 'text-error-on-light' : 'text-on-light-variant',
                      )}
                    >
                      {numero(unidade.eventsPer1000Km)}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {unidade.avgFuelEfficiency == null
                        ? '–'
                        : `${numero(unidade.avgFuelEfficiency, 1)} km/l`}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {unidade.idleHours == null ? '–' : `${numero(unidade.idleHours, 1)} h`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-on-light-muted text-label-md mt-4 flex items-start gap-1.5 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Comparado por taxa, não por total: a filial maior gera mais eventos e mais quilômetros por
        definição. Vermelho marca quem está acima da média da frota.
      </p>
    </LightCard>
  );
}
