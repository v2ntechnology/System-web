import { WarningIcon } from '@/components/icons';
import type { Vehicle } from '@/management/types';
import { GlassCard } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';
import { useMasterDetail } from '@/management/hooks/use-master-detail';

import { getFleetExpenses, getVehicles } from '../api';
import { ExpenseCard } from '../components/expense-card';
import { EMPTY_FILTERS, FleetFilters, type FleetFiltersValue } from '../components/fleet-filters';
import { TopVehiclesCard } from '../components/top-vehicles-card';
import { VehicleDetailPanel } from '../components/vehicle-detail-panel';
import { VehicleListItem } from '../components/vehicle-list-item';

/** RN-140 — integração parada há mais de 30 minutos vira aviso explícito. */
const STALE_SYNC_MINUTES = 30;

/**
 * Veículo que nunca sincronizou conta como desatualizado.
 *
 * Sem a guarda, `new Date(undefined)` produz `NaN`, toda comparação com `NaN` é
 * falsa, e o caminhão que nunca reportou seria o único a não aparecer no aviso
 * de dado velho. Justamente o pior caso passaria despercebido.
 */
const isStale = (vehicle: Vehicle, now: number) =>
  !vehicle.lastSyncAt ||
  (now - new Date(vehicle.lastSyncAt).getTime()) / 60_000 > STALE_SYNC_MINUTES;

/**
 * Abas do painel claro (Figma: "Ativos / Manutencao / Quebrados").
 *
 * "Quebrados" virou "Parados": o veículo bloqueado por pendência de checklist
 * (RF-016) não está quebrado — está impedido de sair, que é outra coisa.
 */
