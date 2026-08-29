import { ClockIcon, MapPinIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { OperationMap } from '@/components/shared/operation-map';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/shared/filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVehicles } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';
import { vehicleStatusDescriptor } from '@/lib/status-maps';
import type { MapVehicleMarker, Vehicle } from '@/types';

/* Desconto do topbar, do respiro da página e do cabeçalho da tela. */
const MAP_HEIGHT = 'h-[calc(100svh-17rem)] min-h-[26rem]';
const PANEL_HEIGHT = 'max-h-[calc(100svh-17rem)] min-h-[26rem]';

export default function TrackingPage() {
  const { data, isLoading } = useVehicles({ pageSize: 100 });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vehicles = useMemo(() => (data?.data ?? []).filter((v) => v.lastPosition), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter(
      (v) => v.plate.toLowerCase().includes(term) || v.fleetNumber.toLowerCase().includes(term),
    );
  }, [vehicles, search]);

  const markers: MapVehicleMarker[] = filtered.map((v) => ({
    id: v.id,
    plate: v.plate,
    status: v.status,
    position: v.lastPosition!,
  }));

  const selected: Vehicle | undefined = vehicles.find((v) => v.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rastreamento"
        description="Monitore a frota em tempo real. Selecione um veículo para ver detalhes."
      />

      {isLoading ? (
        <LoadingState label="Carregando frota…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
          {/* Altura pela janela, e não fixa em 520px: numa tela grande sobrava
              meia tela vazia embaixo do mapa. O mínimo garante o mapa utilizável
              em notebook. */}
          <Card className={cn('order-2 flex flex-col lg:order-1', PANEL_HEIGHT)}>
            <CardHeader className="pb-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar veículo"
                aria-label="Buscar veículo no mapa"
              />
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-1 px-3 pb-3">
                {filtered.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted/50',
                      selectedId === v.id && 'border-primary/40 bg-primary/10',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm">{v.plate}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.lastPosition?.city}/{v.lastPosition?.state}
                      </p>
                    </div>
                    <StatusBadge descriptor={vehicleStatusDescriptor(v.status)} withDot={false} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <div className="order-1 lg:order-2">
            <OperationMap
              markers={markers}
              selectedId={selectedId}
              onSelect={(m) => setSelectedId(m.id)}
              heightClassName={MAP_HEIGHT}
            />
          </div>

          <Card className={cn('order-3 overflow-y-auto', PANEL_HEIGHT)}>
            <CardHeader>
              <CardTitle className="text-base">
                {selected ? `Veículo ${selected.plate}` : 'Detalhes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-primary" />
                      {selected.lastPosition?.city}/{selected.lastPosition?.state}
                    </div>
                    <p className="text-muted-foreground">
                      {selected.manufacturer} {selected.model}
                    </p>
                    {selected.currentDriver && (
                      <p className="text-muted-foreground">
                        Motorista: {selected.currentDriver.name}
                      </p>
                    )}
                  </div>
                  <StatusBadge descriptor={vehicleStatusDescriptor(selected.status)} />
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Linha do tempo
                    </p>
                    <ol className="space-y-3 border-l border-border pl-4">
                      {[
                        'Saída do CD',
                        'Passagem em pedágio',
                        'Parada programada',
                        'Última posição',
                      ].map((event, i) => (
                        <li key={event} className="relative text-sm">
                          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                          <p className="font-medium">{event}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ClockIcon className="h-3 w-3" />
                            {`0${7 + i}:${i * 12 + 10}`.replace(/:(\d)$/, ':0$1')}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecione um veículo no mapa ou na lista para visualizar os detalhes e a linha do
                  tempo dos eventos.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
