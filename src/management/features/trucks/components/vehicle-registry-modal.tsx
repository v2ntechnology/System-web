import { GlassModal } from '@/management/ui';

import { VehicleRegistryCard } from './vehicle-registry-card';

/**
 * A ficha do veículo dentro de um diálogo, para a tela de cadastro de frota.
 *
 * <h2>Por que envolver em vez de duplicar</h2>
 *
 * O formulário é o mesmo do painel de detalhe do caminhão, e precisa continuar
 * sendo: são os mesmos campos, a mesma regra de "ausente preserva, nulo apaga" e
 * o mesmo aviso de que aquilo não vem da telemetria. Uma segunda cópia
 * divergiria na primeira vez que alguém acrescentasse um campo em um lado só.
 *
 * ⚠️ **Não existe modo de cadastrar**, ao contrário do diálogo de motorista. Um
 * caminhão só existe para a plataforma porque tem rastreador: placa criada à mão
 * nunca reportaria posição e ficaria para sempre como "sem sinal" no mapa, ao
 * lado de caminhões de verdade que perderam sinal. O que esta tela faz é
 * corrigir e conferir o que chegou, não inventar frota.
 */
export interface VehicleRegistryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={plate ? `Cadastro do ${plate}` : 'Cadastro do veículo'}
      description="O que a telemetria não entrega: número interno, revisão e por que o caminhão está parado."
      className="w-[calc(100vw-2rem)] max-w-[640px]"
    >
      <div className="px-5 pb-5 sm:px-6">
        {/* Só monta com identificador. Sem a guarda, fechar o diálogo dispararia
            uma consulta com `null` no caminho da URL durante a animação de
            saída. */}
        {vehicleId ? <VehicleRegistryCard vehicleId={vehicleId} /> : null}
      </div>
    </GlassModal>
  );
}
