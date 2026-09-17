import { ClockIcon, MessageIcon, PhoneIcon, SteeringWheelIcon, UserIcon } from '@/components/icons';

import { km } from '@/management/lib/format';
import type { Vehicle, VehicleDetail } from '@/management/types';
import { Avatar, cn } from '@/management/ui';

import { VehicleCard } from './vehicle-telemetry-cards';

const hora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Só dígitos: `tel:` e o WhatsApp recusam telefone com pontuação. */
const somenteDigitos = (telefone: string) => telefone.replace(/\D/g, '');

/**
 * Quem está com o veículo agora.
 *
 * <h2>⚠️ "Agora" tem duas origens, e elas discordam</h2>
 *
 * O vínculo do cadastro (`driverName` do veículo) diz quem a telemetria aponta
 * como condutor atual; os eventos recentes dizem quem estava ao volante quando
 * cada ocorrência foi registrada. A tela mostra a oficial em destaque e o último
 * registro embaixo, em vez de escolher uma e esconder a divergência.
 *
 * <h2>⚠️ Ligar e mandar mensagem dependem do TELEFONE, que esta rota não traz</h2>
 *
 * O veículo entrega o NOME do condutor, e o telefone mora na ficha do motorista,
 * que é buscada por id. Esta rota não devolve o id, então nos veículos reais os
 * dois botões aparecem **desabilitados, dizendo o porquê**, em vez de sumirem: o
 * lugar deles no desenho é informação, e esconder faria a ficha mudar de forma
 * conforme o dado. Na placa de demonstração o telefone existe e eles funcionam.
 */
export function VehicleDriverCard({
  vehicle,
  detail,
  telefone,
}: {
  vehicle: Vehicle;
  detail?: VehicleDetail | undefined;
  /** Telefone do condutor, quando conhecido. */
  telefone?: string | undefined;
}) {
  const emViagem = vehicle.status === 'EM_VIAGEM';
  const condutor = vehicle.driverName?.trim();
  const ultimoEvento = detail?.recentEvents?.[0];
  const digitos = telefone ? somenteDigitos(telefone) : '';

  const acao =
    'flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-on-light';
  const ativo = 'border-primary-on-light/25 text-primary-on-light hover:bg-primary-on-light/10';
  const inerte = 'border-light-outline text-on-light-muted/60 cursor-not-allowed';
  const semTelefone = condutor
    ? 'O telefone do motorista não vem nesta rota da API'
    : 'Ninguém ao volante para contatar';

  return (
    <VehicleCard
      title="Quem está dirigindo"
      icon={SteeringWheelIcon}
      hint={emViagem ? 'Condutor do vínculo atual' : 'O veículo não está em viagem'}
      action={
        <div className="flex shrink-0 gap-2">
          {digitos ? (
            <a
              href={`tel:+${digitos}`}
              title={`Ligar para ${condutor}`}
              aria-label={`Ligar para ${condutor}`}
              className={cn(acao, ativo)}
            >
              <PhoneIcon size={16} aria-hidden="true" />
            </a>
          ) : (
            <span title={semTelefone} aria-disabled="true" className={cn(acao, inerte)}>
              <PhoneIcon size={16} aria-hidden="true" />
              <span className="sr-only">Ligar, indisponível: {semTelefone}</span>
            </span>
          )}

          {digitos ? (
            <a
              /* WhatsApp: é por onde a operação fala com motorista, e abre no
                 aplicativo ou no navegador sem precisar de integração nossa. */
              href={`https://wa.me/${digitos}`}
              target="_blank"
              rel="noreferrer"
              title={`Mandar mensagem para ${condutor}`}
              aria-label={`Mandar mensagem para ${condutor}`}
              className={cn(acao, ativo)}
            >
              <MessageIcon size={16} aria-hidden="true" />
            </a>
          ) : (
            <span title={semTelefone} aria-disabled="true" className={cn(acao, inerte)}>
              <MessageIcon size={16} aria-hidden="true" />
              <span className="sr-only">Mensagem, indisponível: {semTelefone}</span>
            </span>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col justify-between gap-4">
        {condutor ? (
          <div className="flex items-center gap-3">
            <Avatar name={condutor} className="size-12" />
            <div className="min-w-0">
              <p className="text-on-light text-body-md truncate font-semibold">{condutor}</p>
              <p className="text-on-light-muted text-label-sm normal-case">
                {emViagem ? 'Ao volante agora' : 'Vinculado, com o veículo parado'}
              </p>
              {telefone ? (
                <p className="text-on-light-variant text-label-sm tabular mt-0.5 normal-case">
                  {telefone}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="bg-light-container text-on-light-muted flex size-12 shrink-0 items-center justify-center rounded-full">
              <UserIcon size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-on-light text-body-md font-semibold">Ninguém ao volante</p>
              <p className="text-on-light-muted text-label-sm normal-case">
                A telemetria não aponta condutor para este veículo agora.
              </p>
            </div>
          </div>
        )}

        {/*
         * ⚠️ O MEIO DO CARTÃO É DADO REAL, e existe para fechar um buraco: numa
         * linha em que o vizinho é o mapa, o cartão esticava e sobrava meia
         * altura vazia. Odômetro e sincronização valem para QUALQUER veículo,
         * inclusive os que não têm condutor, então o buraco não volta.
         */}
        <dl className="border-light-outline space-y-2 border-t pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-on-light-muted text-label-sm normal-case">Odômetro</dt>
            <dd className="text-on-light-variant text-label-md tabular normal-case">
              {km.format(vehicle.odometerKm)} km
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-on-light-muted text-label-sm normal-case">Sincronizado</dt>
            <dd className="text-on-light-variant text-label-md tabular normal-case">
              {vehicle.lastSyncAt ? hora.format(new Date(vehicle.lastSyncAt)) : 'nunca reportou'}
            </dd>
          </div>
        </dl>

        {ultimoEvento ? (
          <div className="border-light-outline border-t pt-3">
            <p className="text-on-light-muted text-label-sm flex items-center gap-1.5 normal-case">
              <ClockIcon size={13} aria-hidden="true" />
              Último registro de condução
            </p>
            <p className="text-on-light-variant text-label-md mt-1 normal-case">
              {ultimoEvento.label} em {hora.format(new Date(ultimoEvento.at))}
            </p>
          </div>
        ) : null}
      </div>
    </VehicleCard>
  );
}
