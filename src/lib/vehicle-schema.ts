import { z } from 'zod';

const PLATE_REGEX = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;
const currentYear = new Date().getFullYear();

export const vehicleFormSchema = z.object({
  plate: z
    .string()
    .min(1, 'Informe a placa.')
    .regex(PLATE_REGEX, 'Placa inválida. Use o formato ABC-1D23 ou ABC-1234.'),
  fleetNumber: z.string().min(1, 'Informe o número de frota.'),
  manufacturer: z.string().min(2, 'Informe o fabricante.'),
  model: z.string().min(1, 'Informe o modelo.'),
  year: z
    .number({ error: 'Informe um ano válido.' })
    .int('Informe um ano válido.')
    .min(1990, 'Ano deve ser a partir de 1990.')
    .max(currentYear + 1, `Ano não pode ser maior que ${currentYear + 1}.`),
  type: z.enum(['truck', 'tractor_unit', 'trailer', 'van', 'light'], {
    error: 'Selecione o tipo do veículo.',
  }),
  unit: z.string().min(1, 'Selecione a unidade.'),
  mileageKm: z
    .number({ error: 'Informe a quilometragem.' })
    .min(0, 'A quilometragem não pode ser negativa.'),
  status: z.enum(['on_trip', 'available', 'maintenance', 'stopped', 'alert'], {
    error: 'Selecione o status.',
  }),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export const DEFAULT_VEHICLE_FORM: VehicleFormValues = {
  plate: '',
  fleetNumber: '',
  manufacturer: '',
  model: '',
  year: currentYear,
  type: 'truck',
  unit: '',
  mileageKm: 0,
  status: 'available',
};
