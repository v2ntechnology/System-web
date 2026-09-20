import { integerToMask, onlyDigits, parseInteger } from '@/lib/input-masks';
import { SpinnerIcon } from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormSection } from '@/components/shared/form-section';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateVehicle, useVehicleUnits } from '@/hooks/use-queries';
import { VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL } from '@/mocks/fleet/vehicles';
import type { VehicleStatus, VehicleType } from '@/types';

import {
  DEFAULT_VEHICLE_FORM,
  vehicleFormSchema,
  type VehicleFormValues,
} from '@/lib/vehicle-schema';

const TYPES = Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[];
const STATUSES = Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[];

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleFormDialog({ open, onOpenChange }: VehicleFormDialogProps) {
  const { data: units } = useVehicleUnits();
  const createVehicle = useCreateVehicle();
  const [confirmClose, setConfirmClose] = useState(false);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: DEFAULT_VEHICLE_FORM,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const selectedType = useWatch({ control, name: 'type' });
  const selectedUnit = useWatch({ control, name: 'unit' });
  const selectedStatus = useWatch({ control, name: 'status' });

  function requestClose() {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      onOpenChange(false);
    }
  }

  async function onSubmit(values: VehicleFormValues) {
    await createVehicle.mutateAsync(values);
    reset(DEFAULT_VEHICLE_FORM);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar veículo</DialogTitle>
            <DialogDescription>
              Preencha os dados do veículo. Os campos são validados antes do envio.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <FormSection title="Identificação">
              <div className="space-y-2">
                <Label htmlFor="plate">Placa</Label>
                <Input
                  id="plate"
                  placeholder="ABC-1D23"
                  aria-invalid={Boolean(errors.plate)}
                  {...register('plate')}
                />
                {errors.plate && <p className="text-xs text-destructive">{errors.plate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fleetNumber">Prefixo / nº de frota</Label>
                <Input
                  id="fleetNumber"
                  placeholder="F-1234"
                  aria-invalid={Boolean(errors.fleetNumber)}
                  {...register('fleetNumber')}
                />
                {errors.fleetNumber && (
                  <p className="text-xs text-destructive">{errors.fleetNumber.message}</p>
                )}
              </div>
            </FormSection>

            <FormSection title="Especificações">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  placeholder="Volvo"
                  aria-invalid={Boolean(errors.manufacturer)}
                  {...register('manufacturer')}
                />
                {errors.manufacturer && (
                  <p className="text-xs text-destructive">{errors.manufacturer.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  placeholder="FH 540"
                  aria-invalid={Boolean(errors.model)}
                  {...register('model')}
                />
                {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                {/*
                 * ⚠️ **`type="number"` saiu daqui em 19/09/2026.** Ele bloqueia
                 * a letra, mas aceita `e`, `+` e `-`, mostra as setinhas de
                 * incremento num ano de fabricação e, o que mais pesa, **não
                 * deixa formatar**: o navegador recusa qualquer valor com ponto,
                 * então quilometragem nunca poderia mostrar o milhar.
                 *
                 * No lugar dele, campo de texto com máscara e teclado numérico.
                 * O estado do formulário continua NÚMERO, convertido no
                 * `onChange`, então o schema de validação não muda.
                 */}
                <Controller
                  control={control}
                  name="year"
                  render={({ field }) => (
                    <Input
                      id="year"
                      inputMode="numeric"
                      placeholder="2023"
                      aria-invalid={Boolean(errors.year)}
                      value={field.value == null || Number.isNaN(field.value) ? '' : field.value}
                      onChange={(e) => {
                        const digits = onlyDigits(e.target.value, 4);
                        field.onChange(digits === '' ? undefined : Number(digits));
                      }}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={selectedType}
                  onValueChange={(v) => setValue('type', v as VehicleType, { shouldDirty: true })}
                >
                  <SelectTrigger id="type" aria-invalid={Boolean(errors.type)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {VEHICLE_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
            </FormSection>

            <FormSection title="Operação">
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Select
                  value={selectedUnit}
                  onValueChange={(v) => setValue('unit', v, { shouldDirty: true })}
                >
                  <SelectTrigger id="unit" aria-invalid={Boolean(errors.unit)}>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {(units ?? []).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mileageKm">Quilometragem (km)</Label>
                {/* Quilometragem com separador de milhar: o painel do caminhão
                    mostra 312.450, e o campo tem de parecer com ele. */}
                <Controller
                  control={control}
                  name="mileageKm"
                  render={({ field }) => (
                    <Input
                      id="mileageKm"
                      inputMode="numeric"
                      placeholder="312.450"
                      aria-invalid={Boolean(errors.mileageKm)}
                      value={Number.isNaN(field.value) ? '' : integerToMask(field.value)}
                      onChange={(e) => field.onChange(parseInteger(e.target.value) ?? undefined)}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.mileageKm && (
                  <p className="text-xs text-destructive">{errors.mileageKm.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(v) =>
                    setValue('status', v as VehicleStatus, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="status" aria-invalid={Boolean(errors.status)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {VEHICLE_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-xs text-destructive">{errors.status.message}</p>
                )}
              </div>
            </FormSection>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                Salvar veículo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Descartar alterações?"
        description="Você tem alterações não salvas. Se sair agora, elas serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="destructive"
        onConfirm={() => {
          reset(DEFAULT_VEHICLE_FORM);
          onOpenChange(false);
        }}
      />
    </>
  );
}
