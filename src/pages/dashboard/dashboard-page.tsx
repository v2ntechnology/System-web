import { ArrowRightIcon, InfoIcon } from '@/components/icons';
import { useState } from 'react';
import { Link } from 'react-router';

import { ChartCard, SimpleBarChart, TrendAreaChart } from '@/components/shared/charts';
import { MetricCard } from '@/components/shared/cards';
import { OperationMap } from '@/components/shared/operation-map';
import { ErrorState } from '@/components/shared/states';
import { AIInsightCard } from '@/components/shared/ai-insight-card';
import { DateRangeSelector, type DateRangePreset } from '@/components/shared/filters';
import { RecentEntries, YardBoard, YardMetric } from '@/components/shared/operator-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlerts, useDashboard, useOperatorOverview, useYard } from '@/hooks/use-queries';
import { usePermissions, useSession } from '@/hooks/use-session';
import { greetingForNow, formatCurrency } from '@/lib/format';
import { useFinancialVisibility } from '@/management/features/drivers/use-financial-visibility';
import { type MapVehicleMarker } from '@/types';

import { ActivityFeed } from '@/components/shared/activity-feed';
import { RecentAlerts } from '@/components/shared/recent-alerts';

/**
 * Rotina de pátio no dashboard — o que o operador precisa antes de qualquer
 * gráfico: a fila de triagem, a situação do pátio e o que já foi lançado hoje.
 */
function YardSummary() {
  const canSeeFinancials = useFinancialVisibility();
  const overview = useOperatorOverview(canSeeFinancials);
  const yard = useYard();

  const data = overview.data;
  if (overview.isError) return null;

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_1.55fr]">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="sr-only">Situação do pátio</h2>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.55fr]">
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col pt-6">
            <p className="text-sm text-muted-foreground">Checklists para triar</p>
            <p className="font-display mt-2 text-4xl font-bold tabular-nums">
              {data.triagePending}
            </p>
            <p className="mt-3 text-sm">
              {data.triageBlocking > 0 ? (
                <span className="text-warning">
                  {data.triageBlocking === 1
                    ? '1 impede a saída do veículo'
                    : `${data.triageBlocking} impedem a saída do veículo`}
                </span>
              ) : (
                <span className="text-muted-foreground">Nenhum bloqueio na fila</span>
              )}
            </p>

            {/* O número vem com a procedência colada nele. */}
            <p className="mt-auto flex items-start gap-1.5 pt-5 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {data.source}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <YardMetric
            label="Veículos no pátio"
            value={String(data.vehiclesInYard)}
            hint="ocupando vaga agora"
          />
          <YardMetric
            label="Com impedimento"
            value={String(data.vehiclesBlocked)}
            hint="não podem sair"
            tone={data.vehiclesBlocked > 0 ? 'warning' : 'default'}
          />
          <YardMetric
            label="Lançamentos hoje"
            value={String(data.entriesToday)}
            hint="notas, multas e ordens"
          />

          {/*
           * RF-007 — o total do dia é dado financeiro consolidado. Quem não pode
           * ver enxerga o campo bloqueado, não some com ele: sumir vira chamado
           * de suporte. Digitar a nota continua sendo trabalho dele; ler o
           * acumulado, não.
           */}
          <YardMetric
            label="Valor lançado hoje"
            value={data.amountToday !== undefined ? formatCurrency(data.amountToday) : 'Restrito'}
            hint={
              data.amountToday !== undefined
                ? 'soma dos documentos do dia'
                : 'seu perfil não vê valores consolidados'
            }
            locked={data.amountToday === undefined}
          />

          <Card className="sm:col-span-2 xl:col-span-2">
            <CardContent className="flex h-full flex-wrap items-center gap-3 pt-6">
              <p className="min-w-0 flex-1 text-sm">
                {data.triagePending === 0
                  ? 'Fila de triagem vazia.'
                  : data.triagePending === 1
                    ? '1 checklist esperando sua tratativa.'
                    : `${data.triagePending} checklists esperando sua tratativa.`}
              </p>
              <Button asChild variant="brand" size="sm">
                <Link to="/app/triagem">
                  Abrir triagem
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {yard.data && <YardBoard vehicles={yard.data} />}

      <RecentEntries entries={data.recentEntries} canSeeAmounts={canSeeFinancials} />
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const { hasPermission } = usePermissions();
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: alerts } = useAlerts();
  const [range, setRange] = useState<DateRangePreset>('7d');
  const [selected, setSelected] = useState<MapVehicleMarker | null>(null);

  const firstName = user?.name.split(' ')[0] ?? '';
  const recentAlerts = (alerts ?? []).filter((a) => a.status !== 'ignored').slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {greetingForNow()}, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      {/*
       * A rotina de pátio abre o dashboard de quem trabalha nela. A pergunta da
       * manhã do operador não é estratégica: é "o que chegou para eu tratar e
       * qual caminhão pode sair" — por isso vem antes das métricas da frota.
       *
       * A checagem é uma condição, e não um `PermissionGuard`: para quem não
       * lança nota, a seção simplesmente não existe. O guarda mostraria um
       * "sem acesso" no meio do dashboard de uma área que não é dele.
       */}
      {hasPermission('entries.manage') && <YardSummary />}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data
              ? Array.from({ length: 4 }).map((_, i) => (
                  <MetricCard key={i} label="" value="" loading />
                ))
              : data.metrics.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                    trend={metric.trend}
                  />
                ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Mapa da operação</CardTitle>
                {selected && (
                  <span className="text-xs text-muted-foreground">
                    Selecionado:{' '}
                    <span className="font-medium text-foreground">{selected.plate}</span> ·{' '}
                    {selected.position.city}/{selected.position.state}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <OperationMap
                  markers={data?.markers ?? []}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                  heightClassName="h-[340px]"
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-1">
              <ActivityFeed events={data?.activity ?? []} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Performance da frota"
              description="Pontualidade x entregas no prazo (%)"
            >
              <TrendAreaChart
                data={data?.charts.fleetPerformance ?? []}
                series={[
                  { key: 'pontualidade', label: 'Pontualidade', color: 'var(--color-primary)' },
                  { key: 'entregas', label: 'Entregas', color: 'var(--color-accent)' },
                ]}
              />
            </ChartCard>

            <ChartCard title="Consumo de combustível" description="Litros consumidos por dia">
              <SimpleBarChart
                data={data?.charts.fuelConsumption ?? []}
                dataKey="litros"
                label="Litros"
                color="var(--color-accent)"
              />
            </ChartCard>

            <RecentAlerts alerts={recentAlerts} />
          </div>

          {data && <AIInsightCard insight={data.insight} />}
        </>
      )}
    </div>
  );
}
