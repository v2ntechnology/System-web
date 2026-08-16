import type { DashboardSummary } from '@/management/types';

import avatarSample from '@imgs/imgFace.jpg';

import { costPerKmLayers } from './fleet-economics';
import { delay } from './latency';

/**
 * Substituto do `GET /v1/dashboard/summary`.
 *
 * ⚠️ Números fictícios e coerentes entre si — as camadas de custo saem da mesma
 * base econômica que alimenta a DRE do dono (`fleet-economics.ts`), e o ranking
 * está ordenado pelo score. Isso importa: dado mockado incoerente esconde bug de
 * formatação na hora da integração.
 */
export async function mockDashboardSummary(): Promise<DashboardSummary> {
  await delay(600);

  return {
    hub: {
      id: 'hub-zona-a',
      name: 'Central de Distribuição Hub — Zona A',
      city: 'Rio de Janeiro',
      state: 'RJ',
    },

    topDrivers: [
      {
        id: 'drv-001',
        name: 'Vinícius Vila Nova',
        role: 'Motorista',
        avatarUrl: avatarSample,
        score: 97,
        position: 1,
      },
      {
        id: 'drv-002',
        name: 'Marina Cordeiro',
        role: 'Motorista',
        score: 94,
        position: 2,
      },
      {
        id: 'drv-003',
        name: 'Edson Bastos',
        role: 'Motorista',
        score: 91,
        position: 3,
      },
      /* Fora do pódio: sem medalha, só o score. */
      {
        id: 'drv-004',
        name: 'Patrícia Nunes',
        role: 'Motorista',
        score: 88,
        position: 4,
      },
      {
        id: 'drv-005',
        name: 'Wagner Teixeira',
        role: 'Motorista',
        score: 85,
        position: 5,
      },
    ],

    metrics: [
      {
        id: 'fleet-active',
        label: 'Caminhões em operação',
        value: 42,
        accent: 'indigo',
        icon: 'truck',
      },
      {
        id: 'in-maintenance',
        label: 'Caminhões em manutenção',
        value: 7,
        accent: 'cyan',
        icon: 'wrench',
      },
      {
        id: 'trips-today',
        label: 'Viagens em curso',
        value: 18,
        accent: 'cyan',
        icon: 'route',
      },
      {
        id: 'critical-events',
        label: 'Eventos críticos hoje',
        value: 3,
        accent: 'indigo',
        icon: 'warning',
      },
    ],

    maintenance: [
      {
        id: 'os-4417',
        plate: 'RKH1D23',
        model: 'Mercedes-Benz Arocs',
        service: 'Troca de pastilhas de freio',
        status: 'ATRASADA',
        dueAt: '2026-08-01',
        workshop: 'Oficina Central',
      },
      {
        id: 'os-4418',
        plate: 'RKH7E45',
        model: 'Volvo FH 540',
        service: 'Revisão de 60.000 km',
        status: 'HOJE',
        dueAt: '2026-08-03',
        workshop: 'Oficina Central',
      },
      {
        id: 'os-4421',
        plate: 'RKH2B88',
        model: 'Scania R 450',
        service: 'Alinhamento e balanceamento',
        status: 'AGENDADA',
        dueAt: '2026-08-06',
        workshop: 'Truck Diesel Niterói',
      },
      {
        id: 'os-4422',
        plate: 'RKH9C10',
        model: 'DAF XF',
        service: 'Substituição de filtro de ar',
        status: 'AGENDADA',
        dueAt: '2026-08-09',
        workshop: 'Oficina Central',
      },
    ],

    /** Custo por km em camadas (RN-055), R$/km, últimos 12 meses. */
    costPerKm: costPerKmLayers(),
  };
}
