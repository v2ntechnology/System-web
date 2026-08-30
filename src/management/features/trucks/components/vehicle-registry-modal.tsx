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
 *
 * <h2>A barra de ações fica colada embaixo</h2>
 *
 * Decisão do usuário em 30/08/2026, seguindo o cadastro de motorista. Aqui o
 * ganho é maior: a ficha tem cinco seções e mais de vinte campos, então o botão
 * de gravar ficava a três telas de rolagem do começo.
 *
 * ⚠️ Este componente **não** aplica padding nem rolagem próprios. Quem rola é o
 * corpo do formulário, e é isso que segura a barra embaixo: um `overflow-y-auto`
 * aqui rolaria o formulário inteiro, barra junto, e a colagem se perderia.
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
      {/* Só monta quando o diálogo está aberto. Sem a guarda, fechar dispararia
          uma consulta durante a animação de saída. */}
      {open ? (
        <VehicleRegistryForm
          vehicleId={vehicleId}
          onSaved={() => onOpenChange(false)}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </GlassModal>
  );
}
