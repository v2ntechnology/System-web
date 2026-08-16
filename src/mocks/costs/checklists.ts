import { DEMO_TENANT } from '@/mocks/session';
import type { Checklist, ChecklistDetail, ChecklistSection, ChecklistStatus } from '@/types';

const t = DEMO_TENANT.id;

export const CHECKLISTS: Checklist[] = [
  {
    id: 'chk-001',
    tenantId: t,
    vehiclePlate: 'RKH-1A23',
    driverName: 'Carlos Menezes',
    tripId: 'trp-001',
    date: '2024-05-20T04:45:00-03:00',
    status: 'completed',
    irregularItems: 0,
    photosCount: 8,
  },
  {
    id: 'chk-002',
    tenantId: t,
    vehiclePlate: 'RKH-7G34',
    driverName: 'André Ferreira',
    tripId: 'trp-004',
    date: '2024-05-20T04:00:00-03:00',
    status: 'critical',
    irregularItems: 4,
    photosCount: 12,
  },
  {
    id: 'chk-003',
    tenantId: t,
    vehiclePlate: 'RKH-2B45',
    driverName: 'Fernanda Lima',
    tripId: 'trp-002',
    date: '2024-05-20T06:10:00-03:00',
    status: 'with_issue',
    irregularItems: 2,
    photosCount: 6,
  },
  {
    id: 'chk-004',
    tenantId: t,
    vehiclePlate: 'RKH-4D89',
    driverName: 'Juliana Prado',
    tripId: 'trp-008',
    date: '2024-05-20T05:15:00-03:00',
    status: 'completed',
    irregularItems: 0,
    photosCount: 9,
  },
  {
    id: 'chk-005',
    tenantId: t,
    vehiclePlate: 'RKH-8H56',
    driverName: 'Beatriz Almeida',
    tripId: 'trp-005',
    date: '2024-05-20T07:20:00-03:00',
    status: 'with_issue',
    irregularItems: 1,
    photosCount: 5,
  },
  {
    id: 'chk-006',
    tenantId: t,
    vehiclePlate: 'RKH-9U78',
    driverName: 'Marcos Vinícius',
    date: '2024-05-19T18:30:00-03:00',
    status: 'pending',
    irregularItems: 0,
    photosCount: 0,
  },
  {
    id: 'chk-007',
    tenantId: t,
    vehiclePlate: 'RKH-4P78',
    driverName: 'Diego Nascimento',
    tripId: 'trp-007',
    date: '2024-05-20T05:40:00-03:00',
    status: 'completed',
    irregularItems: 0,
    photosCount: 7,
  },
  {
    id: 'chk-008',
    tenantId: t,
    vehiclePlate: 'RKH-8T56',
    driverName: 'Gustavo Rocha',
    date: '2024-05-19T17:10:00-03:00',
    status: 'critical',
    irregularItems: 3,
    photosCount: 10,
  },
];

function section(id: string, title: string, items: ChecklistSection['items']): ChecklistSection {
  return { id, title, items };
}

const CRITICAL_SECTIONS: ChecklistSection[] = [
  section('sec-tires', 'Pneus e rodas', [
    { id: 'i1', label: 'Pressão dos pneus dianteiros', status: 'ok' },
    {
      id: 'i2',
      label: 'Pressão dos pneus traseiros',
      status: 'attention',
      note: 'Pneu externo direito 8 psi abaixo.',
    },
    {
      id: 'i3',
      label: 'Estado da banda de rodagem',
      status: 'critical',
      note: 'Desgaste irregular no eixo traseiro.',
    },
    { id: 'i4', label: 'Aperto das porcas de roda', status: 'ok' },
    { id: 'i5', label: 'Estepe e ferramentas', status: 'ok' },
  ]),
  section('sec-lights', 'Iluminação', [
    { id: 'i6', label: 'Faróis baixos e altos', status: 'ok' },
    { id: 'i7', label: 'Luzes de freio', status: 'ok' },
    {
      id: 'i8',
      label: 'Setas e pisca-alerta',
      status: 'attention',
      note: 'Seta traseira esquerda intermitente.',
    },
    { id: 'i9', label: 'Luz de placa', status: 'ok' },
  ]),
  section('sec-brakes', 'Freios', [
    { id: 'i10', label: 'Nível do fluido de freio', status: 'ok' },
    {
      id: 'i11',
      label: 'Freio de serviço',
      status: 'critical',
      note: 'Curso longo do pedal, verificar urgente.',
    },
    { id: 'i12', label: 'Freio de estacionamento', status: 'ok' },
    { id: 'i13', label: 'Freio motor', status: 'ok' },
  ]),
  section('sec-engine', 'Motor e fluidos', [
    { id: 'i14', label: 'Nível de óleo do motor', status: 'ok' },
    {
      id: 'i15',
      label: 'Nível de água do radiador',
      status: 'attention',
      note: 'Reservatório no mínimo.',
    },
    { id: 'i16', label: 'Correias', status: 'ok' },
    {
      id: 'i17',
      label: 'Vazamentos aparentes',
      status: 'critical',
      note: 'Vazamento de óleo próximo ao cárter.',
    },
    { id: 'i18', label: 'Nível de Arla 32', status: 'ok' },
  ]),
  section('sec-cabin', 'Cabine', [
    { id: 'i19', label: 'Cinto de segurança', status: 'ok' },
    { id: 'i20', label: 'Retrovisores', status: 'ok' },
    { id: 'i21', label: 'Buzina', status: 'ok' },
    {
      id: 'i22',
      label: 'Painel de instrumentos',
      status: 'attention',
      note: 'Luz de anomalia acesa.',
    },
    { id: 'i23', label: 'Limpador de para-brisa', status: 'ok' },
  ]),
  section('sec-safety', 'Equipamentos de segurança', [
    { id: 'i24', label: 'Extintor de incêndio', status: 'ok' },
    { id: 'i25', label: 'Triângulo de sinalização', status: 'ok' },
    { id: 'i26', label: 'Kit de primeiros socorros', status: 'not_applicable' },
    { id: 'i27', label: 'Calços de roda', status: 'ok' },
  ]),
  section('sec-body', 'Carroceria e implemento', [
    { id: 'i28', label: 'Estado da carroceria', status: 'ok' },
    { id: 'i29', label: 'Amarração da carga', status: 'ok' },
    { id: 'i30', label: 'Lona e travas', status: 'attention', note: 'Trava lateral com folga.' },
    { id: 'i31', label: 'Quinta roda', status: 'ok' },
  ]),
  section('sec-docs', 'Documentação', [
    { id: 'i32', label: 'CRLV do veículo', status: 'ok' },
    { id: 'i33', label: 'Documento do implemento', status: 'ok' },
    { id: 'i34', label: 'Manifesto de carga', status: 'ok' },
    { id: 'i35', label: 'CNH do condutor', status: 'ok' },
  ]),
];

const OK_SECTIONS: ChecklistSection[] = CRITICAL_SECTIONS.map((sec) => ({
  ...sec,
  items: sec.items.map((item) =>
    item.status === 'not_applicable' ? item : { ...item, status: 'ok' as const, note: undefined },
  ),
}));

export function buildChecklistDetail(id: string): ChecklistDetail | undefined {
  const base = CHECKLISTS.find((c) => c.id === id);
  if (!base) return undefined;
  const sections = base.status === 'completed' ? OK_SECTIONS : CRITICAL_SECTIONS;
  return { ...base, sections };
}

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  with_issue: 'Com ocorrência',
  critical: 'Crítico',
};
