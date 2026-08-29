import { MedalIcon } from '@/components/icons';
import type { RankingPeriod } from '@/management/types';
import { Avatar, Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { getDriverRanking } from '../api';

const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const MEDAL: Record<number, { color: string; label: string }> = {
  1: { color: 'text-[#F4C430]', label: '1º lugar' },
  2: { color: 'text-[#C9CDD4]', label: '2º lugar' },
  3: { color: 'text-[#C97F3A]', label: '3º lugar' },
};

const PERIODS: { id: RankingPeriod; label: string }[] = [
  { id: 'MES', label: 'No mês' },
  { id: 'ANO', label: 'No ano' },
];

export interface DriverRankingCardProps {
  period: RankingPeriod;
  onPeriodChange: (period: RankingPeriod) => void;
  selectedDriverId?: string | null | undefined;
  onSelectDriver: (driverId: string) => void;
}

/**
 * Pódio de motoristas por score (RF-031).
 *
 * O alternador não é enfeite: no mês vale o score corrente, no ano a média
 * ponderada pelos km rodados. São recortes diferentes e o pódio muda — quem
 * dirigiu pouco e bem lidera o mês, não o ano.
 */
export function DriverRankingCard({
  period,
  onPeriodChange,
  selectedDriverId,
  onSelectDriver,
}: DriverRankingCardProps) {
  const { data, isPending } = useQuery({
    queryKey: ['driver-ranking', period],
    queryFn: () => getDriverRanking(period),
  });

  const max = Math.max(...(data?.map((entry) => entry.score) ?? [100]), 1);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-on-surface-variant text-body-md">Top motoristas por score</h3>

        <div
          role="group"
          aria-label="Período do ranking"
          className="bg-surface-lowest rounded-pill flex gap-1 p-1"
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
                  'rounded-pill text-label-md focus-visible:ring-secondary px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                  active
                    ? 'bg-primary-strong text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isPending || !data ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <Spinner className="text-on-surface-muted size-5" label="Carregando o ranking" />
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.map((entry) => {
            const medal = MEDAL[entry.position];
            const active = entry.driverId === selectedDriverId;

            return (
              <li key={entry.driverId}>
                <button
                  type="button"
                  onClick={() => onSelectDriver(entry.driverId)}
                  aria-label={`${entry.position}º — ${entry.name}, score ${entry.score}`}
                  className={cn(
                    'focus-visible:ring-secondary flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                    active ? 'bg-on-surface/8' : 'hover:bg-on-surface/5',
                  )}
                >
                  <span className="tabular text-on-surface-muted text-label-md w-4 shrink-0 normal-case">
                    {entry.position}
                  </span>

                  <Avatar src={entry.avatarUrl} name={entry.name} className="size-9" />

                  <span className="min-w-0 flex-1">
                    <span className="text-on-surface block truncate">{entry.name}</span>
                    <span
                      aria-hidden="true"
                      className="bg-surface-high rounded-pill mt-1.5 block h-1.5"
                    >
                      <span
                        className={cn(
                          'rounded-pill block h-full',
                          active ? 'bg-primary' : 'bg-outline',
                        )}
                        style={{ width: `${(entry.score / max) * 100}%` }}
                      />
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-right">
                      <span className="tabular text-on-surface block font-semibold">
                        {entry.score.toLocaleString('pt-BR')}
                      </span>
                      {/* `on-surface-variant`: o item destacado tem fundo mais claro
                          (#3D3D3D) e o muted cai para 3.9:1 ali. */}
                      <span className="tabular text-on-surface-variant text-label-sm block normal-case">
                        {km.format(entry.kmDriven)} km
                      </span>
                    </span>
                    {medal ? (
                      <MedalIcon size={22} className={medal.color} aria-label={medal.label} />
                    ) : (
                      <span className="w-5.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
