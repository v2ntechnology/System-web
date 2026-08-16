import {
  CalendarCheckIcon,
  DropIcon,
  GaugeIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import type { Vehicle, VehicleDetail } from '@/management/types';
import { Spinner, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getVehicleDetail } from '../api';
import { VehicleStatusChip } from '../vehicle-status';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

const SEVERITY: Record<
  VehicleDetail['recentEvents'][number]['severity'],
  {
    tone: 'critical' | 'attention' | 'info';
    label: string;
    icon: ComponentType<{ size?: number; weight?: 'fill'; className?: string }>;
  }
> = {
  CRITICO: { tone: 'critical', label: 'Crítico', icon: WarningCircleIcon },
  ATENCAO: { tone: 'attention', label: 'Atenção', icon: WarningIcon },
  INFO: { tone: 'info', label: 'Informativo', icon: InfoIcon },
};

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ size?: number; weight?: 'duotone' }>;
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="bg-white/4 min-w-0 rounded-md p-3">
      <p className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
        <Icon size={14} weight="duotone" aria-hidden="true" />
        {label}
      </p>
      <p className="tabular text-on-surface text-headline-md font-sora mt-1.5 font-semibold">
        {value}
      </p>
      {hint ? (
        <p className="text-on-surface-muted text-label-sm mt-0.5 normal-case">{hint}</p>
      ) : null}
    </div>
  );
}

/** Escala do eixo Y em passos de R$ 0,25, cobrindo a série com folga. */
function costAxis(values: number[]) {
  const step = 0.25;
  const min = Math.floor((Math.min(...values) - 0.1) / step) * step;
  const max = Math.ceil((Math.max(...values) + 0.1) / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + 1e-9; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { min, max, ticks };
}

/**
 * Painel de detalhe do veículo selecionado (Figma: "todas as informações").
 *
 * Bloco escuro dentro do painel claro — mesma inversão dos tiles do dashboard.
 */
export function VehicleDetailPanel({ vehicle }: { vehicle: Vehicle }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-detail', vehicle.id],
    queryFn: () => getVehicleDetail(vehicle.id),
  });

  const axis = costAxis(data?.monthlyCost.map((point) => point.value) ?? [0, 1]);

  return (
    <section
      aria-label={`Detalhes do caminhão ${vehicle.plate}`}
      className="bg-surface-lowest flex min-w-0 flex-col rounded-xl p-5 sm:p-6"
    >
      <header className="border-outline-variant flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h3 className="tabular font-sora text-on-surface text-headline-md font-bold">
            {vehicle.plate}
          </h3>
          <p className="text-on-surface-variant text-body-md mt-0.5">
            {vehicle.brand} {vehicle.model} · {vehicle.year}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <VehicleStatusChip status={vehicle.status} surface="dark" />
          <span className="tabular text-on-surface-muted text-label-md normal-case">
            {km.format(vehicle.odometerKm)} km no odômetro
          </span>
        </div>
      </header>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="text-on-surface-muted size-6" label="Carregando o veículo" />
        </div>
      ) : isError || !data ? (
        <p className="text-error text-body-md py-16 text-center">
          Não foi possível carregar os detalhes deste veículo.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={GaugeIcon}
              label="Custo por km"
              value={brl.format(vehicle.costPerKm)}
              hint="média de 30 dias"
            />
            <Metric
              icon={DropIcon}
              label="Consumo"
              value={`${data.fuelEfficiency.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} km/l`}
            />
            <Metric
              icon={CalendarCheckIcon}
              label="Disponibilidade"
              value={`${data.availability.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`}
              hint="tempo apto a rodar"
            />
            <Metric
              icon={WrenchIcon}
              label="Próxima manutenção"
              value={
                vehicle.kmToMaintenance < 0
                  ? `${km.format(Math.abs(vehicle.kmToMaintenance))} km vencida`
                  : `em ${km.format(vehicle.kmToMaintenance)} km`
              }
              hint={`última em ${dayMonth.format(new Date(data.lastMaintenanceAt))}`}
            />
          </div>

          <figure className="mt-6">
            <figcaption className="text-on-surface-variant text-body-md mb-3 flex items-baseline justify-between gap-3">
              Custo por quilômetro
              <span className="text-on-surface-muted text-label-md normal-case">
                R$/km · últimos 6 meses
              </span>
            </figcaption>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.monthlyCost}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id={`cost-${vehicle.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-outline-variant)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--color-on-surface-muted)', fontSize: 12 }}
                    dy={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fill: 'var(--color-on-surface-muted)', fontSize: 12 }}
                    tickFormatter={(value: number) => brl.format(value)}
                    /* Escala em passos de R$ 0,25 — o passo automático caía em
                       valores como R$ 2,41, que ninguém lê de relance. */
                    domain={[axis.min, axis.max]}
                    ticks={axis.ticks}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--color-on-surface-muted)', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'var(--color-surface-low)',
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: 12,
                      color: 'var(--color-on-surface)',
                    }}
                    formatter={(value: unknown) =>
                      [brl.format(Number(value)), 'Custo por km'] as [string, string]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-secondary)"
                    strokeWidth={2}
                    fill={`url(#cost-${vehicle.id})`}
                    dot={{ r: 3, fill: 'var(--color-secondary)', strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>

          <div className="mt-6">
            <h4 className="text-on-surface-variant text-body-md mb-3 flex items-center gap-2">
              Eventos recentes
              {data.openOrders > 0 ? (
                <StatusChip tone="attention">
                  {data.openOrders} OS aberta{data.openOrders > 1 ? 's' : ''}
                </StatusChip>
              ) : null}
            </h4>

            <ul className="flex flex-col gap-2">
              {data.recentEvents.map((event) => {
                const severity = SEVERITY[event.severity];
                const Icon = severity.icon;

                return (
                  <li
                    key={event.id}
                    className="bg-white/4 flex items-start gap-2.5 rounded-md px-3 py-2.5"
                  >
                    <Icon
                      size={16}
                      weight="fill"
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 shrink-0',
                        severity.tone === 'critical'
                          ? 'text-error'
                          : severity.tone === 'attention'
                            ? 'text-warning'
                            : 'text-info',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-on-surface text-body-md block">{event.label}</span>
                      <span className="text-on-surface-muted text-label-md block normal-case">
                        {severity.label} · {dayMonth.format(new Date(event.at))}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
