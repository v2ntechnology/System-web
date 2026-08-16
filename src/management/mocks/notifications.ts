import type { AppNotification } from '@/management/types';

import { delay } from './latency';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * ⚠️ Notificações fictícias.
 *
 * A central é multi-módulo por definição (RF-038): segurança, manutenção,
 * checklist, viagens, custos e integrações caem todos aqui. Por isso cada item
 * declara a `source` — sem ela o usuário não sabe de onde veio o aviso.
 */
const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'ntf-001',
    title: 'Evento crítico — excesso de velocidade',
    description: 'Wagner Teixeira a 96 km/h em trecho de 80 km/h, na BR-101 km 214.',
    severity: 'CRITICO',
    source: 'SAFETY',
    at: minutesAgo(4),
    read: false,
    actionLabel: 'Ver evento',
    actionTo: '/gestao/seguranca',
  },
  {
    id: 'ntf-002',
    title: 'Integração sem sincronizar',
    description: 'Powerfleet está há 8 horas sem enviar posição do RKH8H31.',
    severity: 'CRITICO',
    source: 'INTEGRATIONS',
    at: minutesAgo(22),
    read: false,
    actionLabel: 'Ver integrações',
    actionTo: '/gestao/configuracoes',
  },
  {
    id: 'ntf-003',
    title: 'Ordem de serviço atrasada',
    description: 'Troca de pastilhas de freio do RKH1D23 venceu em 31 de julho.',
    severity: 'ATENCAO',
    source: 'MAINTENANCE',
    at: minutesAgo(95),
    read: false,
    actionLabel: 'Abrir manutenção',
    actionTo: '/gestao/manutencao',
  },
  {
    id: 'ntf-004',
    title: 'Veículo bloqueado por checklist',
    description: 'RKH8H31 reprovou no item de iluminação e não pode sair do pátio.',
    severity: 'ATENCAO',
    source: 'CHECKLIST',
    at: minutesAgo(180),
    read: true,
    actionLabel: 'Ver checklist',
    actionTo: '/gestao/checklists',
  },
  {
    id: 'ntf-005',
    title: 'Abastecimento fora do padrão',
    description: 'RKH2B88 abasteceu 380 l — 42% acima da média histórica do veículo.',
    severity: 'ATENCAO',
    source: 'COSTS',
    at: minutesAgo(320),
    read: true,
    actionLabel: 'Ver custos',
    actionTo: '/gestao/custos',
  },
  {
    id: 'ntf-006',
    title: 'Viagem concluída no prazo',
    description: 'Vinícius Vila Nova entregou em Juiz de Fora com 40 minutos de folga.',
    severity: 'INFO',
    source: 'TRIPS',
    at: minutesAgo(410),
    read: true,
    actionLabel: 'Ver viagem',
    actionTo: '/gestao/viagens',
  },
];

export async function mockNotifications(): Promise<AppNotification[]> {
  await delay(350);
  return NOTIFICATIONS;
}
