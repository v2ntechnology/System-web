import {
  AlertCircleIcon,
  CalendarCheckIcon,
  DropletIcon,
  EditIcon,
  GaugeIcon,
  InfoIcon,
  MaintenanceIcon,
  WarningIcon,
} from '@/components/icons';
import type { Vehicle, VehicleDetail } from '@/management/types';
import { SpectrumButton, Spinner, StatusChip, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type ComponentType } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useIncrementalList } from '@/management/hooks/use-incremental-list';

import { getVehicleDetail } from '../api';
import { VehicleRegistryModal } from './vehicle-registry-modal';
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
  CRITICO: { tone: 'critical', label: 'Crítico', icon: AlertCircleIcon },
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
    <div className="bg-on-surface/4 min-w-0 rounded-md p-3">
      <p className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
        <Icon size={14} aria-hidden="true" />
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

/** "2026-08-26" vira "26/08". O eixo tem espaço para cinco caracteres, não dez. */
function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return dia && mes ? `${dia}/${mes}` : iso;
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
  const [cadastroAberto, setCadastroAberto] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-detail', vehicle.id],
    queryFn: () => getVehicleDetail(vehicle.id),
  });

  /*
   * O gráfico mostra custo quando existe custo, e quilometragem quando não.
   *
   * A alternativa seria alimentar o gráfico de custo com a distância, e o
   * resultado seria uma curva plausível, com "R$" no eixo, errada por três
   * ordens de grandeza. Ninguém notaria olhando.
   */
  const temCusto = (data?.monthlyCost.length ?? 0) > 0;
  const serie = temCusto
    ? (data?.monthlyCost ?? []).map((point) => ({ rotulo: point.month, valor: point.value }))
    : (data?.dailyDistance ?? []).map((point) => ({
        rotulo: diaCurto(point.day),
        valor: point.km,
      }));

  /* Em quilometragem o passo automático do Recharts serve, então a lista de
     marcas fica vazia e ele decide sozinho. */
  const axis = temCusto
    ? costAxis(serie.map((point) => point.valor))
    : { min: 0, max: 'auto' as const, ticks: [] as number[] };

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
            {/* Ano só aparece quando existe: a telemetria não informa fabricação. */}
            {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
            {vehicle.unit ? ` · ${vehicle.unit}` : ''}
          </p>
          {/* Observação que o cliente escreveu no cadastro do rastreador. É onde
              aparece a transferência de filial, que explica a placa repetida. */}
          {vehicle.notes ? (
            <p className="text-on-surface-muted text-label-md mt-1 normal-case">{vehicle.notes}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <VehicleStatusChip status={vehicle.status} surface="dark" />
          <span className="tabular text-on-surface-muted text-label-md normal-case">
            {km.format(vehicle.odometerKm)} km no odômetro
          </span>

          {/*
           * A ficha abre em diálogo, e não mais em formulário no pé do painel.
           *
           * Ela tem cinco seções e mais de vinte campos: no fim da página,
           * empurrava para fora da tela o que a pessoa veio ver, e repetia na
           * cara placa, marca e modelo, que já estão no cabeçalho aqui do lado.
           * É o mesmo diálogo do cadastro de frota, então os campos moram num
           * lugar só.
           */}
          <SpectrumButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCadastroAberto(true)}
          >
            <EditIcon size={16} aria-hidden="true" />
            Cadastro da operação
          </SpectrumButton>
        </div>
      </header>

      <VehicleRegistryModal
        open={cadastroAberto}
        onOpenChange={setCadastroAberto}
        vehicleId={vehicle.id}
        plate={vehicle.plate}
      />

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
            {/* Indicador sem origem no sistema mostra travessão, nunca zero: um
                custo de R$ 0,00 na tela é lido como medição, não como ausência. */}
            <Metric
              icon={GaugeIcon}
              label="Custo por km"
              value={vehicle.costPerKm == null ? '–' : brl.format(vehicle.costPerKm)}
              hint={vehicle.costPerKm == null ? 'sem dados de custo ainda' : 'média de 30 dias'}
            />
            <Metric
              icon={DropletIcon}
              label="Consumo"
              value={
                data.fuelEfficiency == null
                  ? '–'
                  : `${data.fuelEfficiency.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} km/l`
              }
              hint={data.fuelEfficiency == null ? 'rastreador não informa consumo' : undefined}
            />
            <Metric
              icon={CalendarCheckIcon}
              label="Tempo rodando"
              value={
                data.availability == null
                  ? '–'
                  : `${data.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
              }
              hint="do período, em movimento"
            />
            <Metric
              icon={MaintenanceIcon}
              label="Próxima manutenção"
              value={
                vehicle.kmToMaintenance == null
                  ? '–'
                  : vehicle.kmToMaintenance < 0
                    ? `${km.format(Math.abs(vehicle.kmToMaintenance))} km vencida`
                    : `em ${km.format(vehicle.kmToMaintenance)} km`
              }
              hint={
                data.lastMaintenanceAt
                  ? `última em ${dayMonth.format(new Date(data.lastMaintenanceAt))}`
                  : /* O plano passou a existir quando alguém preencheu o
                       cadastro abaixo. Continuar dizendo "sem plano" ao lado de
                       um "em 12.688 km" faria a tela se contradizer. */
                    vehicle.kmToMaintenance != null
                    ? 'plano preenchido no cadastro'
                    : 'sem plano cadastrado'
              }
            />
          </div>

          <figure className="mt-6">
            <figcaption className="text-on-surface-variant text-body-md mb-3 flex items-baseline justify-between gap-3">
              {temCusto ? 'Custo por quilômetro' : 'Quilômetros por dia'}
              <span className="text-on-surface-muted text-label-md normal-case">
                {temCusto
                  ? 'R$/km · últimos 6 meses'
                  : `km · ${data.journeys ?? 0} trecho${data.journeys === 1 ? '' : 's'} no período`}
              </span>
            </figcaption>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`cost-${vehicle.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-outline-variant)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="rotulo"
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
                    tickFormatter={(value: number) =>
                      temCusto ? brl.format(value) : km.format(Math.round(value))
                    }
                    /* Escala em passos de R$ 0,25 no custo: o passo automático
                       caía em valores como R$ 2,41, que ninguém lê de relance.
                       Em quilometragem o passo automático serve. */
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
                      (temCusto
                        ? [brl.format(Number(value)), 'Custo por km']
                        : [`${km.format(Math.round(Number(value)))} km`, 'Rodado no dia']) as [
                        string,
                        string,
                      ]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="var(--secondary)"
                    strokeWidth={2}
                    fill={`url(#cost-${vehicle.id})`}
                    dot={{ r: 3, fill: 'var(--secondary)', strokeWidth: 0 }}
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

            <RecentEvents events={data.recentEvents} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Eventos recentes do veículo, oito por vez.
 *
 * A telemetria repete o mesmo evento muitas vezes no mesmo dia ("USO DOS
 * FREIOS" nove vezes seguidas), e a lista inteira empurrava o cadastro da
 * operação para fora da tela. Cresce ao rolar, sem botão e sem paginação.
 */
function RecentEvents({ events }: { events: VehicleDetail['recentEvents'] }) {
  const { visible, hasMore, sentinelRef } = useIncrementalList(events);

  return (
    /* Mesma caixa da lista de frota: oito eventos visíveis e rolagem própria. A
       telemetria repete "USO DOS FREIOS" nove vezes no mesmo dia, e a lista
       inteira empurrava o cadastro da operação para fora da tela. */
    <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto">
      {visible.map((event) => {
        const severity = SEVERITY[event.severity];
        const Icon = severity.icon;

        return (
          <li
            key={event.id}
            className="bg-on-surface/4 flex items-start gap-2.5 rounded-md px-3 py-2.5"
          >
            <Icon
              size={16}
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

      {hasMore ? (
        <li ref={sentinelRef} className="py-2 text-center" aria-hidden="true">
          <span className="text-on-surface-muted text-label-md normal-case">Carregando mais…</span>
        </li>
      ) : null}
    </ul>
  );
}
