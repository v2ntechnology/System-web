import { InfoIcon } from '@/components/icons';
import { SEM_CATEGORIA, aggregateFuel } from '@/management/features/costs/fuel';
import type { VehiclePerformance } from '@/management/lib/fleet-api';
import { LightCard, cn } from '@/management/ui';
import { useMemo } from 'react';

/**
 * Desempenho por caminhão, no lugar da rentabilidade que não tem fonte.
 *
 * ⚠️ **Consumo não compara entre tipos.** Uma van faz 18 km/l e um caminhão faz
 * 2,6: pôr os dois no mesmo ranking elegeria "pior consumo da frota" um veículo
 * que está indo bem para o que ele é. Por isso o tipo aparece na linha e o
 * destaque de consumo é contra a média do MESMO tipo.
 *
 * A ordem é por quilometragem porque é o que diz quem está trabalhando. Ordenar
 * por evento ou por consumo poria no topo quem quase não saiu, que é ruído.
 */

const TIPO_LABEL: Record<string, string> = {
  truck: 'caminhão',
  tractor_unit: 'cavalo',
  trailer: 'reboque',
  van: 'van',
  light: 'leve',
};

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export interface VehiclePerformanceCardProps {
  vehicles: VehiclePerformance[];
  periodLabel: string;
  className?: string | undefined;
}

export function VehiclePerformanceCard({
  vehicles,
  periodLabel,
  className,
}: VehiclePerformanceCardProps) {
  /*
   * A régua é a MESMA da tela de Custos, pelo `aggregateFuel`.
   *
   * ⚠️ Este cálculo era próprio daqui e divergia em três pontos, corrigidos em
   * 09/09/2026 a pedido do usuário, que pediu médias consistentes entre telas:
   *
   *   1. Era MÉDIA DAS MÉDIAS. Medido nos dados de produção do dia: dava 4,55
   *      km/l para "truck" onde a régua ponderada dá 3,56, uma superestimação de
   *      27,7%. Um veículo que rodou 200 km pesava igual a um que rodou 3.000.
   *   2. Contava veículo PARADO no período, que a tela de Custos exclui: sem
   *      quilômetro rodado não há consumo para comparar.
   *   3. Veículo sem categoria caía em `truck`, e em Custos cai em
   *      `sem-categoria`. O mesmo veículo entrava em grupos diferentes.
   *
   * ⚠️ A média daqui não aparece na tela: ela decide quais consumos saem em
   * VERMELHO (`text-error-on-light`; o âmbar da linha ao lado é do motor
   * parado, outra regra). Uma régua inflada gera ALERTA FALSO, que é pior que
   * não alertar, porque quem confere perde a confiança na cor.
   */
  const mediaPorTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const grupo of aggregateFuel(vehicles).grupos) {
      /* Menos de dois no grupo, ninguém para comparar: o único veículo seria a
         própria média e nunca destacaria. */
      if (grupo.media != null && grupo.itens.length >= 2) mapa.set(grupo.categoria, grupo.media);
    }
    return mapa;
  }, [vehicles]);

  /* Só quem rodou entra na tabela: 41 linhas, 30 delas zeradas, escondem as 11
     que têm o que dizer. Quantos ficaram de fora vai no rodapé. */
  const rodaram = vehicles.filter((veiculo) => (veiculo.distanceKm ?? 0) > 0);
  const parados = vehicles.length - rodaram.length;

  return (
    <LightCard
      title="Desempenho por caminhão"
      className={className}
      action={<span className="text-on-light-muted text-label-md normal-case">{periodLabel}</span>}
    >
      {rodaram.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-6 text-center">
          Nenhum veículo rodou no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-on-light-muted text-label-md normal-case">
                <th scope="col" className="py-2 text-left font-normal">
                  Veículo
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Km rodados
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Dias em uso
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Consumo
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Motor parado
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Eventos / mil km
                </th>
              </tr>
            </thead>

            <tbody>
              {rodaram.map((veiculo) => {
                /* A chave é a mesma de `aggregateFuel`: sem categoria é
                   `SEM_CATEGORIA`, e não `truck`. */
                const media = mediaPorTipo.get(veiculo.type ?? SEM_CATEGORIA);
                /* ⚠️ 10% abaixo, o mesmo corte da tela de Custos. Eram 15% aqui,
                   e com dois cortes diferentes o mesmo veículo aparecia em âmbar
                   numa tela e normal na outra, no mesmo período. */
                const consumoRuim =
                  media != null &&
                  veiculo.fuelEfficiency != null &&
                  veiculo.fuelEfficiency < media * 0.9;

                /* Motor ligado parado só vira alerta em proporção: duas horas
                   num caminhão que rodou o mês é normal, num que rodou um dia
                   não é. */
                const paradoDemais =
                  veiculo.idleHours != null &&
                  veiculo.drivingHours != null &&
                  veiculo.drivingHours > 0 &&
                  veiculo.idleHours / veiculo.drivingHours > 0.5;

                return (
                  <tr key={veiculo.vehicleId} className="border-outline-variant/40 border-t">
                    <td className="py-2.5 pr-3">
                      <span className="tabular text-on-light font-medium">{veiculo.plate}</span>
                      <span className="text-on-light-muted text-label-md ml-2 normal-case">
                        {TIPO_LABEL[veiculo.type ?? ''] ?? 'veículo'}
                        {veiculo.unit ? ` · ${veiculo.unit}` : ''}
                      </span>
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {numero(veiculo.distanceKm)}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {veiculo.daysUsed}
                    </td>
                    <td
                      className={cn(
                        'tabular py-2.5 text-right',
                        consumoRuim ? 'text-error-on-light' : 'text-on-light-variant',
                      )}
                    >
                      {veiculo.fuelEfficiency == null
                        ? '–'
                        : `${numero(veiculo.fuelEfficiency, 1)} km/l`}
                    </td>
                    <td
                      className={cn(
                        'tabular py-2.5 text-right',
                        paradoDemais ? 'text-warning-on-light' : 'text-on-light-variant',
                      )}
                    >
                      {veiculo.idleHours == null ? '–' : `${numero(veiculo.idleHours, 1)} h`}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {numero(veiculo.eventsPer1000Km)}
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
        {parados > 0
          ? `${parados} ${parados === 1 ? 'veículo não rodou' : 'veículos não rodaram'} no período e ${parados === 1 ? 'ficou' : 'ficaram'} de fora. `
          : ''}
        Consumo é comparado contra a média do mesmo tipo: van e caminhão não competem no mesmo
        número.
      </p>
    </LightCard>
  );
}
