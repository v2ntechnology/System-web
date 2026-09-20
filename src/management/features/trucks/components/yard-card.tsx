import { DeleteIcon, EditIcon, FileIcon, GaugeIcon, PowerIcon, UserIcon } from '@/components/icons';
import type { VehicleListEntry } from '@/management/lib/fleet-api';
import type { Vehicle } from '@/management/types';
import { READINESS_LABEL, type VehicleReadiness } from '@/management/features/documents/types';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
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

export interface YardCardProps {
  vehicle: Vehicle;
  /**
   * A mesma placa vista pelo CADASTRO, quando ela existe lá.
   *
   * ⚠️ São duas origens e dois tipos: o cartão desenha `Vehicle`, que vem da
   * telemetria e **não tem `active`**, e as ações escrevem sobre
   * `VehicleListEntry`, que é o cadastro. Sem esta ficha não dá para dizer se o
   * botão de energia ativa ou inativa, então as ações não aparecem.
   */
  registry?: VehicleListEntry | undefined;
  /**
   * O que o DETRAN diz sobre este veículo, quando já sabemos.
   *
   * ⚠️ **Marca, e não trava** (decisão do usuário em 19/09/2026). O cartão
   * continua abrindo a ficha, o veículo continua no estado que a telemetria
   * informa e nenhuma ação some por causa dela. Quem decide se o caminhão sai é
   * o gestor, e para isso ele precisa ver o motivo, não um cadeado.
   */
  readiness?: VehicleReadiness | undefined;
  onEditar?: ((registry: VehicleListEntry) => void) | undefined;
  onAlternar?: ((registry: VehicleListEntry) => void) | undefined;
  onExcluir?: ((registry: VehicleListEntry) => void) | undefined;
}

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
 *
 * ⚠️ **Deixou de ser `<a>` em 18/09/2026**, quando o cadastro entrou aqui: botão
 * dentro de âncora é HTML inválido, e o navegador trata o clique no botão como
 * clique no link. O corpo virou `role="button"` com `navigate`, que é o mesmo
 * desenho que a tela de Equipe já usa no cartão de pessoa. Quem chega por teclado
 * continua abrindo com Enter e espaço.
 */
export function YardCard({
  vehicle,
  registry,
  readiness,
  onEditar,
  onAlternar,
  onExcluir,
}: YardCardProps) {
  const navigate = useNavigate();
  const status = YARD_STATUS[vehicle.status];
  const Icon = status.icon;
  const model = [vehicle.brand, vehicle.model]
    .filter((part) => part && !/n[ãa]o informado/i.test(part))
    .join(' ');
  const driver = vehicle.status === 'EM_VIAGEM' && vehicle.driverName;
  const abrirFicha = () => navigate(`/gestao/patio/${vehicle.plate}`);
  const acoes = registry ? [onEditar, onAlternar, onExcluir].some(Boolean) : false;
  /* Documentação em dia não desenha nada: um selo repetido em 25 dos 40 cartões
     vira o fundo da grade, e o que precisa saltar é a exceção. */
  const documento = readiness && readiness.level !== 'REGULAR' ? readiness : undefined;

  return (
    <div
      className="yard-vehicle"
      data-tone={status.tone}
      data-acoes={acoes ? 'true' : undefined}
      role="button"
      tabIndex={0}
      /* O selo é cor E texto, e o texto também chega a quem navega por leitor de
         tela: sem isto o cartão anunciaria só a situação da telemetria. */
      aria-label={`Veículo ${vehicle.plate}, ${status.label}${
        documento ? `, ${READINESS_LABEL[documento.level].toLowerCase()}` : ''
      }`}
      onClick={abrirFicha}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrirFicha();
        }
      }}
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
        {documento ? (
          /*
           * ⚠️ O motivo inteiro fica na dica do mouse, e não na linha: o cartão
           * tem 190px e "Licenciamento parado no exercício 2025" quebraria em
           * três linhas, empurrando a placa para fora da grade alinhada.
           */
          <span
            className="yard-doc-flag"
            data-level={documento.level}
            title={documento.reasons.join(' · ') || undefined}
          >
            <FileIcon size={12} aria-hidden="true" />
            {READINESS_LABEL[documento.level]}
          </span>
        ) : null}
        <div className="yard-vehicle-footer">
          {driver ? (
            <UserIcon size={13} aria-hidden="true" />
          ) : (
            <GaugeIcon size={13} aria-hidden="true" />
          )}
          <span title={driver || undefined}>{driver || `${km.format(vehicle.odometerKm)} km`}</span>
        </div>
      </div>

      {/*
       * ⚠️ `stopPropagation` em cada botão: o corpo do cartão navega, e sem isso
       * abrir o modal de edição jogaria a pessoa na ficha ao mesmo tempo.
       */}
      {acoes && registry ? (
        <div className="yard-vehicle-actions acoes-divididas">
          {onEditar ? (
            <button
              type="button"
              className="acao-editar"
              onClick={(event) => {
                event.stopPropagation();
                onEditar(registry);
              }}
              aria-label={`Editar cadastro do ${vehicle.plate}`}
              title="Editar cadastro"
            >
              <EditIcon size={17} aria-hidden="true" />
            </button>
          ) : null}
          {onAlternar ? (
            <button
              type="button"
              className={registry.active ? 'acao-excluir' : 'acao-ativar'}
              onClick={(event) => {
                event.stopPropagation();
                onAlternar(registry);
              }}
              aria-label={`${registry.active ? 'Inativar' : 'Ativar'} ${vehicle.plate}`}
              title={registry.active ? 'Inativar veículo' : 'Ativar veículo'}
            >
              <PowerIcon size={17} aria-hidden="true" />
            </button>
          ) : null}
          {onExcluir ? (
            <button
              type="button"
              className="acao-excluir"
              onClick={(event) => {
                event.stopPropagation();
                onExcluir(registry);
              }}
              aria-label={`Excluir cadastro do ${vehicle.plate}`}
              title="Excluir cadastro"
            >
              <DeleteIcon size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
