import { MedalIcon } from '@/components/icons';
import type { DriverRankEntry, RankingPeriod } from '@/management/types';
import { Avatar, Spinner, StatusChip, cn } from '@/management/ui';

import { MEDAL_COLOR, MEDAL_LABEL, MEDAL_RING } from '../medals';

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const PERIODS: { id: RankingPeriod; label: string }[] = [
  { id: 'MES', label: 'No mês' },
  { id: 'ANO', label: 'No ano' },
];

/**
 * O pódio: os três primeiros, e só eles.
 *
 * <h2>⚠️ Por que três, e não dez (08/09/2026)</h2>
 *
 * A tela abria com uma lista de dez nomes com barrinha, e logo abaixo a
 * classificação completa repetia os mesmos dez com mais colunas. Duas listas
 * dizendo a mesma coisa, e nenhuma delas era um pódio: em disputa, o primeiro
 * lugar precisa PARECER primeiro lugar, e numa lista ele é só a linha de cima.
 *
 * Aqui os três viram cartão, o campeão é maior, mais alto e o único com o anel
 * dourado. Do quarto em diante quem responde é a tabela, que é onde a disputa
 * vira dado comparável.
 *
 * <h2>A ordem visual não é a ordem do documento</h2>
 *
 * No monitor os cartões aparecem 2º, 1º, 3º, que é como um pódio se desenha. A
 * `<ol>` continua em 1, 2, 3, e quem reordena é o `order-*`: leitor de tela e
 * teclado seguem a classificação, não o desenho. No celular a coluna única cai
 * na ordem natural, porque pódio empilhado não é pódio.
 *
 * <h2>O alternador não é enfeite</h2>
 *
 * No mês vale o score corrente, no ano a média ponderada pelos km rodados. São
 * recortes diferentes e o pódio muda: quem dirigiu pouco e bem lidera o mês, e
 * não o ano.
 */
export function DriverPodium({
  entries,
  period,
  onPeriodChange,
  onSelectDriver,
  isPending,
  isError,
}: {
  entries: DriverRankEntry[];
  period: RankingPeriod;
  onPeriodChange: (period: RankingPeriod) => void;
  onSelectDriver: (driverId: string) => void;
  isPending: boolean;
  isError: boolean;
}) {
  const podio = entries.slice(0, 3);

  /* O campeão fica no meio e sobe; os outros dois ladeiam. `order` no desktop,
     ordem natural no celular. */
  const LUGAR: Record<number, string> = {
    1: 'sm:order-2 sm:-mt-4',
    2: 'sm:order-1 sm:mt-6',
    3: 'sm:order-3 sm:mt-6',
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
          Pódio {period === 'MES' ? 'do mês' : 'do ano'}
        </h2>

        {/* ⚠️ Desenho do `PageTabs`, na família `light` porque aqui é dentro do
            painel branco: os dois são o mesmo objeto, um segmentado que recorta
            o que está logo abaixo. O escolhido é a pastilha CLARA que sobe do
            poço, e não a pastilha laranja cheia: com a navegação em terracota,
            uma pastilha terracota diria com a mesma cor "onde você está no
            sistema" e "que recorte desta tela você olha". */}
        <div
          role="group"
          aria-label="Período do ranking"
          className="bg-light-container rounded-pill flex w-fit max-w-full gap-1 overflow-x-auto p-1.5"
        >
          {PERIODS.map((option) => {
            const active = period === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onPeriodChange(option.id)}
                className={cn(
                  'text-body-md rounded-pill focus-visible:ring-primary shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
                  active
                    ? 'bg-light text-accent font-medium shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)]'
                    : 'text-on-light-variant hover:bg-on-light/[0.06] hover:text-on-light',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-14">
          <Spinner className="text-on-light-muted size-5" label="Carregando o pódio" />
        </div>
      ) : isError ? (
        /* O pódio falha sozinho: a classificação abaixo vem de outra consulta e
           continua servindo, então derrubar a tela inteira seria perder o que
           ainda funciona. */
        <p className="text-error-on-light text-body-md py-10 text-center">
          Não foi possível carregar o pódio.
        </p>
      ) : podio.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">
          Ninguém tem nota neste período ainda.
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-3 sm:items-end">
          {podio.map((entry) => {
            const posicao = entry.position;

            return (
              <li key={entry.driverId} className={cn('min-w-0', LUGAR[posicao])}>
                <button
                  type="button"
                  onClick={() => onSelectDriver(entry.driverId)}
                  aria-label={`${posicao}º lugar, ${entry.name}, score ${entry.score}`}
                  className={cn(
                    'bg-light-container flex w-full flex-col items-center rounded-xl px-4 text-center ring-1 transition-colors',
                    'focus-visible:ring-primary hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2',
                    MEDAL_RING[posicao],
                    /* O campeão é o cartão alto: em disputa, a diferença de
                       tamanho é lida antes do número. */
                    posicao === 1 ? 'py-7' : 'py-5',
                  )}
                >
                  <MedalIcon
                    size={posicao === 1 ? 30 : 24}
                    className={MEDAL_COLOR[posicao]}
                    aria-label={MEDAL_LABEL[posicao]}
                  />

                  <Avatar
                    src={entry.avatarUrl}
                    name={entry.name}
                    className={cn('mt-3', posicao === 1 ? 'size-16' : 'size-12')}
                  />

                  <p
                    className={cn(
                      'text-on-light mt-3 w-full truncate font-medium',
                      posicao === 1 && 'text-body-lg',
                    )}
                  >
                    {entry.name}
                  </p>

                  <p
                    className={cn(
                      'tabular font-sora text-on-light mt-2 font-bold leading-none',
                      posicao === 1 ? 'text-[40px]' : 'text-[30px]',
                    )}
                  >
                    {entry.score.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-on-light-muted text-label-sm mt-1 normal-case">score</p>

                  <p className="tabular text-on-light-variant text-label-md mt-3 normal-case">
                    {km.format(entry.kmDriven)} km no período
                  </p>

                  {/* ⚠️ O quilômetro não é enfeite ao lado do score: é o
                      desempate da classificação e o peso do recorte do ano. Sem
                      ele, dois 100 no pódio pareceriam empate. */}
                  {posicao === 1 ? (
                    <StatusChip tone="attention" surface="light" className="mt-3">
                      Líder do período
                    </StatusChip>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
