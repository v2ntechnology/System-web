import { InfoIcon, MedalIcon, RouteIcon, ShieldAlertIcon, UsersIcon } from '@/components/icons';
import type { Driver, RankingPeriod } from '@/management/types';
import { GlassCard, LightCard, Pagination, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getDrivers } from '../api';
import { DriverRankingCard } from '../components/driver-ranking-card';

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Cinquenta por página, como nas outras listas longas do painel. */
const POR_PAGINA = 50;

/** Só entra na classificação quem tem nota: sem nota não há posição. */
const comNota = (driver: Driver): driver is Driver & { score: number } => driver.score != null;

/**
 * Gamificação da condução (`/gestao/gamificacao`).
 *
 * Saiu de dentro da tela de motoristas em 01/09/2026, a pedido do usuário. Lá o
 * pódio dividia espaço com a ficha individual, que é outra pergunta: "como este
 * motorista dirige" não é "quem está ganhando".
 *
 * ⚠️ A nota é **relativa à própria frota**. Cada cliente configura eventos
 * diferentes na telemetria, então 100 não significa direção perfeita, significa
 * "não gerou evento nesta configuração". A tela diz isso na cara, porque um
 * ranking sem essa ressalva vira comparação entre transportadoras diferentes.
 */
export function GamificationPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<RankingPeriod>('MES');
  const [pagina, setPagina] = useState(1);

  const { data, isPending, isError } = useQuery({ queryKey: ['drivers'], queryFn: getDrivers });

  const drivers = data ?? [];
  const classificados = drivers
    .filter(comNota)
    .sort((a, b) => b.score - a.score || b.kmDriven - a.kmDriven);

  const semNota = drivers.length - classificados.length;
  const media =
    classificados.length > 0
      ? Math.round(
          classificados.reduce((soma, driver) => soma + driver.score, 0) / classificados.length,
        )
      : 0;
  const lider = classificados[0];
  const eventos = drivers.reduce((soma, driver) => soma + driver.criticalEvents, 0);

  const stats: HeroStat[] = [
    {
      key: 'classificados',
      label: 'Na classificação',
      value: classificados.length,
      hint:
        semNota === 0
          ? 'motoristas com nota no período'
          : `${semNota} sem nota: rodaram pouco no período`,
      icon: UsersIcon,
    },
    {
      key: 'lider',
      label: 'Líder do período',
      value: lider?.score ?? '–',
      hint: lider?.name ?? 'ninguém com nota ainda',
      icon: MedalIcon,
    },
    {
      key: 'media',
      label: 'Score médio',
      value: media,
      hint: 'a régua é a própria frota',
      icon: RouteIcon,
    },
    {
      key: 'eventos',
      label: 'Eventos críticos',
      value: eventos,
      hint: 'somados no período',
      icon: ShieldAlertIcon,
      tone: eventos > 0 ? 'warn' : 'neutral',
    },
  ];

  const totalPaginas = Math.max(1, Math.ceil(classificados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = classificados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <>
      <HeroBand
        title="Gamificação"
        description="Quem está dirigindo melhor no mês e no ano, pelo score de condução da telemetria."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo da disputa</h2>

        {/* A subida fica nos cards, e não na seção: em volta do `QueryState` ela
            jogaria o carregamento e o erro por cima da faixa colorida. */}
        <QueryState isPending={isPending} isError={isError} label="a classificação">
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />
        </QueryState>

        {/* O pódio traz o próprio seletor de período: no mês vale o score
            corrente, no ano a média ponderada pelos km. */}
        <GlassCard className="mt-5 flex p-5 sm:p-6">
          <DriverRankingCard
            period={period}
            onPeriodChange={setPeriod}
            /* A ficha mora na tela de motoristas: o pódio leva para lá em vez
               de repetir aqui os mesmos dados. */
            onSelectDriver={() => navigate('/gestao/motoristas')}
          />
        </GlassCard>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState isPending={isPending} isError={isError} label="a classificação">
          <LightCard title="Classificação completa">
            <p className="text-on-light-variant text-body-md mb-4 flex items-start gap-2">
              <InfoIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />A nota é relativa
              a esta frota: 100 é quem não gerou evento na configuração de telemetria daqui, e não
              direção perfeita. Serve para comparar a equipe entre si, nunca com outra
              transportadora.
            </p>

            {classificados.length === 0 ? (
              <p className="text-on-light-variant text-body-md py-10 text-center">
                Ninguém tem nota no período ainda.
              </p>
            ) : (
              <>
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="min-w-160 w-full border-collapse text-left">
                    <caption className="sr-only">
                      Classificação dos motoristas por score de condução
                    </caption>

                    <thead>
                      <tr className="border-light-outline text-on-light-variant text-label-md border-b">
                        <th scope="col" className="py-2.5 pl-3 pr-4 font-medium">
                          #
                        </th>
                        <th scope="col" className="py-2.5 pr-4 font-medium">
                          Motorista
                        </th>
                        <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                          Score
                        </th>
                        <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                          Km rodados
                        </th>
                        <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                          Viagens
                        </th>
                        <th scope="col" className="py-2.5 pr-3 text-right font-medium">
                          Eventos críticos
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {daPagina.map((driver, indice) => {
                        const posicao = (paginaAtual - 1) * POR_PAGINA + indice + 1;

                        return (
                          <tr
                            key={driver.id}
                            className={cn(
                              'hover:bg-primary-on-light/[0.07] transition-colors',
                              indice % 2 === 1 && 'bg-light-stripe',
                            )}
                          >
                            <td className="tabular text-on-light-muted py-2.5 pl-3 pr-4">
                              {posicao}
                            </td>

                            <td className="text-on-light text-body-md py-2.5 pr-4">
                              <span className="flex flex-wrap items-center gap-2">
                                {driver.name}
                                {/* Medalha só no pódio da página um: em outra
                                    página, "1º" já é a coluna da esquerda. */}
                                {posicao <= 3 ? (
                                  <MedalIcon
                                    size={15}
                                    aria-label={`${posicao}º lugar`}
                                    className={cn(
                                      posicao === 1
                                        ? 'text-[#B8860B]'
                                        : posicao === 2
                                          ? 'text-on-light-muted'
                                          : 'text-[#A0522D]',
                                    )}
                                  />
                                ) : null}
                                {driver.status === 'AFASTADO' ? (
                                  <StatusChip surface="light">Afastado</StatusChip>
                                ) : null}
                              </span>
                            </td>

                            <td className="tabular font-sora text-on-light py-2.5 pr-4 text-right font-bold">
                              {driver.score}
                            </td>

                            <td className="tabular text-on-light-variant py-2.5 pr-4 text-right">
                              {km.format(driver.kmDriven)}
                            </td>

                            <td className="tabular text-on-light-variant py-2.5 pr-4 text-right">
                              {driver.tripsCount}
                            </td>

                            <td
                              className={cn(
                                'tabular py-2.5 pr-3 text-right',
                                driver.criticalEvents > 0
                                  ? 'text-warning-on-light font-medium'
                                  : 'text-on-light-variant',
                              )}
                            >
                              {driver.criticalEvents}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  className="mt-5"
                  page={paginaAtual}
                  total={classificados.length}
                  pageSize={POR_PAGINA}
                  onPageChange={setPagina}
                  label="motoristas"
                />
              </>
            )}
          </LightCard>
        </QueryState>
      </PageContent>
    </>
  );
}