const TABS = [
  { id: 'ATIVOS', label: 'Ativos' },
  { id: 'MANUTENCAO', label: 'Em manutenção' },
  { id: 'PARADOS', label: 'Parados' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * "Parados" reúne bloqueado e sem sinal.
 *
 * São causas diferentes, e o efeito para quem escala a operação é o mesmo: não
 * dá para contar com esse caminhão hoje. O chip de estado na linha continua
 * dizendo qual é o caso.
 */
function matchesTab(vehicle: Vehicle, tab: TabId) {
  if (tab === 'ATIVOS') return vehicle.status === 'EM_VIAGEM' || vehicle.status === 'DISPONIVEL';
  if (tab === 'MANUTENCAO') return vehicle.status === 'MANUTENCAO';
  return vehicle.status === 'BLOQUEADO' || vehicle.status === 'SEM_SINAL';
}

export function TrucksPage() {
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: getVehicles });
  const expensesQuery = useQuery({ queryKey: ['fleet-expenses'], queryFn: getFleetExpenses });

  const [tab, setTab] = useState<TabId>('ATIVOS');
  const [filters, setFilters] = useState<FleetFiltersValue>(EMPTY_FILTERS);

  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  /*
   * "Agora" fixado na abertura da tela: `Date.now()` no corpo do componente é
   * chamada impura durante o render (erro de lint aqui), e a defasagem de
   * sincronização é medida em dezenas de minutos — não muda de resposta
   * enquanto a lista está aberta.
   */
  const [now] = useState(() => Date.now());

  const brands = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort(),
    [vehicles],
  );

  const visible = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      if (!matchesTab(vehicle, tab)) return false;
      if (filters.brand !== 'TODAS' && vehicle.brand !== filters.brand) return false;
      /* Sem plano de manutenção cadastrado não dá para dizer se está vencida ou
         próxima. Fica fora dos dois filtros, em vez de ser tratado como zero. */
      const km = vehicle.kmToMaintenance;
      if (filters.maintenance === 'VENCIDA' && !(km != null && km < 0)) return false;
      if (filters.maintenance === 'PROXIMA' && !(km != null && km >= 0 && km < 1000)) return false;
      if (filters.sync === 'DESATUALIZADO' && !isStale(vehicle, now)) return false;
      if (
        term &&
        /* O código interno entra na busca: quem preencheu o número da porta
           procura por ele, e não pela placa. */
        ![
          vehicle.plate,
          vehicle.internalCode ?? '',
          vehicle.brand,
          vehicle.model,
          vehicle.driverName ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [vehicles, tab, filters, now]);

  const vehicleId = useCallback((vehicle: Vehicle) => vehicle.id, []);
  const { selectedId, setSelectedId, selected } = useMasterDetail(visible, vehicleId);
  const staleCount = vehicles.filter((vehicle) => isStale(vehicle, now)).length;

  /** Clique numa barra dos cards de despesa leva ao veículo correspondente. */
  function focusPlate(plate: string) {
    const vehicle = vehicles.find((item) => item.plate === plate);
    if (!vehicle) return;

    const tabForVehicle: TabId =
      vehicle.status === 'MANUTENCAO'
        ? 'MANUTENCAO'
        : vehicle.status === 'BLOQUEADO' || vehicle.status === 'SEM_SINAL'
          ? 'PARADOS'
          : 'ATIVOS';

    setFilters(EMPTY_FILTERS);
    setTab(tabForVehicle);
    setSelectedId(vehicle.id);
  }

  const counts = useMemo(
    () => ({
      ATIVOS: vehicles.filter((v) => matchesTab(v, 'ATIVOS')).length,
      MANUTENCAO: vehicles.filter((v) => matchesTab(v, 'MANUTENCAO')).length,
      PARADOS: vehicles.filter((v) => matchesTab(v, 'PARADOS')).length,
    }),
    [vehicles],
  );

  const tabsWithCounts = useMemo(
    () => TABS.map((option) => ({ ...option, count: counts[option.id] })),
    [counts],
  );

  return (
    <>
      <PageBanner
        size="inline"
        title="Caminhões"
        description="Toda a frota, com situação em tempo real, custo por quilômetro e proximidade da próxima manutenção."
      />

      {/* -------------------------------------------------------------------
       * Faixa escura: despesas do período + filtros
       * ----------------------------------------------------------------- */}
      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Despesas da frota no período</h2>

        <QueryState
          isPending={expensesQuery.isPending}
          isError={expensesQuery.isError}
          label="as despesas"
        >
          {expensesQuery.data && expensesQuery.data.categories.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
              <GlassCard className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6">
                {expensesQuery.data.categories.map((category) => (
                  <ExpenseCard
                    key={category.id}
                    category={category}
                    highlightPlate={selected?.plate}
                    onSelectPlate={focusPlate}
                  />
                ))}
              </GlassCard>

              <GlassCard className="flex p-5 sm:p-6">
                <TopVehiclesCard
                  ranking={expensesQuery.data.costRank}
                  highlightPlate={selected?.plate}
                  onSelectPlate={focusPlate}
                />
              </GlassCard>
            </div>
          ) : (
            /* Sem origem de custo, o card diz o que falta em vez de sumir. Um
               espaço em branco faria parecer que a frota não gastou nada. */
            <GlassCard className="p-5 sm:p-6">
              <p className="text-on-surface-variant text-body-md">
                Ainda não há dados de custo nesta frota.
              </p>
              <p className="text-on-surface-muted text-label-md mt-1.5 normal-case">
                Combustível, manutenção e multas não vêm do rastreador. Eles entram quando os
                lançamentos forem registrados no sistema ou uma integração financeira for ligada.
              </p>
            </GlassCard>
          )}
        </QueryState>

        {staleCount > 0 ? (
          /*
           * RN-141 — o gestor precisa saber que está olhando número velho ANTES
           * de decidir com base nele. Requisito de confiança, não de conveniência.
           */
          <div className="bg-warning/10 border-warning/30 text-warning mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3">
            <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-body-md">
              {staleCount === 1
                ? '1 veículo está há mais de 30 minutos sem sincronizar'
                : `${staleCount} veículos estão há mais de 30 minutos sem sincronizar`}
              . Os dados desses veículos podem estar desatualizados.
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <FleetFilters value={filters} onChange={setFilters} brands={brands} />
        </div>
      </section>

      {/* -------------------------------------------------------------------
       * Painel claro: abas flutuantes + lista e detalhe
       * ----------------------------------------------------------------- */}
      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={tabsWithCounts}
          value={tab}
          onValueChange={setTab}
          label="Situação dos caminhões"
        >
          <QueryState
            isPending={vehiclesQuery.isPending}
            isError={vehiclesQuery.isError}
            label="a frota"
          >
            <div className="grid gap-6 pb-4 xl:grid-cols-[minmax(0,380px)_1fr]">
              <div className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-sora text-primary text-headline-md">Frota</h2>
                  <span className="text-on-light-muted text-label-md tabular normal-case">
                    {visible.length} de {vehicles.length}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-on-light-variant text-body-md py-10 text-center">
                    Nenhum caminhão encontrado com esses filtros.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visible.map((vehicle) => (
                      <li key={vehicle.id} className="min-w-0">
                        <VehicleListItem
                          vehicle={vehicle}
                          selected={vehicle.id === selectedId}
                          onSelect={(next) => setSelectedId(next.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="min-w-0">
                {selected ? (
                  <VehicleDetailPanel vehicle={selected} />
                ) : (
                  <div className="bg-surface-lowest flex min-h-80 items-center justify-center rounded-xl p-6">
                    <p className="text-on-surface-muted text-body-md text-center">
                      Selecione um caminhão para ver custo, consumo, manutenção e eventos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </QueryState>
        </PageTabs>
      </PageContent>
    </>
  );
}
