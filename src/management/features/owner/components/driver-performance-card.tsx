import { InfoIcon, TrendDownIcon, TrendUpIcon } from '@/components/icons';
import type { Driver } from '@/management/types';
import { LightCard, cn } from '@/management/ui';

/**
 * Ranking de condução com o que a telemetria mede.
 *
 * <h2>A nota é relativa à PRÓPRIA frota</h2>
 *
 * ⚠️ Cada cliente configura eventos diferentes com limiares diferentes. Nesta
 * frota o evento de uso de freio dispara às centenas por mil quilômetros; com a
 * configuração padrão do fornecedor seriam dois. Uma nota absoluta daria zero
 * para a frota inteira aqui e cem para a frota inteira lá, e não diria nada
 * sobre condução em nenhum dos dois casos.
 *
 * Por isso 75 é a média da própria frota. O que a nota responde é "quem dirige
 * melhor que a média dos meus", que é a pergunta que o dono faz na hora de
 * premiar.
 *
 * <h2>O que NÃO está aqui</h2>
 *
 * Não há entrega no prazo nem bônus pago: os dois dependem de viagem de frete e
 * de folha, que não existem no sistema. Preencher com número plausível seria
 * pior que a coluna ausente, porque premiação é dinheiro.
 */

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export interface DriverPerformanceCardProps {
  drivers: Driver[];
  periodLabel: string;
  className?: string | undefined;
}

export function DriverPerformanceCard({
  drivers,
  periodLabel,
  className,
}: DriverPerformanceCardProps) {
  /* Sem nota não entra no ranking: quem não rodou o suficiente no período não
     tem base de comparação, e um zero ao lado de gente que dirigiu de verdade
     leria como o pior motorista da empresa. */
  const comNota = drivers
    .filter((motorista) => motorista.score != null && motorista.kmDriven > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const semNota = drivers.length - comNota.length;

  /* ⚠️ Coluna inteira zerada de evento grave NÃO significa frota exemplar.
     Sonolência, distração e colisão só existem em frota com câmera e sensor de
     fadiga; sem eles a coluna nunca sai do zero. Dizer isso é a diferença entre
     uma boa notícia e uma cegueira. */
  const nenhumGrave = comNota.every((motorista) => motorista.criticalEvents === 0);

  return (
    <LightCard
      title="Quem dirige melhor"
      className={className}
      action={<span className="text-on-light-muted text-label-md normal-case">{periodLabel}</span>}
    >
      {comNota.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-6 text-center">
          Nenhum motorista rodou o suficiente no período para ter nota.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-on-light-muted text-label-md normal-case">
                <th scope="col" className="py-2 text-left font-normal">
                  #
                </th>
                <th scope="col" className="py-2 text-left font-normal">
                  Motorista
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Nota
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Km rodados
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Trechos
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Eventos graves
                </th>
              </tr>
            </thead>

            <tbody>
              {comNota.map((motorista, indice) => {
                const nota = motorista.score ?? 0;
                const variacao = motorista.scoreDelta;

                return (
                  <tr key={motorista.id} className="border-outline-variant/40 border-t">
                    <td className="tabular text-on-light-muted py-2.5 pr-2">{indice + 1}</td>

                    <td className="py-2.5 pr-3">
                      <span className="text-on-light block truncate">{motorista.name}</span>
                      {motorista.unit ? (
                        <span className="text-on-light-muted text-label-md normal-case">
                          {motorista.unit}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-2.5 text-right">
                      <span
                        className={cn(
                          'tabular font-semibold',
                          nota >= 85
                            ? 'text-success-on-light'
                            : nota < 60
                              ? 'text-error-on-light'
                              : 'text-on-light',
                        )}
                      >
                        {nota}
                      </span>
                      {/* Sem período anterior o delta é ausente, e não zero:
                          "0" leria como "não mudou", que é outra afirmação. */}
                      {variacao != null && variacao !== 0 ? (
                        <span
                          className={cn(
                            'text-label-md ml-1.5 inline-flex items-center gap-0.5 normal-case',
                            variacao > 0 ? 'text-success-on-light' : 'text-error-on-light',
                          )}
                        >
                          {variacao > 0 ? (
                            <TrendUpIcon size={12} aria-hidden="true" />
                          ) : (
                            <TrendDownIcon size={12} aria-hidden="true" />
                          )}
                          {Math.abs(variacao)}
                        </span>
                      ) : null}
                    </td>

                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {numero(motorista.kmDriven)}
                    </td>
                    <td className="tabular text-on-light-variant py-2.5 text-right">
                      {motorista.tripsCount}
                    </td>
                    <td
                      className={cn(
                        'tabular py-2.5 text-right',
                        motorista.criticalEvents > 0
                          ? 'text-error-on-light'
                          : 'text-on-light-variant',
                      )}
                    >
                      {motorista.criticalEvents}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-on-light-muted text-label-md mt-4 flex items-start gap-1.5 normal-case">
        <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A nota é relativa à
        própria frota: 75 é a média dela. Cada empresa configura eventos diferentes na telemetria,
        então nota absoluta não compararia nada.
        {semNota > 0
          ? ` ${semNota} ${semNota === 1 ? 'motorista não rodou' : 'motoristas não rodaram'} o suficiente no período e ${semNota === 1 ? 'ficou' : 'ficaram'} de fora.`
          : ''}
        {nenhumGrave && comNota.length > 0
          ? ' Evento grave zerado em todo mundo significa que nenhum equipamento desta frota gera sonolência, distração ou colisão, e não que ninguém teve.'
          : ''}
      </p>
    </LightCard>
  );
}
