import { GlassModal } from '@/management/ui';

import { VehicleRegistryForm } from './vehicle-registry-form';

/**
 * A ficha do veículo dentro de um diálogo, para a tela de cadastro de frota.
 *
 * O mesmo diálogo cadastra e edita, como o de motorista: são os mesmos campos, e
 * o que muda é só o título e o que acontece ao salvar. Duas telas divergiriam na
 * primeira vez que alguém acrescentasse um campo em uma só.
 *
 * ⚠️ Cadastrar cria um caminhão **sem rastreador**, e a ficha diz isso na cara.
 * Ele nunca vai reportar posição, então a lista mostra "sem rastreador" no lugar
 * de "sem sinal": a primeira é uma escolha de cadastro e não pede nada de
 * ninguém, a segunda é um problema que leva alguém a ligar para a filial.
 */
export interface VehicleRegistryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nulo abre em branco para cadastrar uma placa nova. */
  vehicleId: string | null;
  /** A placa vai no título: quem abriu clicou numa linha, e é assim que reconhece. */
  plate: string | null;
}

export function VehicleRegistryModal({
  open,
  onOpenChange,
  vehicleId,
  plate,
}: VehicleRegistryModalProps) {
  const criando = vehicleId == null;

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={criando ? 'Cadastrar caminhão' : `Cadastro do ${plate ?? 'veículo'}`}
      description={
        criando
          ? 'Para o caminhão que a telemetria ainda não conhece. Ele entra na frota sem rastreador.'
          : 'Ficha técnica, documentação, propriedade e o que a operação preenche.'
      }
      className="w-[calc(100vw-2rem)] max-w-[760px]"
    >
      {/* Rola dentro do diálogo, e não na página: a ficha tem cinco seções e não
          cabe na altura da tela. A barra de rolagem é invisível no sistema
          inteiro (19/08/2026), então o `pb` garante que o último campo não
          encoste na borda e pareça cortado. */}
      <div className="overflow-y-auto px-5 pb-6 sm:px-6">
        {/* Só monta quando o diálogo está aberto. Sem a guarda, fechar dispararia
            uma consulta durante a animação de saída. */}
        {open ? (
          <VehicleRegistryForm vehicleId={vehicleId} onSaved={() => onOpenChange(false)} />
        ) : null}
      </div>
    </GlassModal>
  );
}
