import { MapPinIcon, PartnerShopIcon, PhoneIcon, StarIcon } from '@/components/icons';
import { useState } from 'react';

import type { VehiclePosition } from '@/management/types';
import { MAINTENANCE_ITEMS } from '@/management/mocks/maintenance-partners';
import { cn } from '@/management/ui';

import { VehicleCard } from './vehicle-telemetry-cards';

const umaCasa = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Distância em linha reta: serve para ordenar a rede, não para prometer rota. */
function distanciaKm(
  origem: readonly [longitude: number, latitude: number],
  destino: readonly [latitude: number, longitude: number],
) {
  const raioTerraKm = 6371;
  const paraRad = (graus: number) => (graus * Math.PI) / 180;
  const [longitude, latitude] = origem;
  const [latitudeDestino, longitudeDestino] = destino;
  const deltaLatitude = paraRad(latitudeDestino - latitude);
  const deltaLongitude = paraRad(longitudeDestino - longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(paraRad(latitude)) *
      Math.cos(paraRad(latitudeDestino)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return raioTerraKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Só dígitos: `tel:` recusa telefone com pontuação. */
const somenteDigitos = (telefone: string) => telefone.replace(/\D/g, '');

/**
 * As lojas parceiras de cada item, em seção própria da ficha.
 *
 * Decisão do usuário em 22/09/2026: saiu de dentro de Manutenção, onde abria ao
 * escolher um item da grade. Lá o clique no item agora filtra o histórico, e
 * procurar quem atende é outra pergunta, feita de outro lugar.
 *
 * <h2>⚠️ A rede é EXEMPLO, e a seção diz isso em uma linha</h2>
 *
 * Decisão do usuário em 16/09/2026: esta parte aparece em todos os caminhões, e
 * não só na placa de demonstração. O que torna isso aceitável, enquanto os
 * blocos de telemetria continuam dizendo "sem origem": **loja parceira é
 * catálogo, e não medição da frota do cliente**.
 *
 * Um item vem sempre escolhido: a seção só existe para mostrar lojas, e abri-la
 * vazia pediria um clique antes de mostrar qualquer coisa.
 */
export function VehiclePartnerShops({
  position,
}: {
  /** Última posição da telemetria, em [longitude, latitude]. */
  position?: VehiclePosition | undefined;
}) {
  const [itemId, setItemId] = useState(MAINTENANCE_ITEMS[0]?.id);
  const item = MAINTENANCE_ITEMS.find((candidato) => candidato.id === itemId);

  const lojas = (item?.partners ?? [])
    .map((loja) => ({
      ...loja,
      distanceKm: position ? distanciaKm(position.coordinates, loja.coordinates) : undefined,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return (
    <VehicleCard
      title="Oficinas parceiras"
      icon={PartnerShopIcon}
      hint={
        position
          ? 'Ordenadas pela distância em linha reta da última posição do veículo'
          : 'Sem posição recente para ordenar por proximidade'
      }
    >
      <p className="text-on-light-muted text-label-sm mb-4 normal-case">
        <strong className="font-semibold">Rede de parceiros em configuração.</strong> As lojas
        abaixo são referências de catálogo, ainda não contratadas pela sua empresa.
      </p>

      <div role="radiogroup" aria-label="Item de manutenção" className="mb-4 flex flex-wrap gap-2">
        {MAINTENANCE_ITEMS.map((candidato) => {
          const Icon = candidato.icon;
          const ativo = candidato.id === itemId;

          return (
            <button
              key={candidato.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setItemId(candidato.id)}
              className={cn(
                'focus-visible:ring-primary-on-light text-label-md inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                ativo
                  ? 'border-primary-on-light bg-primary-on-light text-on-primary'
                  : 'border-light-outline text-on-light hover:border-primary-on-light/30 hover:bg-light-container',
              )}
            >
              <Icon size={15} aria-hidden="true" />
              {candidato.label}
            </button>
          );
        })}
      </div>

      {item ? (
        <p className="text-on-light-variant text-label-md mb-3 normal-case">{item.description}</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {lojas.map((loja) => (
          <li
            key={loja.id}
            className="border-light-outline flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4"
          >
            <div className="min-w-48 flex-1">
              <p className="text-on-light text-body-md font-semibold">{loja.name}</p>
              <p className="text-on-light-muted text-label-sm mt-0.5 flex items-center gap-1.5 normal-case">
                <MapPinIcon size={13} aria-hidden="true" />
                {loja.place}
                {loja.distanceKm != null
                  ? ` · ${umaCasa.format(loja.distanceKm)} km em linha reta`
                  : ''}
              </p>
            </div>

            <p className="text-on-light-variant text-label-sm max-w-40 normal-case">
              {loja.highlight}
              {loja.walkIn ? ' · sem hora marcada' : ' · com agendamento'}
            </p>

            <p className="text-on-light text-label-md tabular flex items-center gap-1.5 normal-case">
              {/* A nota é número, e a estrela só repete o que ele diz. */}
              <StarIcon size={14} className="text-warning" aria-hidden="true" />
              {umaCasa.format(loja.rating)}
            </p>

            <a
              href={`tel:+${somenteDigitos(loja.phone)}`}
              className="border-primary-on-light/25 text-primary-on-light hover:bg-primary-on-light/10 focus-visible:ring-primary-on-light text-label-md inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <PhoneIcon size={15} aria-hidden="true" />
              {loja.phone}
            </a>
          </li>
        ))}
      </ul>
    </VehicleCard>
  );
}
