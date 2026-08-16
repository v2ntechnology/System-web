import { describe, expect, it } from 'vitest';

import { DEFAULT_VEHICLE_FORM, vehicleFormSchema } from './vehicle-schema';

const validVehicle = {
  ...DEFAULT_VEHICLE_FORM,
  plate: 'ABC-1D23',
  fleetNumber: 'F-1234',
  manufacturer: 'Volvo',
  model: 'FH 540',
  unit: 'Matriz — Curitiba/PR',
  mileageKm: 128450,
};

function firstErrorFor(input: unknown, field: string): string | undefined {
  const result = vehicleFormSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('vehicleFormSchema', () => {
  it('aceita um veículo válido', () => {
    expect(vehicleFormSchema.safeParse(validVehicle).success).toBe(true);
  });

  it('aceita placa no padrão Mercosul e no padrão antigo', () => {
    expect(vehicleFormSchema.safeParse({ ...validVehicle, plate: 'RKH-2A45' }).success).toBe(true);
    expect(vehicleFormSchema.safeParse({ ...validVehicle, plate: 'RKH-2045' }).success).toBe(true);
  });

  it('rejeita placa fora do padrão com mensagem em português', () => {
    expect(firstErrorFor({ ...validVehicle, plate: '1234' }, 'plate')).toBe(
      'Placa inválida. Use o formato ABC-1D23 ou ABC-1234.',
    );
  });

  it('rejeita ano anterior a 1990', () => {
    expect(firstErrorFor({ ...validVehicle, year: 1985 }, 'year')).toBe(
      'Ano deve ser a partir de 1990.',
    );
  });

  it('rejeita quilometragem negativa', () => {
    expect(firstErrorFor({ ...validVehicle, mileageKm: -1 }, 'mileageKm')).toBe(
      'A quilometragem não pode ser negativa.',
    );
  });

  it('rejeita unidade em branco', () => {
    expect(firstErrorFor({ ...validVehicle, unit: '' }, 'unit')).toBe('Selecione a unidade.');
  });

  it('rejeita tipo de veículo desconhecido', () => {
    expect(firstErrorFor({ ...validVehicle, type: 'foguete' }, 'type')).toBe(
      'Selecione o tipo do veículo.',
    );
  });
});
