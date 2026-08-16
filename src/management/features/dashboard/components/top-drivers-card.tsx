import { MedalIcon } from '@phosphor-icons/react';
import type { DriverRanking } from '@/management/types';
import { Avatar, LightCard, cn } from '@/management/ui';

export interface TopDriversCardProps {
  drivers: DriverRanking[];
  className?: string | undefined;
}

/** Ouro, prata e bronze. Fora do pódio, o indicador some. */
const MEDAL_STYLES: Record<number, { color: string; label: string }> = {
  1: { color: 'text-[#F4C430]', label: '1º lugar' },
  2: { color: 'text-[#C9CDD4]', label: '2º lugar' },
  3: { color: 'text-[#C97F3A]', label: '3º lugar' },
};

/**
 * Pódio de motoristas por score de segurança (RF-031).
 *
 * A posição nunca é comunicada só pela cor da medalha: o número do score e o
 * `aria-label` do ícone carregam a mesma informação.
 */
export function TopDriversCard({ drivers, className }: TopDriversCardProps) {
  return (
    <LightCard title="Top motoristas" className={className}>
      <ol className="flex flex-col gap-3">
        {drivers.map((driver) => {
          const medal = MEDAL_STYLES[driver.position];

          return (
            <li
              key={driver.id}
              className="bg-surface-lowest flex items-center gap-3 rounded-lg p-3"
            >
              <Avatar src={driver.avatarUrl} name={driver.name} />

              <div className="min-w-0 flex-1">
                <p className="text-on-surface truncate font-semibold">{driver.name}</p>
                <p className="text-on-surface-muted text-label-md normal-case">{driver.role}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular text-on-surface-variant text-label-md">
                  {driver.score}
                </span>
                {medal ? (
                  <MedalIcon
                    size={28}
                    weight="fill"
                    className={cn(medal.color)}
                    aria-label={medal.label}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-on-light-muted text-label-md mt-auto pt-4 normal-case">
        Ordenado por score de segurança dos últimos 30 dias.
      </p>
    </LightCard>
  );
}
