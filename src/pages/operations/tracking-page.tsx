import { ClockIcon, MapPinIcon, ParkingIcon, RouteIcon, TruckIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { OperationMap } from '@/components/shared/operation-map';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingState } from '@/components/shared/states';
import {
  HeroPill,
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { SearchInput } from '@/components/shared/filters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVehicles } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';
import { vehicleStatusDescriptor } from '@/lib/status-maps';
import type { MapVehicleMarker, Vehicle } from '@/types';

/*
 * Desconto do topbar, do respiro da página e do cabeçalho da tela.
 *
 * ⚠️ O `30rem` é função do cabeçalho: era `17rem` quando a tela abria com o
 * `PageHeader`, e subiu ao adotar a faixa de abertura mais a fileira de números.
 * Quem mexer no cabeçalho desta página tem de reacertar este número, senão o
 * mapa passa da dobra. ⚠️ Foi calculado pelos respiros, e não medido no
 * navegador: confira ao mexer.
 */
const MAP_HEIGHT = 'h-[calc(100svh-30rem)] min-h-[26rem]';
const PANEL_HEIGHT = 'max-h-[calc(100svh-30rem)] min-h-[26rem]';

/*
 * A lista mostra OITO veículos e o resto vem por rolagem (pedido do usuário em
 * 09/09/2026). Antes ela desenhava a frota inteira e empurrava o cartão para
 * fora da tela.
 *
 * A conta, MEDIDA no navegador e não estimada: a linha tem 54px de altura e o
 * `space-y-1` põe 4px entre elas, dando 58px de passo. Oito linhas são
 * 8 × 54 + 7 × 4 = 460px.
 *
 * ⚠️ Mexeu no respiro da linha ou no tamanho da fonte, meça de novo: com o
 * número errado a oitava linha aparece cortada no meio, que é pior do que
 * mostrar sete inteiras.
 *
 * ⚠️ É `h-`, e NÃO `max-h-`: o viewport do `ScrollArea` do Radix é `h-full`, e
 * porcentagem contra pai de altura automática não resolve. Com `max-h` o
 * viewport ficava do tamanho da frota inteira, o `overflow-hidden` do Root
 * cortava a lista e ela não rolava. Só a altura fixa dá o que a porcentagem
 * precisa.
 *
 * Por isso ela vale apenas quando há mais de oito: abaixo disso, altura fixa
 * deixaria um vazio embaixo da lista.
 */
const MAX_ROWS = 8;
const LIST_HEIGHT = 'h-[460px]';

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

  const moving = vehicles.filter((v) => v.status === 'on_trip').length;
  const stopped = vehicles.length - moving;

  const stats: HeroStat[] = [
    {
      key: 'rastreados',
      label: 'Rastreados',
      value: vehicles.length,
      hint: 'com posição conhecida',
      icon: TruckIcon,
    },
    {
      key: 'movimento',
      label: 'Em viagem',
      value: moving,
      hint: 'rodando agora',
      icon: RouteIcon,
    },
    {
      key: 'parados',
      label: 'Parados',
      value: stopped,
      hint: 'sem viagem em curso',
      icon: ParkingIcon,
    },
    {
      key: 'sem-sinal',
      label: 'Sem posição',
      value: (data?.data.length ?? 0) - vehicles.length,
      hint: 'não aparecem no mapa',
      icon: MapPinIcon,
      tone: (data?.data.length ?? 0) - vehicles.length > 0 ? 'warn' : 'neutral',
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Rastreamento"
        description="Monitore a frota em tempo real. Selecione um veículo para ver detalhes."
      >
        <HeroPill icon={TruckIcon}>
          {vehicles.length} {vehicles.length === 1 ? 'veículo no mapa' : 'veículos no mapa'}
        </HeroPill>
      </PageHero>

      <HeroStats items={stats} />

      <PagePanel>
        {isLoading ? (
          <LoadingState label="Carregando frota…" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
            {/* ⚠️ A altura deste cartão sai da LISTA, e por isso ele não carrega
                mais o `PANEL_HEIGHT`. Antes o `ScrollArea` abaixo era um
                `flex-1` sem teto: filho flex não encolhe abaixo do próprio
                conteúdo, então a frota inteira era desenhada e vazava para fora
                do cartão, por cima do que vem depois. Quem segura agora é o
                `LIST_HEIGHT`. */}
            {/* `self-start`: sem isso a grade estica o cartão até a altura do
                mapa e sobra um vazio embaixo das oito linhas. */}
            <LightCard className="order-2 self-start !p-3 lg:order-1">
              <div className="pb-3">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar veículo"
                  aria-label="Buscar veículo no mapa"
                />
              </div>
              <ScrollArea className={cn(filtered.length > MAX_ROWS && LIST_HEIGHT)}>
                <div className="space-y-1 pb-1">
                  {filtered.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-left transition-colors',
                        /* Estados exclusivos: o hover incondicional vencia o
                         destaque do selecionado por especificidade e apagava a
                         linha escolhida justamente ao apontar para ela. Mesma
                         armadilha do menu lateral, corrigida em 30/08/2026. */
                        selectedId === v.id
                          ? 'border-primary/40 bg-primary/15'
                          : 'hover:bg-light-container',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-on-light truncate font-mono text-sm">{v.plate}</p>
                        <p className="text-on-light-muted truncate text-xs">
                          {v.lastPosition?.city}/{v.lastPosition?.state}
                        </p>
                      </div>
                      <StatusBadge descriptor={vehicleStatusDescriptor(v.status)} withDot={false} />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </LightCard>

            <div className="order-1 lg:order-2">
              <OperationMap
                markers={markers}
                selectedId={selectedId}
                onSelect={(m) => setSelectedId(m.id)}
                heightClassName={MAP_HEIGHT}
              />
            </div>

            <LightCard
              className={cn('order-3 overflow-y-auto', PANEL_HEIGHT)}
              title={selected ? `Veículo ${selected.plate}` : 'Detalhes'}
            >
              <div>
                {selected ? (
                  <div className="space-y-4">
                    <div className="space-y-1 text-sm">
                      <div className="text-on-light flex items-center gap-2">
                        <MapPinIcon className="text-primary-on-light h-4 w-4" />
                        {selected.lastPosition?.city}/{selected.lastPosition?.state}
                      </div>
                      <p className="text-on-light-muted">
                        {selected.manufacturer} {selected.model}
                      </p>
                      {selected.currentDriver && (
                        <p className="text-on-light-muted">
                          Motorista: {selected.currentDriver.name}
                        </p>
                      )}
                    </div>
                    <StatusBadge descriptor={vehicleStatusDescriptor(selected.status)} />
                    <div>
                      <p className="text-on-light-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                        Linha do tempo
                      </p>
                      <ol className="border-light-outline space-y-3 border-l pl-4">
                        {[
                          'Saída do CD',
                          'Passagem em pedágio',
                          'Parada programada',
                          'Última posição',
                        ].map((event, i) => (
                          <li key={event} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                            <p className="text-on-light font-medium">{event}</p>
                            <p className="text-on-light-muted flex items-center gap-1 text-xs">
                              <ClockIcon className="h-3 w-3" />
                              {`0${7 + i}:${i * 12 + 10}`.replace(/:(\d)$/, ':0$1')}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : (
                  <p className="text-on-light-muted text-sm">
                    Selecione um veículo no mapa ou na lista para visualizar os detalhes e a linha
                    do tempo dos eventos.
                  </p>
                )}
              </div>
            </LightCard>
          </div>
        )}
      </PagePanel>
    </div>
  );
}
