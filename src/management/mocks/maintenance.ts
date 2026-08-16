import type { MaintenanceSummary } from '@/management/types';

import { delay } from './latency';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** ⚠️ Ordens fictícias, coerentes com a frota e os custos das outras telas. */
const SUMMARY: MaintenanceSummary = {
  orders: [
    {
      id: 'os-4417',
      code: 'OS-4417',
      plate: 'RKH1D23',
      model: 'Mercedes-Benz Arocs',
      type: 'CORRETIVA',
      status: 'ATRASADA',
      service: 'Troca de pastilhas de freio',
      workshop: 'Oficina Central',
      openedAt: daysAgo(9),
      dueAt: daysAgo(4),
      cost: 2_480,
      downtimeHours: 14,
      items: [
        { label: 'Pastilhas dianteiras (jogo)', cost: 1_180 },
        { label: 'Pastilhas traseiras (jogo)', cost: 940 },
        { label: 'Mão de obra', cost: 360 },
      ],
    },
    {
      id: 'os-4418',
      code: 'OS-4418',
      plate: 'RKH7E45',
      model: 'Volvo FH 540',
      type: 'PREVENTIVA',
      status: 'EM_EXECUCAO',
      service: 'Revisão de 60.000 km',
      workshop: 'Oficina Central',
      openedAt: daysAgo(1),
      dueAt: daysAhead(0),
      cost: 3_940,
      downtimeHours: 8,
      items: [
        { label: 'Óleo e filtros', cost: 1_820 },
        { label: 'Correias e tensores', cost: 1_240 },
        { label: 'Mão de obra', cost: 880 },
      ],
    },
    {
      id: 'os-4421',
      code: 'OS-4421',
      plate: 'RKH2B88',
      model: 'Scania R 450',
      type: 'PREVENTIVA',
      status: 'ABERTA',
      service: 'Alinhamento e balanceamento',
      workshop: 'Truck Diesel Niterói',
      openedAt: daysAgo(0),
      dueAt: daysAhead(2),
      cost: 860,
      downtimeHours: 3,
      items: [
        { label: 'Alinhamento de eixos', cost: 520 },
        { label: 'Balanceamento', cost: 340 },
      ],
    },
    {
      id: 'os-4422',
      code: 'OS-4422',
      plate: 'RKH9C10',
      model: 'DAF XF 480',
      type: 'PREVENTIVA',
      status: 'ABERTA',
      service: 'Substituição de filtro de ar',
      workshop: 'Oficina Central',
      openedAt: daysAgo(0),
      dueAt: daysAhead(5),
      cost: 320,
      downtimeHours: 2,
      items: [
        { label: 'Filtro de ar', cost: 240 },
        { label: 'Mão de obra', cost: 80 },
      ],
    },
    {
      id: 'os-4410',
      code: 'OS-4410',
      plate: 'RKH3K57',
      model: 'Mercedes-Benz Actros',
      type: 'CORRETIVA',
      status: 'CONCLUIDA',
      service: 'Reparo no sistema de arrefecimento',
      workshop: 'Truck Diesel Niterói',
      openedAt: daysAgo(21),
      dueAt: daysAgo(17),
      finishedAt: daysAgo(18),
      cost: 4_120,
      downtimeHours: 26,
      items: [
        { label: 'Radiador', cost: 2_740 },
        { label: 'Mangueiras', cost: 480 },
        { label: 'Mão de obra', cost: 900 },
      ],
    },
    {
      id: 'os-4402',
      code: 'OS-4402',
      plate: 'RKH5J19',
      model: 'Scania R 500',
      type: 'PREVENTIVA',
      status: 'CONCLUIDA',
      service: 'Revisão de 40.000 km',
      workshop: 'Oficina Central',
      openedAt: daysAgo(34),
      dueAt: daysAgo(31),
      finishedAt: daysAgo(31),
      cost: 3_180,
      downtimeHours: 7,
      items: [
        { label: 'Óleo e filtros', cost: 1_640 },
        { label: 'Inspeção de freios', cost: 720 },
        { label: 'Mão de obra', cost: 820 },
      ],
    },
  ],

  plans: [
    {
      id: 'plan-oil',
      name: 'Troca de óleo e filtros',
      intervalKm: 20_000,
      appliesTo: 'Toda a frota',
      overdueVehicles: ['RKH1D23'],
      nextVehicles: [
        { plate: 'RKH7E45', kmToService: 380 },
        { plate: 'RKH3K57', kmToService: 720 },
        { plate: 'RKH8H31', kmToService: 1_120 },
      ],
    },
    {
      id: 'plan-brakes',
      name: 'Inspeção do sistema de freios',
      intervalKm: 30_000,
      appliesTo: 'Toda a frota',
      overdueVehicles: [],
      nextVehicles: [
        { plate: 'RKH2B88', kmToService: 2_140 },
        { plate: 'RKH5J19', kmToService: 4_300 },
      ],
    },
    {
      id: 'plan-tires',
      name: 'Rodízio e calibragem de pneus',
      intervalKm: 15_000,
      appliesTo: 'Cavalos mecânicos',
      overdueVehicles: [],
      nextVehicles: [
        { plate: 'RKH9C10', kmToService: 6_500 },
        { plate: 'RKH4F72', kmToService: 8_900 },
      ],
    },
  ],

  workshops: [
    {
      id: 'wsp-central',
      name: 'Oficina Central',
      city: 'Duque de Caxias/RJ',
      ordersInPeriod: 31,
      averageCost: 2_640,
      averageDowntimeHours: 9.2,
    },
    {
      id: 'wsp-niteroi',
      name: 'Truck Diesel Niterói',
      city: 'Niterói/RJ',
      ordersInPeriod: 12,
      averageCost: 3_180,
      averageDowntimeHours: 14.6,
    },
    {
      id: 'wsp-serra',
      name: 'Diesel Serra',
      city: 'Petrópolis/RJ',
      ordersInPeriod: 5,
      averageCost: 1_920,
      averageDowntimeHours: 6.4,
    },
  ],
};

export async function mockMaintenanceSummary(): Promise<MaintenanceSummary> {
  await delay(520);
  return SUMMARY;
}
