import { CheckIcon, InfoIcon, WarningIcon } from '@/components/icons';
import {
  fetchVehicleRegistry,
  saveVehicleRegistry,
  type VehicleRegistry,
  type VehicleRegistryPatch,
} from '@/management/lib/fleet-api';
import { Checkbox, GlassDateField, GlassInput, SpectrumButton, Spinner, cn } from '@/management/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * O cadastro que a operação edita.
 *
 * <h2>Não há botão de criar caminhão, e não é esquecimento</h2>
 *
 * ⚠️ A frota vem do fornecedor de telemetria: um veículo aparece quando o
 * rastreador dele existe. Uma placa criada à mão nunca reportaria posição e
 * ficaria para sempre como "sem sinal" no mapa, ao lado de caminhões de verdade
 * que perderam sinal, sem ninguém conseguir separar os dois casos.
 *
 * O que a operação possui é o que a telemetria NÃO sabe: o número pintado na
 * porta, quando é a próxima revisão, por que o caminhão está parado e a
 * observação interna.
 *
 * <h2>Salva só o que mudou</h2>
 *
 * O backend distingue três estados por campo: ausente preserva, com valor
 * grava, nulo apaga. Enviar o formulário inteiro apagaria o que o usuário nem
 * abriu, então o que vai no corpo é a diferença contra o que foi carregado.
 */

const numero = (valor: number | undefined) =>
  valor == null ? '–' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const dataLonga = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

interface Formulario {
  internalCode: string;
  manualNotes: string;
  nextMaintenanceKm: string;
  nextMaintenanceDate: string;
  outOfService: boolean;
  outOfServiceReason: string;
}

const paraFormulario = (registro: VehicleRegistry): Formulario => ({
  internalCode: registro.internalCode ?? '',
  manualNotes: registro.manualNotes ?? '',
  nextMaintenanceKm: registro.nextMaintenanceKm == null ? '' : String(registro.nextMaintenanceKm),
  nextMaintenanceDate: registro.nextMaintenanceDate ?? '',
  outOfService: registro.outOfService,
  outOfServiceReason: registro.outOfServiceReason ?? '',
});

/** Campo de texto em branco vira nulo: apagar na tela precisa apagar no banco. */
const texto = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

/** A diferença contra o que foi carregado. Ver a nota do componente. */
function diferenca(atual: Formulario, original: Formulario): VehicleRegistryPatch {
  const patch: VehicleRegistryPatch = {};

  if (atual.internalCode !== original.internalCode) {
    patch.internalCode = texto(atual.internalCode);
  }
  if (atual.manualNotes !== original.manualNotes) {
    patch.manualNotes = texto(atual.manualNotes);
  }
  if (atual.nextMaintenanceKm !== original.nextMaintenanceKm) {
    const cru = atual.nextMaintenanceKm.trim();
    patch.nextMaintenanceKm = cru === '' ? null : Number(cru);
  }
  if (atual.nextMaintenanceDate !== original.nextMaintenanceDate) {
    patch.nextMaintenanceDate = texto(atual.nextMaintenanceDate);
  }
  if (atual.outOfService !== original.outOfService) {
    patch.outOfService = atual.outOfService;
  }
  if (atual.outOfServiceReason !== original.outOfServiceReason) {
    patch.outOfServiceReason = texto(atual.outOfServiceReason);
  }

  return patch;
}

export interface VehicleRegistryCardProps {
  vehicleId: string;
  className?: string | undefined;
}

export function VehicleRegistryCard({ vehicleId, className }: VehicleRegistryCardProps) {
  const cliente = useQueryClient();

  const registro = useQuery({
    queryKey: ['vehicle-registry', vehicleId],
    queryFn: () => fetchVehicleRegistry(vehicleId),
  });

  if (registro.isPending) {
    return (
      <div className={cn('flex justify-center py-8', className)}>
        <Spinner className="text-on-surface-muted size-5" label="Carregando o cadastro" />
      </div>
    );
  }

  if (registro.isError || !registro.data) {
    return (
      <p className={cn('text-error text-body-md py-8 text-center', className)}>
        Não foi possível carregar o cadastro deste veículo.
      </p>
    );
  }

  /* `key` com o identificador: trocar de veículo REMONTA o formulário. Sem
     isso, o texto digitado num caminhão apareceria no próximo. */
  return (
    <Formulario
      key={vehicleId}
      vehicleId={vehicleId}
      registro={registro.data}
      onSalvo={() => {
        /* A situação do veículo muda com "fora de operação", então a lista
           precisa recarregar junto: senão o chip continua verde ao lado de um
           caminhão que acabou de ir para a oficina. */
        void cliente.invalidateQueries({ queryKey: ['vehicles'] });
        void cliente.invalidateQueries({ queryKey: ['vehicle-registry', vehicleId] });
      }}
      className={className}
    />
  );
}

