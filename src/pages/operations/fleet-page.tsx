import { AlertTriangle, Boxes, CheckCircle2, CircleParking, Route, Wrench } from 'lucide-react';

import { ChartCard, DonutChart } from '@/components/shared/charts';
import { InfoCard } from '@/components/shared/cards';
import { ErrorState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFleetOverview } from '@/hooks/use-queries';

const TYPE_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-success)',
] as const;

function typeColor(index: number): string {
  return TYPE_COLORS[index % TYPE_COLORS.length] ?? TYPE_COLORS[0];
}

export default function FleetPage() {
  const { data, isLoading, isError, refetch } = useFleetOverview();

  return (
    <div className="space-y-6">
      <PageHeader title="Frota" description="Visão agregada da frota por status, tipo e unidade." />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Total de veículos" value={data.total} icon={Boxes} />
            <InfoCard
              label="Disponíveis"
              value={data.available}
              icon={CheckCircle2}
              accent="success"
            />
            <InfoCard label="Em viagem" value={data.onTrip} icon={Route} accent="info" />
            <InfoCard
              label="Em manutenção"
              value={data.maintenance}
              icon={Wrench}
              accent="warning"
            />
            <InfoCard label="Parados" value={data.stopped} icon={CircleParking} />
            <InfoCard
              label="Com alertas"
              value={data.withAlerts}
              icon={AlertTriangle}
              accent="destructive"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Distribuição por tipo"
              description="Composição da frota por categoria de veículo"
            >
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="w-full sm:w-1/2">
                  <DonutChart
                    data={data.byType.map((t, i) => ({
                      name: t.label,
                      value: t.count,
                      color: typeColor(i),
                    }))}
                  />
                </div>
                <ul className="w-full space-y-2 sm:w-1/2">
                  {data.byType.map((t, i) => (
                    <li key={t.type} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: typeColor(i) }}
                        />
                        {t.label}
                      </span>
                      <span className="font-medium">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por unidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.byUnit.map((u) => {
                  const pct = Math.round((u.count / data.total) * 100);
                  return (
                    <div key={u.unit} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{u.unit}</span>
                        <span className="text-muted-foreground">{u.count} veículos</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-gradient"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
