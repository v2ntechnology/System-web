import { RoadHorizonIcon, TruckIcon, WarningIcon, WrenchIcon } from '@phosphor-icons/react';
import type { HubMetric } from '@/management/types';
import { LightCard, StatTile } from '@/management/ui';
import type { ComponentType } from 'react';

export interface HubOverviewCardProps {
  metrics: HubMetric[];
  className?: string | undefined;
}

const ICONS: Record<HubMetric['icon'], ComponentType<{ size?: number; weight?: 'duotone' }>> = {
  truck: TruckIcon,
  wrench: WrenchIcon,
  route: RoadHorizonIcon,
  warning: WarningIcon,
};

/** Indicadores do hub em grade 2×2 (Figma). */
export function HubOverviewCard({ metrics, className }: HubOverviewCardProps) {
  return (
    <LightCard title="Hub geral" className={className}>
      {/* auto-rows-fr: os quatro blocos dividem a altura do card em partes iguais. */}
      <div className="grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = ICONS[metric.icon];
          return (
            <StatTile
              key={metric.id}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              accent={metric.accent}
              icon={<Icon size={20} weight="duotone" />}
            />
          );
        })}
      </div>
    </LightCard>
  );
}
