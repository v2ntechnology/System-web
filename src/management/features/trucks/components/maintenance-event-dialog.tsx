import { MaintenanceIcon } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { addMaintenanceEvent, type MaintenanceItemId } from '@/management/lib/fleet-api';
import { GlassDateField, GlassInput, GlassModal, SpectrumButton } from '@/management/ui';

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Registrar uma troca.
 *
 * <h2>⚠️ O odômetro vem preenchido com o do veículo, e é editável</h2>
 *
 * Quem registra quase sempre está lançando a troca de hoje, e digitar seis
 * dígitos que o sistema já sabe é trabalho à toa. Editável porque o lançamento
 * atrasado é o caso comum na operação: a nota da oficina chega dias depois, e
 * aí o odômetro certo é o daquele dia, não o de agora.
 *
 * ⚠️ **Só a data é obrigatória.** Odômetro, oficina, custo e observação faltam
 * com frequência em lançamento retroativo, e exigi-los faria a operação inventar
 * número para conseguir salvar, que é pior que o campo vazio.
 */
export function MaintenanceEventDialog({
  open,
  onOpenChange,
  vehicleId,
  item,
  itemLabel,
  odometroAtual,
  oficinaSugerida,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  item: MaintenanceItemId;
  itemLabel: string;
  odometroAtual?: number | undefined;
  /** Vem preenchida quando a troca foi lançada a partir de uma loja da lista. */
  oficinaSugerida?: string | undefined;
}) {
  const [data, setData] = useState(hoje);
  const [odometro, setOdometro] = useState(
    odometroAtual == null ? '' : String(Math.round(odometroAtual)),
  );
  const [oficina, setOficina] = useState(oficinaSugerida ?? '');
  const [custo, setCusto] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const gravar = useMutation({
    mutationFn: () =>
      addMaintenanceEvent(vehicleId, {
        item,
        doneAt: data,
        odometerKm: odometro.trim() ? Number(odometro) : undefined,
        partnerName: oficina.trim() || undefined,
        /* Vírgula é como se digita dinheiro em português, e `Number` não a
           entende: sem a troca, "890,50" viraria `NaN` e o custo sumiria. */
        cost: custo.trim() ? Number(custo.replace('.', '').replace(',', '.')) : undefined,
        notes: observacao.trim() || undefined,
      }),
    onSuccess: async () => {
      /* O vencimento é calculado no servidor: invalidar é o que traz o número
         novo, e recalcular aqui criaria a segunda regra que este desenho evita. */
      await queryClient.invalidateQueries({ queryKey: ['vehicle-maintenance', vehicleId] });
      onOpenChange(false);
    },
    onError: (falha: unknown) =>
      setErro(falha instanceof Error ? falha.message : 'Não foi possível registrar a troca.'),
  });

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Registrar troca: ${itemLabel.toLowerCase()}`}
      description="O vencimento do item passa a contar a partir desta data."
      icon={<MaintenanceIcon size={20} aria-hidden="true" />}
      className="max-w-[560px]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5 sm:px-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          setErro(null);
          gravar.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassDateField
            id="troca-data"
            label="Data da troca"
            value={data}
            onValueChange={setData}
          />
          <GlassInput
            id="troca-odometro"
            label="Odômetro (km)"
            inputMode="numeric"
            value={odometro}
            onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, ''))}
          />
          <GlassInput
            id="troca-oficina"
            label="Oficina"
            placeholder="Quem fez o serviço"
            value={oficina}
            onChange={(evento) => setOficina(evento.target.value)}
          />
          <GlassInput
            id="troca-custo"
            label="Custo (R$)"
            inputMode="decimal"
            placeholder="890,50"
            value={custo}
            onChange={(evento) => setCusto(evento.target.value)}
          />
        </div>

        <GlassInput
          id="troca-observacao"
          label="Observação"
          placeholder="O que foi feito, peça usada, garantia"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />

        {erro ? <p className="text-error text-body-md">{erro}</p> : null}

        <div className="border-outline-variant -mx-5 mt-2 flex justify-end gap-3 border-t px-5 pt-4 sm:-mx-6 sm:px-6">
          <SpectrumButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="submit" size="sm" disabled={gravar.isPending || !data}>
            {gravar.isPending ? 'Registrando…' : 'Registrar troca'}
          </SpectrumButton>
        </div>
      </form>
    </GlassModal>
  );
}
