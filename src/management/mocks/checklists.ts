import type { ChecklistSummary } from '@/management/types';

import { delay } from './latency';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** ⚠️ Preenchimentos fictícios. */
const SUMMARY: ChecklistSummary = {
  fills: [
    {
      id: 'chk-7742',
      plate: 'RKH8H31',
      driverName: 'Wagner Teixeira',
      templateName: 'Saída de pátio — cavalo mecânico',
      templateVersion: 'v4',
      filledAt: hoursAgo(6),
      receivedAt: hoursAgo(6),
      result: 'REPROVADO',
      blocking: true,
      items: [
        { label: 'Pneus e calibragem', result: 'APROVADO' },
        {
          label: 'Iluminação dianteira',
          result: 'REPROVADO',
          note: 'Farol direito queimado',
          hasPhoto: true,
        },
        { label: 'Nível de óleo', result: 'APROVADO' },
        { label: 'Freios', result: 'APROVADO' },
        { label: 'Documentação', result: 'APROVADO' },
      ],
    },
    {
      id: 'chk-7739',
      plate: 'RKH1D23',
      driverName: 'Marina Cordeiro',
      templateName: 'Saída de pátio — cavalo mecânico',
      templateVersion: 'v4',
      /*
       * RN-054 — preenchido offline na estrada e só sincronizado 9h depois.
       * A divergência acima de 6h vira flag de auditoria.
       */
      filledAt: hoursAgo(20),
      receivedAt: hoursAgo(11),
      result: 'REPROVADO',
      blocking: true,
      releasedAt: hoursAgo(9),
      releasedBy: 'Jonas Ferreira · Manutenção',
      releaseReason:
        'Pastilhas substituídas na Oficina Central; OS-4417 segue aberta para revisão.',
      items: [
        { label: 'Pneus e calibragem', result: 'APROVADO' },
        { label: 'Freios', result: 'REPROVADO', note: 'Pastilhas no limite', hasPhoto: true },
        { label: 'Iluminação dianteira', result: 'APROVADO' },
        { label: 'Nível de óleo', result: 'APROVADO' },
        { label: 'Documentação', result: 'APROVADO' },
      ],
    },
    {
      id: 'chk-7736',
      plate: 'RKH7E45',
      driverName: 'Vinícius Vila Nova',
      templateName: 'Saída de pátio — cavalo mecânico',
      templateVersion: 'v4',
      filledAt: hoursAgo(4),
      receivedAt: hoursAgo(4),
      result: 'APROVADO',
      blocking: false,
      items: [
        { label: 'Pneus e calibragem', result: 'APROVADO' },
        { label: 'Iluminação dianteira', result: 'APROVADO' },
        { label: 'Nível de óleo', result: 'APROVADO' },
        { label: 'Freios', result: 'APROVADO' },
        { label: 'Documentação', result: 'APROVADO' },
      ],
    },
    {
      id: 'chk-7730',
      plate: 'RKH2B88',
      driverName: 'Marina Cordeiro',
      templateName: 'Retorno de viagem — carreta',
      templateVersion: 'v2',
      filledAt: hoursAgo(30),
      receivedAt: hoursAgo(30),
      result: 'APROVADO',
      blocking: false,
      items: [
        { label: 'Lonas e amarração', result: 'APROVADO' },
        { label: 'Pneus do semirreboque', result: 'APROVADO' },
        { label: 'Sistema elétrico', result: 'APROVADO' },
      ],
    },
  ],

  templates: [
    {
      id: 'tpl-saida',
      name: 'Saída de pátio — cavalo mecânico',
      version: 'v4',
      itemCount: 18,
      updatedAt: daysAgo(23),
      appliesTo: 'Cavalos mecânicos',
      active: true,
    },
    {
      id: 'tpl-retorno',
      name: 'Retorno de viagem — carreta',
      version: 'v2',
      itemCount: 11,
      updatedAt: daysAgo(64),
      appliesTo: 'Semirreboques',
      active: true,
    },
    {
      id: 'tpl-mensal',
      name: 'Inspeção mensal completa',
      version: 'v1',
      itemCount: 34,
      updatedAt: daysAgo(140),
      appliesTo: 'Toda a frota',
      active: false,
    },
  ],
};

export async function mockChecklistSummary(): Promise<ChecklistSummary> {
  await delay(500);
  return SUMMARY;
}
