import {
  CheckCircleIcon,
  MaintenanceIcon,
  ParkingIcon,
  RadarIcon,
  RouteIcon,
  SteeringWheelIcon,
  TruckIcon,
  type IconType,
} from '@/components/icons';
import { cn } from '@/management/ui';

import type { DriverSummary, FleetSummary } from '../types';

type Accent = 'indigo' | 'cyan' | 'green' | 'amber';

/* Tokens `on-light`: os cards são placas claras, e os semânticos da marca são
   claros demais para o papel. */
const ACCENT: Record<Accent, string> = {
  indigo: 'bg-primary-on-light/10 text-primary-on-light',
  cyan: 'bg-info-on-light/10 text-info-on-light',
  green: 'bg-success-on-light/10 text-success-on-light',
  amber: 'bg-warning-on-light/12 text-warning-on-light',
};

interface StateCardProps {
  label: string;
  value: number;
  icon: IconType;
  accent: Accent;
  /** Denominador. Fora do card do total, é sempre a frota inteira. */
  outOf?: number | undefined;
  /**
   * `warn` pinta o número; `alert` pinta e contorna o card.
   *
   * O contorno é só da perda de visibilidade, que é o único estado que não é um
   * estado da operação: é a parte da frota sobre a qual não se sabe nada.
   */
  tone?: 'neutral' | 'warn' | 'alert' | undefined;
}

function StateCard({ label, value, icon: Icon, accent, outOf, tone = 'neutral' }: StateCardProps) {
  return (
    <div
      className={cn(
        'bg-light min-w-0 rounded-xl p-5 ring-1',
        'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
        tone === 'alert' ? 'ring-warning-on-light/35' : 'ring-light-edge',
      )}
    >
      <span
        className={cn('flex size-9 items-center justify-center rounded-md', ACCENT[accent])}
        aria-hidden="true"
      >
        <Icon size={17} />
      </span>

      <p className="text-on-light-variant text-label-sm mt-4 normal-case">{label}</p>

      <p
        className={cn(
          'tabular font-sora mt-1 text-[30px] font-bold leading-none',
          tone === 'neutral' ? 'text-on-light' : 'text-warning-on-light',
        )}
      >
        {value}
        {outOf ? (
          <span className="text-on-light-muted text-body-md font-normal"> / {outOf}</span>
        ) : null}
      </p>
    </div>
  );
}

/** Uma célula da barra de motoristas. */
function DriverStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warn' | undefined;
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          'tabular font-sora text-[22px] font-bold leading-none',
          tone === 'warn' ? 'text-warning-on-light' : 'text-on-light',
        )}
      >
        {value}
      </p>
      <p className="text-on-light-variant text-label-sm mt-1.5 normal-case">{label}</p>
    </div>
  );
}

/**
 * Faixa 1: estado da frota, em cards que encostam na faixa indigo.
 *
 * Contexto, e não ação: por isso não há botão nenhum aqui. Os cinco estados são
 * exclusivos e cada um traz o denominador da frota ao lado, que é o que permite
 * conferir a conta a olho sem somar os cards.
 *
 * ⚠️ "Parado" e "sem sinal" são cards diferentes de propósito. Somados, o gestor
 * vai procurar na oficina um caminhão que pode estar rodando com o rastreador
 * mudo.
 *
 * A linha de motoristas fecha a faixa: caminhão disponível sem motorista não sai
 * do pátio, e os dois números só respondem à pergunta do dia quando estão juntos.
 */
export function FleetStateCards({
  summary,
  drivers,
}: {
  summary: FleetSummary;
  drivers: DriverSummary;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StateCard label="Frota total" value={summary.total} icon={TruckIcon} accent="indigo" />
        <StateCard
          label="Disponíveis"
          value={summary.available}
          outOf={summary.total}
          icon={CheckCircleIcon}
          accent="green"
        />
        <StateCard
          label="Em viagem"
          value={summary.onTrip}
          outOf={summary.total}
          icon={RouteIcon}
          accent="cyan"
        />
        <StateCard
          label="Em manutenção"
          value={summary.inMaintenance}
          outOf={summary.total}
          icon={MaintenanceIcon}
          accent="indigo"
        />
        <StateCard
          label="Parados"
          value={summary.idle}
          outOf={summary.total}
          icon={ParkingIcon}
          accent="amber"
          tone="warn"
        />
        <StateCard
          label="Sem sinal"
          value={summary.noSignal}
          outOf={summary.total}
          icon={RadarIcon}
          accent="amber"
          tone="alert"
        />
      </div>

      {/*
       * Barra própria, e não mais uma linha de texto solta abaixo dos cards: a
       * prontidão de gente é irmã da prontidão da frota, e precisa do mesmo peso
       * de superfície. Fora dos cards porque motorista não entra na conta dos
       * caminhões, e somar os dois na mesma grade quebraria a soma da frota.
       */}
      <div
        className={cn(
          'bg-light ring-light-edge mt-4 flex flex-col gap-4 rounded-xl p-5 ring-1',
          'shadow-[0_1px_2px_rgba(28,26,24,0.04),0_8px_24px_-12px_rgba(28,26,24,0.14)]',
          'sm:flex-row sm:items-center sm:gap-6',
        )}
      >
        <div className="flex shrink-0 items-center gap-3">
          <span
            className="bg-primary-on-light/10 text-primary-on-light flex size-9 items-center justify-center rounded-md"
            aria-hidden="true"
          >
            <SteeringWheelIcon size={17} />
          </span>

          <div className="min-w-0">
            <p className="text-on-light-variant text-label-sm normal-case">Motoristas</p>
            <p className="tabular font-sora text-on-light mt-1 text-[22px] font-bold leading-none">
              {drivers.total}
            </p>
          </div>
        </div>

        {/* Divisa só no monitor: empilhada, ela vira um traço solto no meio. */}
        <div className="bg-light-outline hidden h-10 w-px shrink-0 sm:block" aria-hidden="true" />

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
          <DriverStat label="disponíveis" value={drivers.available} />
          <DriverStat label="em viagem" value={drivers.onTrip} />
          <DriverStat label="sem registro no período" value={drivers.unavailable} tone="warn" />
          <DriverStat label="CNH a vencer em 60 dias" value={drivers.cnhExpiringSoon} tone="warn" />
        </div>
      </div>
    </>
  );
}
