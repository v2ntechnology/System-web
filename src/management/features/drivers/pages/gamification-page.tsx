import {
  InfoIcon,
  MedalIcon,
  RouteIcon,
  SearchIcon,
  ShieldAlertIcon,
  UsersIcon,
} from '@/components/icons';
import type { Driver, RankingPeriod } from '@/management/types';
import { GlassInput, Pagination, SpectrumButton, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getDriverRanking, getDrivers } from '../api';
import { DriverPodium } from '../components/driver-podium';
import { MEDAL_COLOR, MEDAL_LABEL } from '../medals';

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
  const [busca, setBusca] = useState('');

  const { data, isPending, isError } = useQuery({ queryKey: ['drivers'], queryFn: getDrivers });

  /* O pódio vem de outra consulta, e de propósito: a classificação da tabela é
     a nota corrente dos últimos 30 dias, e o ranking sabe responder também pelo
     ano, com a média ponderada pelos quilômetros. */
  const ranking = useQuery({
    queryKey: ['driver-ranking', period],
    queryFn: () => getDriverRanking(period),
  });

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
  const kmDaEquipe = classificados.reduce((soma, driver) => soma + driver.kmDriven, 0);
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
      /* ⚠️ Era "Líder do período", que o pódio logo abaixo passou a dizer com
         nome, foto e medalha. Aqui entra o que o pódio NÃO diz: o tamanho da
         amostra que sustenta as notas. */
      key: 'km',
      label: 'Km no período',
      value: km.format(kmDaEquipe),
      hint: 'rodados por quem está classificado',
      icon: RouteIcon,
    },
    {
      key: 'media',
      label: 'Score médio',
      value: media,
      hint: 'a régua é a própria frota',
      icon: MedalIcon,
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

  /*
   * ⚠️ A busca RECORTA a lista, e não reordena: a posição continua sendo a da
   * classificação inteira. Renumerar o resultado da busca faria o motorista
   * procurado aparecer como "1º" numa reunião, que é exatamente o oposto do que
   * a tela existe para responder.
   */
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const comPosicao = classificados.map((driver, indice) => ({ driver, posicao: indice + 1 }));
  const filtrados =
    termo === ''
      ? comPosicao
      : comPosicao.filter((item) => item.driver.name.toLocaleLowerCase('pt-BR').includes(termo));

  /* A página é presa ao total durante o render, e não corrigida por efeito:
     buscar estando na página 3 deixaria a tabela vazia. */
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

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
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        {/* ⚠️ O pódio mora DENTRO do painel, e não num cartão de vidro sobre o
            papel: ele é o assunto da tela, e o painel é onde o assunto mora nas
            outras rotas. A ficha continua na tela de motoristas, então o cartão
            leva para lá em vez de repetir aqui os mesmos dados. */}
        <DriverPodium
          entries={ranking.data ?? []}
          period={period}
          onPeriodChange={setPeriod}
          onSelectDriver={() => navigate('/gestao/motoristas')}
          isPending={ranking.isPending}
          isError={ranking.isError}
        />

        <QueryState isPending={isPending} isError={isError} label="a classificação">
          <section className="border-light-outline mt-8 border-t pt-8">
            <h2 className="font-sora text-on-light text-headline-md mb-4 tracking-[-0.02em]">
              Classificação completa
            </h2>
            <p className="text-on-light-variant text-body-md mb-4 flex items-start gap-2">
              <InfoIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />A nota é relativa
              a esta frota: 100 é quem não gerou evento na configuração de telemetria daqui, e não
              direção perfeita. Serve para comparar a equipe entre si, nunca com outra
              transportadora.
            </p>

            {/* ⚠️ Os dois recortes não são o mesmo, e a tela diz qual é qual: a
                tabela é sempre a nota corrente dos últimos 30 dias, e o pódio
                acima segue o período escolhido. Sem esta linha, "no ano" no
                pódio e um primeiro lugar diferente na tabela pareceriam erro. */}
            <p className="text-on-light-muted text-label-md mb-4 normal-case">
              Ordenada pela nota corrente dos últimos 30 dias, com os quilômetros como desempate.
            </p>

            {/* ⚠️ `surface="light"`: o campo mora dentro do painel branco, e a
                versão escura dele inverte a hierarquia da tela. A busca serve à
                pergunta pontual ("em que posição está o Fulano?"), que numa lista
                de 81 nomes é rolagem cega sem ela. */}
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <GlassInput
                id="ranking-busca"
                surface="light"
                label="Buscar motorista"
                placeholder="Nome do motorista"
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value);
                  setPagina(1);
                }}
                leading={<SearchIcon size={16} aria-hidden="true" />}
                className="w-full sm:max-w-80"
              />

              {termo !== '' ? (
                <div className="flex flex-wrap items-center gap-3 pb-1.5">
                  <p className="text-on-light-muted text-label-md normal-case">
                    {filtrados.length === 1
                      ? '1 motorista encontrado'
                      : `${filtrados.length} de ${classificados.length} motoristas`}
                  </p>
                  <SpectrumButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBusca('');
                      setPagina(1);
                    }}
                  >
                    Limpar busca
                  </SpectrumButton>
                </div>
              ) : null}
            </div>

            {filtrados.length === 0 ? (
              <p className="text-on-light-variant text-body-md py-10 text-center">
                {classificados.length === 0
                  ? 'Ninguém tem nota no período ainda.'
                  : 'Nenhum motorista com esse nome na classificação.'}
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
                      {daPagina.map(({ driver, posicao }, indice) => {
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
                                {/* Medalha só nos três primeiros da classificação
                                    inteira: mais abaixo, o número da coluna da
                                    esquerda já diz a posição. */}
                                {posicao <= 3 ? (
                                  <MedalIcon
                                    size={15}
                                    aria-label={MEDAL_LABEL[posicao]}
                                    className={MEDAL_COLOR[posicao]}
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
                  total={filtrados.length}
                  pageSize={POR_PAGINA}
                  onPageChange={setPagina}
                  label="motoristas"
                />
              </>
            )}
          </section>
        </QueryState>
      </PageContent>
    </>
  );
}
