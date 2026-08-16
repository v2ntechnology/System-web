import { useQuery } from '@tanstack/react-query';

import heroImage from '@imgs/truck01.jpg';

import { CostLayersCard } from '@/management/components/charts/cost-layers-card';
import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';

import { getDashboardSummary } from '../api';
import { HubOverviewCard } from '../components/hub-overview-card';
import { MaintenanceCard } from '../components/maintenance-card';

import { TopDriversCard } from '../components/top-drivers-card';

export function DashboardPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
  });

  return (
    <>
      <PageBanner
        size="hero"
        image={heroImage}
        eyebrow={data ? `Localização · ${data.hub.city} — ${data.hub.state}` : null}
        title={data?.hub.name ?? 'Painel'}
      />

      <PageContent>
        <QueryState isPending={isPending} isError={isError} label="o painel">
          {data ? (
            <>
              <h2 className="sr-only">Indicadores do hub</h2>

              <div className="grid gap-5 xl:grid-cols-3">
                <TopDriversCard drivers={data.topDrivers} />
                <HubOverviewCard metrics={data.metrics} />
                <MaintenanceCard orders={data.maintenance} />
              </div>

              <div className="mt-5">
                <CostLayersCard data={data.costPerKm} />
              </div>
            </>
          ) : null}
        </QueryState>
      </PageContent>
    </>
  );
}
