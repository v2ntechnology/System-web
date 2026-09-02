import { ArrowUpRightIcon, MapPinIcon } from '@/components/icons';
import { LightCard, SpectrumButton, cn } from '@/management/ui';
import { useState } from 'react';
import { Link } from 'react-router';

import { dateTime } from '@/management/lib/format';

import { LIVE_MAP_PATH } from '../paths';
import type { ActiveTrip } from '../types';
import { FleetMiniMap } from './fleet-mini-map';

/**
 * Consulta rápida de onde está um caminhão, sem sair da visão geral.
 *
 * A pergunta que ele responde é pontual ("cadê o RKH2B88?"), e por isso a placa
 * vem antes do mapa: o gestor clica na placa que já tem na cabeça e o mapa vai
 * até ela. Quando a consulta vira investigação, o botão do cabeçalho leva à
 * central de comando, que é onde moram camada, histórico e 3D.
 */
export function OperationMapCard({ trips }: { trips: ActiveTrip[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;

  return (
    <LightCard
      title="Mapa da operação"
      action={
        <SpectrumButton asChild variant="ghost" size="sm">
          <Link to={LIVE_MAP_PATH}>
            Abrir mapa ao vivo
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </Link>
        </SpectrumButton>
      }
    >
      {/* ⚠️ Ativo e hover são exclusivos: somados, o realce do ponteiro apagava a
          pastilha da placa escolhida. A pastilha ativa é preta, nunca indigo. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {trips.map((trip) => {
          const active = trip.id === selectedId;

          return (
            <button
              key={trip.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(active ? null : trip.id)}
              className={cn(
                'rounded-pill tabular font-sora focus-visible:ring-secondary px-3 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                active
                  ? 'bg-on-light text-light'
                  : 'bg-on-light/[0.06] text-on-light-variant hover:bg-on-light/[0.11]',
              )}
            >
              {trip.plate}
            </button>
          );
        })}
      </div>

      <FleetMiniMap
        trips={trips}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="h-64 xl:h-72"
      />

      <div className="border-light-outline mt-4 border-t pt-4">
        {selected ? (
          <div className="flex min-w-0 items-start gap-2">
            <MapPinIcon
              size={15}
              className="text-on-light-muted mt-1 shrink-0"
              aria-hidden="true"
            />
            <p className="text-on-light-variant text-body-md min-w-0">
              <span className="tabular font-sora text-on-light font-bold">{selected.plate}</span>
              {` · ${selected.driverName} · ${selected.destination}, chega ${dateTime.format(new Date(selected.etaAt))}`}
              {selected.delayMinutes > 0 ? (
                <span className="text-error-on-light"> · atrasada</span>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="text-on-light-muted text-label-md normal-case">
            Clique numa placa ou num ponto do mapa para ver o caminhão de perto.
          </p>
        )}
      </div>
    </LightCard>
  );
}
