import { InfoIcon } from '@/components/icons';
import type { VehiclePerformance } from '@/management/lib/fleet-api';
import { LightCard, cn } from '@/management/ui';

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
  /* Média de consumo por TIPO. Ver a nota do componente. */
  const mediaPorTipo = new Map<string, number>();
  const soma = new Map<string, { total: number; quantos: number }>();
  for (const veiculo of vehicles) {
    if (veiculo.fuelEfficiency == null) continue;
    const tipo = veiculo.type ?? 'truck';
    const atual = soma.get(tipo) ?? { total: 0, quantos: 0 };
    soma.set(tipo, { total: atual.total + veiculo.fuelEfficiency, quantos: atual.quantos + 1 });
  }
  for (const [tipo, { total, quantos }] of soma) {
    if (quantos >= 2) mediaPorTipo.set(tipo, total / quantos);
  }

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
                const media = mediaPorTipo.get(veiculo.type ?? 'truck');
                const consumoRuim =
                  media != null &&
                  veiculo.fuelEfficiency != null &&
                  veiculo.fuelEfficiency < media * 0.85;

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