function Formulario({
  vehicleId,
  registro,
  onSalvo,
  className,
}: {
  vehicleId: string;
  registro: VehicleRegistry;
  onSalvo: () => void;
  className?: string | undefined;
}) {
  const [original, setOriginal] = useState(() => paraFormulario(registro));
  const [form, setForm] = useState(() => paraFormulario(registro));
  const [salvo, setSalvo] = useState(false);

  const patch = diferenca(form, original);
  const mudou = Object.keys(patch).length > 0;

  const salvar = useMutation({
    mutationFn: () => saveVehicleRegistry(vehicleId, patch),
    onSuccess: (atualizado) => {
      const novo = paraFormulario(atualizado);
      setOriginal(novo);
      setForm(novo);
      setSalvo(true);
      onSalvo();
    },
  });

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => {
    setSalvo(false);
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const vencida = registro.kmToMaintenance != null && registro.kmToMaintenance < 0;

  return (
    <form
      className={cn('flex flex-col gap-4', className)}
      onSubmit={(evento) => {
        evento.preventDefault();
        if (mudou) salvar.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassInput
          label="Código interno"
          hint="O número pintado na porta"
          value={form.internalCode}
          onChange={(evento) => alterar('internalCode', evento.target.value)}
          maxLength={40}
        />

        <GlassInput
          label="Próxima revisão (km)"
          hint={
            registro.kmToMaintenance == null
              ? 'odômetro em que a revisão vence'
              : vencida
                ? `vencida há ${numero(Math.abs(registro.kmToMaintenance))} km`
                : `faltam ${numero(registro.kmToMaintenance)} km`
          }
          value={form.nextMaintenanceKm}
          onChange={(evento) =>
            alterar('nextMaintenanceKm', evento.target.value.replace(/\D/g, ''))
          }
          inputMode="numeric"
        />

        <GlassDateField
          label="Próxima revisão (data)"
          value={form.nextMaintenanceDate}
          onValueChange={(valor) => alterar('nextMaintenanceDate', valor)}
        />

        <GlassInput
          label="Observação da operação"
          hint="Não é sobrescrita pela sincronização"
          value={form.manualNotes}
          onChange={(evento) => alterar('manualNotes', evento.target.value)}
          maxLength={500}
        />
      </div>

      <div className="border-outline-variant flex flex-col gap-3 border-t pt-4">
        {/* O status derivado da telemetria não sabe distinguir oficina de
            rastreador mudo. Só quem opera sabe, e é por isso que existe esta
            caixa. */}
        <Checkbox
          label="Fora de operação"
          description="Tira o caminhão da conta de frota disponível até alguém devolver"
          checked={form.outOfService}
          onCheckedChange={(marcado) => alterar('outOfService', marcado === true)}
        />

        {form.outOfService ? (
          <GlassInput
            label="Motivo"
            hint="Sem o motivo, o status vira um sinal sem explicação"
            value={form.outOfServiceReason}
            onChange={(evento) => alterar('outOfServiceReason', evento.target.value)}
            maxLength={200}
          />
        ) : null}

        {registro.outOfService && registro.outOfServiceSince ? (
          <p className="text-warning text-label-md flex items-center gap-1.5 normal-case">
            <WarningIcon size={14} aria-hidden="true" />
            Parado desde {dataLonga.format(new Date(registro.outOfServiceSince))}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-on-surface-muted text-label-md flex items-center gap-1.5 normal-case">
          {salvar.isError ? (
            <span className="text-error flex items-center gap-1.5">
              <WarningIcon size={14} aria-hidden="true" />
              Não foi possível salvar. Tente de novo.
            </span>
          ) : salvo ? (
            <span className="text-success flex items-center gap-1.5">
              <CheckIcon size={14} aria-hidden="true" />
              Salvo
            </span>
          ) : registro.updatedAt ? (
            <>
              <InfoIcon size={14} aria-hidden="true" />
              Editado em {dataLonga.format(new Date(registro.updatedAt))}
              {registro.updatedByName ? ` por ${registro.updatedByName}` : ''}
            </>
          ) : (
            <>
              <InfoIcon size={14} aria-hidden="true" />
              Estes campos não vêm da telemetria: quem preenche é a operação
            </>
          )}
        </p>

        <SpectrumButton type="submit" disabled={!mudou || salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar cadastro'}
        </SpectrumButton>
      </div>
    </form>
  );
}
