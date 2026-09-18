import {
  ChevronRightIcon,
  MaintenanceIcon,
  MapPinIcon,
  PartnerShopIcon,
  PhoneIcon,
  StarIcon,
} from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { km } from '@/management/lib/format';
import type { MaintenanceStatus } from '@/management/lib/fleet-api';
import type { VehiclePosition } from '@/management/types';
import { MAINTENANCE_ITEMS } from '@/management/mocks/maintenance-partners';
import { cn } from '@/management/ui';

import { getVehicleMaintenance } from '../api';
import { MaintenanceEventDialog } from './maintenance-event-dialog';

/**
 * O vencimento em uma frase, a partir do que o SERVIDOR calculou.
 *
 * <h2>⚠️ A tela não recalcula, e isso é o ponto</h2>
 *
 * "Vence em 12 dias" é a mesma pergunta que a fila de manutenção e o assistente
 * fazem. Calculada aqui, cada tela teria a própria versão da regra, e a primeira
 * divergência apareceria do pior jeito: a ficha dizendo "em dia" e a fila
 * dizendo "vencido", sobre o mesmo caminhão. O cálculo mora em
 * `VehicleMaintenanceService`, e aqui só se escolhe a palavra.
 *
 * ⚠️ **Sem plano não há vencimento**, e o cartão diz isso em vez de mostrar
 * zero: o item ainda não é acompanhado, o que é diferente de estar em dia.
 */
function frasedoVencimento(status: MaintenanceStatus | undefined): {
  texto: string;
  tom: 'ok' | 'atencao' | 'critico' | 'ausente';
} {
  if (!status || (status.intervalKm == null && status.intervalMonths == null)) {
    /*
     * ⚠️ Sem plano, mas COM troca, o cartão confirma o que foi registrado. Sem
     * isto, quem acabou de lançar a troca via o cartão dizer "sem plano" e
     * concluía que o lançamento se perdeu, quando o que falta é o intervalo no
     * cadastro. Medido na tela em 17/09/2026.
     */
    if (status?.lastDoneAt) {
      return { texto: `Trocado em ${dia(status.lastDoneAt)}, sem plano`, tom: 'ausente' };
    }
    return { texto: 'Sem plano cadastrado', tom: 'ausente' };
  }
  if (!status.lastDoneAt) {
    return { texto: 'Sem última troca registrada', tom: 'ausente' };
  }

  const dias = status.dueInDays;
  const faltamKm = status.dueInKm;

  if (status.overdue) {
    const atraso =
      dias != null && dias < 0
        ? `${Math.abs(dias)} dias`
        : faltamKm != null
          ? `${km.format(Math.abs(faltamKm))} km`
          : '';
    return { texto: atraso ? `Venceu há ${atraso}` : 'Vencido', tom: 'critico' };
  }

  /* Os dois aparecem quando existem: a oficina troca no que vier primeiro, e
     mostrar só os dias esconderia o caminhão que roda muito. */
  const partes = [
    dias != null ? `em ${dias} dias` : null,
    faltamKm != null ? `${km.format(Math.round(faltamKm))} km` : null,
  ].filter(Boolean);

  return {
    texto: `Vence ${partes.join(' ou ')}`,
    tom: dias != null && dias <= 15 ? 'atencao' : 'ok',
  };
}

