import {
  BoxesIcon,
  CheckCircleIcon,
  MaintenanceIcon,
  ParkingIcon,
  RouteIcon,
  WarningIcon,
} from '@/components/icons';

import { DonutChart } from '@/components/shared/charts';
import { ErrorState } from '@/components/shared/states';
import {
  HeroPill,
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
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

  /*
   * ⚠️ A fileira só tem `warn` e `alert` coloridos, e isso é do molde do painel
   * de gestão: cor no número quer dizer "olhe para este". Os `accent` verde e
   * azul que os `InfoCard` tinham davam a seis números o mesmo peso de aviso, e
   * aí nenhum chamava. Disponível e em viagem são o normal da operação.
   */
  const stats: HeroStat[] = data
    ? [
        { key: 'total', label: 'Total de veículos', value: data.total, icon: BoxesIcon },
        {
          key: 'disponiveis',
          label: 'Disponíveis',
          value: data.available,
          icon: CheckCircleIcon,
        },
        { key: 'viagem', label: 'Em viagem', value: data.onTrip, icon: RouteIcon },
        {
          key: 'manutencao',
          label: 'Em manutenção',
          value: data.maintenance,
          icon: MaintenanceIcon,
          tone: data.maintenance > 0 ? 'warn' : 'neutral',
        },
        { key: 'parados', label: 'Parados', value: data.stopped, icon: ParkingIcon },
        {
          key: 'alertas',
          label: 'Com alertas',
          value: data.withAlerts,
          icon: WarningIcon,
          tone: data.withAlerts > 0 ? 'alert' : 'neutral',
        },
      ]
    : [];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero title="Frota" description="Visão agregada da frota por status, tipo e unidade.">
        {data ? <HeroPill icon={BoxesIcon}>{data.total} veículos</HeroPill> : null}
      </PageHero>

      {isError ? (
        <PagePanel>
          <ErrorState onRetry={() => refetch()} />
        </PagePanel>
      ) : isLoading || !data ? (
        <>
          <div className="relative z-10 -mt-16 grid grid-cols-2 gap-4 sm:-mt-20 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <PagePanel>
            <Skeleton className="h-80 w-full" />
          </PagePanel>
        </>
      ) : (
        <>
          <HeroStats items={stats} />

          <PagePanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <LightCard
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
                      <li
                        key={t.type}
                        className="text-on-light text-body-md flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: typeColor(i) }}
                          />
                          {t.label}
                        </span>
                        <span className="font-medium tabular-nums">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </LightCard>

              <LightCard title="Distribuição por unidade">
                <div className="space-y-3">
                  {data.byUnit.map((u) => {
                    const pct = Math.round((u.count / data.total) * 100);
                    return (
                      <div key={u.unit} className="space-y-1">
                        <div className="text-body-md flex items-center justify-between">
                          <span className="text-on-light">{u.unit}</span>
                          <span className="text-on-light-muted tabular-nums">
                            {u.count} veículos
                          </span>
                        </div>
                        {/* Poço da própria superfície: `bg-muted` é da família do
                            papel e não se lê dentro do painel claro. */}
                        <div className="bg-light-container h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary-strong h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </LightCard>
            </div>
          </PagePanel>
        </>
      )}
    </div>
  );
}
