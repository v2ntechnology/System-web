import { useQuery } from '@tanstack/react-query';

import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getFleetOverview } from '../api';
import { BlockersSummaryCard } from '../components/blockers-summary-card';
import { DecisionsCard } from '../components/decisions-card';
import { FleetStateCards } from '../components/fleet-state-cards';
import { OperationMapCard } from '../components/operation-map-card';
import { OverviewHero } from '../components/overview-hero';
import { SafetySummaryCard } from '../components/safety-summary-card';
import { TripsSummaryCard } from '../components/trips-summary-card';

/**
 * Visão geral do gestor: a home de `/gestao` para quem opera.
 *
 * ⚠️ Substituiu a home anterior em 01/09/2026, e a antiga foi apagada junto com
 * os quatro blocos que só existiam nela. O motivo está no `memoria.md`.
 *
 * A tela responde a uma pergunta: quantos caminhões podem rodar hoje e o que
 * está impedindo os outros. **Sem nenhum valor em reais**: resultado financeiro
 * é do painel do proprietário.
 *
 * A ordem das faixas é a da decisão, e o peso visual acompanha: o estado da
 * frota é contexto e vem em cards baixos encostados na faixa; os impedimentos
 * são o trabalho do dia e ocupam a coluna larga; o mapa de consulta rápida e as
 * viagens em curso ficam na coluna estreita, à direita.
 *
 * As faixas 2 e 3 mostram **só os números**. A lista de cada assunto mora na
 * tela dele, alcançada pelo botão do card: a visão geral responde "quanto", e
 * não "qual placa".
 */
export function OverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['overview', 'fleet'],
    queryFn: getFleetOverview,
  });

  return (
    <>
      <OverviewHero />

      <PageContent>
        <QueryState isPending={isPending} isError={isError} label="a visão geral da operação">
          {data ? (
            <>
              {/* Os cards de estado sobem por cima da borda do indigo: o número
                  encosta na saudação em vez de abrir uma seção nova. A subida
                  fica aqui, e não em volta do `QueryState`, senão o carregamento
                  e o erro apareceriam por cima da faixa colorida. */}
              <div className="-mt-16 sm:-mt-20">
                <FleetStateCards summary={data.fleet} drivers={data.drivers} />
              </div>

              {/* RN-121: o número vem com a procedência colada nele. */}
              <p className="text-on-surface-muted text-label-sm mt-3 normal-case">{data.source}</p>

              {/*
               * Duas colunas no monitor, e a maior fica com os impedimentos:
               * eles são o trabalho do dia. À direita fica a consulta rápida,
               * mapa e viagens, que é o que se olha de relance.
               */}
              <div className="mt-8 grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
                {/* Segurança fica logo abaixo dos impedimentos, na mesma
                    coluna: é a mesma decisão do dia. Um caminhão liberado com um
                    motorista em sonolência é liberação errada. */}
                <div className="flex min-w-0 flex-col gap-5">
                  {/* Antes dos impedimentos: o que a plataforma detectou pode
                      esperar a leitura da tela; o que espera decisão sua já está
                      com um caminhão parado no pátio. */}
                  <DecisionsCard decisions={data.decisions} />
                  <BlockersSummaryCard blockers={data.blockers} />
                  <SafetySummaryCard safety={data.safety} />
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                  <OperationMapCard trips={data.trips} />
                  <TripsSummaryCard trips={data.trips} />
                </div>
              </div>
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}
