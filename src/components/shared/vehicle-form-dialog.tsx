import { SpinnerIcon } from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

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
                <Input
                  id="year"
                  type="number"
                  aria-invalid={Boolean(errors.year)}
                  {...register('year', { valueAsNumber: true })}
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
                <Input
                  id="mileageKm"
                  type="number"
                  aria-invalid={Boolean(errors.mileageKm)}
                  {...register('mileageKm', { valueAsNumber: true })}
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