/** Dia e mês, que é como a operação fala de uma troca recente. */
const dia = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00`),
  );

const TOM = {
  ok: 'text-on-light-variant',
  atencao: 'text-warning-on-light',
  critico: 'text-error-on-light',
  ausente: 'text-on-light-muted',
} as const;

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
 * Manutenção do veículo, por item, com as lojas de cada um.
 *
 * <h2>⚠️ A rede é EXEMPLO, e a seção diz isso em uma linha</h2>
 *
 * Decisão do usuário em 16/09/2026: esta parte aparece em todos os caminhões, e
 * não só na placa de demonstração. O que torna isso aceitável, enquanto os
 * blocos de telemetria continuam dizendo "sem origem": **loja parceira é
 * catálogo, e não medição da frota do cliente**. Listar oficinas afirma algo
 * sobre uma rede que a RookHub vai montar; dizer "68% de tanque" afirmaria algo
 * sobre um caminhão que existe.
 *
 * ⚠️ **Nenhum cartão mostra "última troca há X km".** Isso seria medição por
 * veículo, e ninguém tem esse dado: o cartão mostra o ITEM e a rede dele.
 *
 * <h2>A escolha abre a lista embaixo, e não num diálogo</h2>
 *
 * É uma tela em construção, que vamos ajustar juntos: painel embaixo se compara
 * lado a lado com a grade e se altera sem abrir e fechar modal a cada teste.
 */
export function VehicleMaintenance({
  vehicleId,
  odometroAtual,
  position,
  demonstracao = false,
}: {
  vehicleId: string;
  odometroAtual?: number | undefined;
  /** Última posição da telemetria, em [longitude, latitude]. */
  position?: VehiclePosition | undefined;
  demonstracao?: boolean | undefined;
}) {
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const item = MAINTENANCE_ITEMS.find((candidato) => candidato.id === itemAberto);

  const manutencao = useQuery({
    queryKey: ['vehicle-maintenance', vehicleId],
    queryFn: () => getVehicleMaintenance(vehicleId),
  });
  const porItem = new Map((manutencao.data ?? []).map((linha) => [linha.item, linha]));

  const aRegistrar = MAINTENANCE_ITEMS.find((candidato) => candidato.id === registrando);
  const lojasProximas = item
    ? item.partners
        .map((loja) => ({
          ...loja,
          distanceKm: position ? distanciaKm(position.coordinates, loja.coordinates) : undefined,
        }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <VehicleCard
        title="Manutenção"
        icon={MaintenanceIcon}
        hint="Escolha o item para ver as lojas parceiras"
      >
        <p className="text-on-light-muted text-label-sm mb-4 flex items-start gap-2 normal-case">
          <PartnerShopIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Rede de parceiros em configuração.</strong> As lojas
            abaixo são referências de catálogo, ainda não contratadas pela sua empresa.
          </span>
        </p>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MAINTENANCE_ITEMS.map((candidato) => {
            const Icon = candidato.icon;
            const aberto = candidato.id === itemAberto;
            const status = porItem.get(candidato.id as MaintenanceStatus['item']);
            const vencimento = frasedoVencimento(status);

            return (
              <li key={candidato.id}>
                <button
                  type="button"
                  /* Clicar de novo fecha: numa grade pequena, o caminho de volta
                     tem de ser o mesmo botão, senão a pessoa procura um X. */
                  onClick={() => setItemAberto(aberto ? null : candidato.id)}
                  aria-expanded={aberto}
                  className={cn(
                    'focus-visible:ring-primary-on-light flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                    aberto
                      ? 'border-primary-on-light/40 bg-primary-on-light/8'
                      : 'border-light-outline hover:border-primary-on-light/30 hover:bg-light-container',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full',
                      aberto ? 'bg-primary-on-light text-on-primary' : 'bg-accent/10 text-accent',
                    )}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="text-on-light text-label-md font-semibold normal-case">
                    {candidato.label}
                  </span>

                  {/* O vencimento vem primeiro, porque é o que muda a decisão de
                      hoje; o intervalo do fabricante é a régua, e fica abaixo. */}
                  <span
                    className={cn('text-label-md font-medium normal-case', TOM[vencimento.tom])}
                  >
                    {vencimento.texto}
                  </span>
                  <span className="text-on-light-muted text-label-sm normal-case">
                    {candidato.interval}
                  </span>
                  <span className="text-on-light-muted text-label-sm normal-case">
                    {candidato.partners.length === 1
                      ? '1 loja parceira'
                      : `${candidato.partners.length} lojas parceiras`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </VehicleCard>

      {item ? (
        <VehicleCard
          title={`Lojas para ${item.label.toLowerCase()}`}
          icon={PartnerShopIcon}
          hint={
            position
              ? 'Ordenadas pela distância em linha reta da última posição do veículo'
              : `${item.description}. Sem posição recente para ordenar por proximidade`
          }
          action={
            /* ⚠️ Desabilitado na demonstração: a placa não existe no servidor, e
               o POST responderia 404 justamente na tela que existe para mostrar
               o desenho pronto. */
            <button
              type="button"
              disabled={demonstracao}
              onClick={() => setRegistrando(item.id)}
              title={
                demonstracao
                  ? 'Veículo de demonstração: não há onde gravar'
                  : `Registrar a troca de ${item.label.toLowerCase()}`
              }
              className="border-primary-on-light/25 text-primary-on-light hover:bg-primary-on-light/10 focus-visible:ring-primary-on-light text-label-md inline-flex shrink-0 items-center gap-2 rounded-pill border px-3.5 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MaintenanceIcon size={15} aria-hidden="true" />
              Registrar troca
            </button>
          }
        >
          <ul className="flex flex-col gap-3">
            {lojasProximas.map((loja) => (
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
      ) : (
        <p className="text-on-light-muted text-label-md flex items-center gap-2 px-1 normal-case">
          <ChevronRightIcon size={15} aria-hidden="true" />
          Escolha um item acima para ver quem atende.
        </p>
      )}

      {aRegistrar ? (
        <MaintenanceEventDialog
          open
          onOpenChange={(aberto) => !aberto && setRegistrando(null)}
          vehicleId={vehicleId}
          item={aRegistrar.id as MaintenanceStatus['item']}
          itemLabel={aRegistrar.label}
          odometroAtual={odometroAtual}
          oficinaSugerida={aRegistrar.partners[0]?.name}
        />
      ) : null}
    </div>
  );
}
