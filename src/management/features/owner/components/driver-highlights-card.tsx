import { MedalIcon, SealCheckIcon } from '@phosphor-icons/react';
import type { DriverHighlight, RankingPeriod } from '@/management/types';
import { Avatar, LightCard, cn } from '@/management/ui';

import { km, percent } from '@/management/lib/format';

/** Tons escurecidos: o ouro vivo do pódio escuro dá ~1,8:1 sobre o painel claro. */
const MEDAL: Record<number, { color: string; label: string }> = {
  1: { color: 'text-[#B8860B]', label: '1º lugar' },
  2: { color: 'text-[#6E7480]', label: '2º lugar' },
  3: { color: 'text-[#8A5A2B]', label: '3º lugar' },
};

const PERIODS: { id: RankingPeriod; label: string }[] = [
  { id: 'MES', label: 'No mês' },
  { id: 'ANO', label: 'No ano' },
];

export interface DriverHighlightsCardProps {
  highlights: DriverHighlight[];
  period: RankingPeriod;
  onPeriodChange: (period: RankingPeriod) => void;
  className?: string | undefined;
}

/**
 * Destaques de motorista (gamificação, RF-031).
 *
 * O alternador não é enfeite: no mês vale o score corrente, no ano a média
 * ponderada pelos km rodados. São recortes diferentes e o pódio muda — quem
 * dirigiu pouco e bem lidera o mês, não o ano.
 *
 * As conquistas vêm nomeadas do backend para que o dono premie lendo a lista, em
 * vez de cruzar score com quilometragem numa planilha.
 */
export function DriverHighlightsCard({
  highlights,
  period,
  onPeriodChange,
  className,
}: DriverHighlightsCardProps) {
  return (
    <LightCard
      title="Destaques do time"
      className={className}
      action={
        <div
          role="group"
          aria-label="Período do ranking"
          className="bg-light-container border-light-outline rounded-pill flex gap-1 border p-1"
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
                  'rounded-pill text-label-md focus-visible:ring-primary-on-light px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                  active
                    ? 'bg-primary-strong text-on-primary'
                    : 'text-on-light-variant hover:text-on-light',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      }
    >
      <ol className="flex flex-col gap-3">
        {highlights.map((driver) => {
          const medal = MEDAL[driver.position];

          return (
            <li key={driver.driverId} className="bg-light-container rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="tabular text-on-light-muted text-label-md w-4 shrink-0 normal-case">
                  {driver.position}
                </span>

                <Avatar src={driver.avatarUrl} name={driver.name} className="size-10" />

                <div className="min-w-0 flex-1">
                  <p className="text-on-light truncate font-semibold">{driver.name}</p>
                  <p className="tabular text-on-light-muted text-label-md normal-case">
                    {km.format(driver.kmDriven)} km ·{' '}
                    {driver.fuelEfficiency.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}{' '}
                    km/l · {percent(driver.onTimeDeliveryRate, 0)} no prazo
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-right">
                    <span className="tabular text-on-light block font-semibold">
                      {driver.score}
                    </span>
                    <span
                      className={cn(
                        'tabular text-label-sm block normal-case',
                        driver.scoreDelta === 0
                          ? 'text-on-light-muted'
                          : driver.scoreDelta > 0
                            ? 'text-success-on-light'
                            : 'text-error-on-light',
                      )}
                    >
                      {driver.scoreDelta > 0 ? '+' : ''}
                      {driver.scoreDelta} pts
                    </span>
                  </span>

                  {medal ? (
                    <MedalIcon
                      size={24}
                      weight="fill"
                      className={medal.color}
                      aria-label={medal.label}
                    />
                  ) : (
                    <span className="w-6" aria-hidden="true" />
                  )}
                </div>
              </div>

              {driver.badges.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {driver.badges.map((badge) => (
                    <li
                      key={badge}
                      className="rounded-pill text-label-md bg-success-on-light/12 text-success-on-light inline-flex items-center gap-1.5 px-2.5 py-1 normal-case"
                    >
                      <SealCheckIcon size={14} weight="fill" aria-hidden="true" />
                      {badge}
                    </li>
                  ))}
                </ul>
              ) : driver.criticalEvents > 0 ? (
                <p className="text-on-light-variant text-label-md mt-3 normal-case">
                  {driver.criticalEvents === 1
                    ? '1 evento crítico no período — sem conquistas.'
                    : `${driver.criticalEvents} eventos críticos no período — sem conquistas.`}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="text-on-light-muted text-label-md mt-auto pt-5 normal-case">
        {period === 'MES'
          ? 'Score de segurança do mês corrente.'
          : 'Média do score ponderada pelos quilômetros rodados no ano.'}
      </p>
    </LightCard>
  );
}
