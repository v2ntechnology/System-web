import { GaugeIcon, UserIcon } from '@/components/icons';
import type { Vehicle } from '@/management/types';
import { Link } from 'react-router';
import { km } from '@/management/lib/format';
import truckCargoSide from '@imgs/truckCargoSide.png';
import { YARD_STATUS } from '../yard-status';

const TYPE_LABEL: Record<string, string> = {
  truck: 'Caminhão',
  tractor_unit: 'Cavalo mecânico',
  trailer: 'Carreta',
  van: 'Van',
  light: 'Utilitário',
};

/**
 * Cartão do veículo no pátio.
 *
 * ⚠️ A filial não representa posição de GPS nem vaga cadastrada: é o vínculo do
 * veículo no cadastro do fornecedor.
 *
 * ⚠️ **Ele LEVA à página do veículo desde 16/09/2026**, e por isso voltou a ser
 * um elemento clicável. Enquanto essa página não existia ele era só leitura, de
 * propósito: cartão que parece botão e não leva a lugar nenhum é pior que cartão
 * quieto.
 */
export function YardCard({ vehicle }: { vehicle: Vehicle }) {
  const status = YARD_STATUS[vehicle.status];
  const Icon = status.icon;
  const model = [vehicle.brand, vehicle.model]
    .filter((part) => part && !/n[ãa]o informado/i.test(part))
    .join(' ');
  const driver = vehicle.status === 'EM_VIAGEM' && vehicle.driverName;
  return (
    <Link
      to={`/gestao/patio/${vehicle.plate}`}
      className="yard-vehicle"
      data-tone={status.tone}
      aria-label={`Veículo ${vehicle.plate}, ${status.label}`}
    >
      <div className="yard-vehicle-top">
        <span className="yard-vehicle-type">{TYPE_LABEL[vehicle.type ?? ''] ?? 'Veículo'}</span>
        <span className="yard-status">
          <Icon size={12} aria-hidden="true" />
          {status.label}
        </span>
      </div>
      <div className="yard-vehicle-figure">
        {/*
         * ⚠️ **A MESMA imagem em todos os cartões** (escolha do usuário em
         * 16/09/2026, no lugar do vetor isométrico). Ela é o veículo genérico do
         * pátio, e não a foto daquele caminhão: a foto do fornecedor continua
         * fora da grade, pelo motivo de sempre, que numa grade de quarenta
         * quadrinhos cada foto diferente rouba o olho da placa.
         *
         * ⚠️ Van e carreta aparecem desenhadas como caminhão, então o TIPO
         * continua escrito acima. Um desenho por tipo volta trocando esta linha
         * por um mapa, como o vetor anterior fazia.
         */}
        <img
          src={truckCargoSide}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          className="yard-truck"
        />
      </div>
      <div className="yard-vehicle-info">
        <div className="yard-plate-row">
          <span className="yard-plate">{vehicle.plate}</span>
          {vehicle.internalCode && (
            <span className="yard-fleet-code" title={`Frota ${vehicle.internalCode}`}>
              #{vehicle.internalCode}
            </span>
          )}
        </div>
        <p className="yard-model" title={model}>
          {model || 'Modelo não informado'}
        </p>
        <div className="yard-vehicle-footer">
          {driver ? (
            <UserIcon size={13} aria-hidden="true" />
          ) : (
            <GaugeIcon size={13} aria-hidden="true" />
          )}
          <span title={driver || undefined}>{driver || `${km.format(vehicle.odometerKm)} km`}</span>
        </div>
      </div>
    </Link>
  );
}
