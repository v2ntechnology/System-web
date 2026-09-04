import type {
  ActiveTrip,
  Blocker,
  FleetOverview,
  FleetSummary,
  DriverSummary,
  FleetVehicle,
  ManagerDecisions,
  SafetySnapshot,
} from '@/management/features/overview/types';

import { delay } from './latency';

/**
 * Frota fictícia da visão geral do gestor (EXE-01).
 *
 * ⚠️ Dado de demonstração. Placas no padrão Mercosul, cidades e nomes
 * plausíveis, números coerentes entre si. Trocar por chamada de API é substituir
 * o corpo de `mockFleetOverview`. A tela consome só `features/overview/api`.
 */

/**
 * Horários relativos ao momento da chamada.
 *
 * Data fixa envelhece: com o mock parado no tempo, toda viagem acabava atrasada
 * e a faixa de viagens virava um mural vermelho.
 */
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** Os 28 caminhões. O resumo da Faixa 1 é contado daqui, nunca digitado à mão. */
const FLEET: FleetVehicle[] = [
  { id: 'veh-101', plate: 'RKH1D23', model: 'Scania R 450', state: 'EM_VIAGEM' },
  { id: 'veh-102', plate: 'RKH7E45', model: 'Volvo FH 540', state: 'EM_VIAGEM' },
  { id: 'veh-103', plate: 'RKH2B88', model: 'Mercedes-Benz Actros 2651', state: 'EM_VIAGEM' },
  { id: 'veh-104', plate: 'RKH4C09', model: 'DAF XF 480', state: 'EM_VIAGEM' },
  { id: 'veh-105', plate: 'RKH8F31', model: 'Volvo FH 460', state: 'EM_VIAGEM' },
  { id: 'veh-106', plate: 'RKH3A57', model: 'Scania R 500', state: 'EM_VIAGEM' },
  { id: 'veh-107', plate: 'QTB6G12', model: 'Iveco S-Way 540', state: 'DISPONIVEL' },
  { id: 'veh-108', plate: 'QTB9H74', model: 'Mercedes-Benz Axor 2544', state: 'DISPONIVEL' },
  { id: 'veh-109', plate: 'QTB5J66', model: 'Volvo FM 460', state: 'DISPONIVEL' },
  { id: 'veh-110', plate: 'QTB1K38', model: 'Scania G 410', state: 'DISPONIVEL' },
  { id: 'veh-111', plate: 'QTB7L20', model: 'DAF CF 410', state: 'DISPONIVEL' },
  {
    id: 'veh-112',
    plate: 'QTB2M95',
    model: 'Volkswagen Constellation 25.460',
    state: 'DISPONIVEL',
  },
  { id: 'veh-113', plate: 'QTB8N41', model: 'Mercedes-Benz Actros 2546', state: 'DISPONIVEL' },
  { id: 'veh-114', plate: 'PLD3P17', model: 'Volvo FH 500', state: 'DISPONIVEL' },
  { id: 'veh-115', plate: 'PLD9Q83', model: 'Scania R 450', state: 'DISPONIVEL' },
  { id: 'veh-116', plate: 'PLD4R52', model: 'Iveco Hi-Way 480', state: 'DISPONIVEL' },
  { id: 'veh-117', plate: 'PLD6S29', model: 'Volkswagen Meteor 29.520', state: 'DISPONIVEL' },
  { id: 'veh-118', plate: 'PLD2T64', model: 'DAF XF 530', state: 'SEM_SINAL' },
  { id: 'veh-119', plate: 'PLD5U08', model: 'Mercedes-Benz Atego 2426', state: 'SEM_SINAL' },
  { id: 'veh-120', plate: 'MGF1V73', model: 'Volvo FH 540', state: 'MANUTENCAO' },
  { id: 'veh-121', plate: 'MGF7X26', model: 'Scania S 500', state: 'MANUTENCAO' },
  { id: 'veh-122', plate: 'MGF3Z91', model: 'Mercedes-Benz Arocs 2651', state: 'MANUTENCAO' },
  { id: 'veh-123', plate: 'MGF8B47', model: 'Iveco S-Way 480', state: 'MANUTENCAO' },
  {
    id: 'veh-124',
    plate: 'MGF4D15',
    model: 'Volkswagen Constellation 24.280',
    state: 'MANUTENCAO',
  },
  { id: 'veh-125', plate: 'JVR2E80', model: 'Scania P 360', state: 'PARADO' },
  { id: 'veh-126', plate: 'JVR6F34', model: 'Volvo FM 420', state: 'PARADO' },
  { id: 'veh-127', plate: 'JVR9G58', model: 'DAF CF 450', state: 'PARADO' },
  { id: 'veh-128', plate: 'JVR5H02', model: 'Mercedes-Benz Axor 2041', state: 'PARADO' },
];

function summarize(fleet: FleetVehicle[]): FleetSummary {
  const count = (state: FleetVehicle['state']) => fleet.filter((v) => v.state === state).length;

  return {
    total: fleet.length,
    available: count('DISPONIVEL'),
    onTrip: count('EM_VIAGEM'),
    inMaintenance: count('MANUTENCAO'),
    idle: count('PARADO'),
    noSignal: count('SEM_SINAL'),
  };
}

/**
 * A fila de impedimentos.
 *
 * Chega fora de ordem de propósito: quem ordena é a tela, pela severidade, e o
 * backend não precisa garantir ordenação nenhuma.
 */
const BLOCKERS: Blocker[] = [
  {
    id: 'blk-01',
    vehicleId: 'veh-120',
    plate: 'MGF1V73',
    kind: 'MANUTENCAO_VENCENDO',
    severity: 'BLOQUEIA_EM_BREVE',
    description: 'Revisão de 60 mil km vence em 840 km rodados.',
    action: { label: 'Abrir ordem', to: '/gestao/manutencao' },
  },
  {
    id: 'blk-02',
    vehicleId: 'veh-125',
    plate: 'JVR2E80',
    kind: 'CHECKLIST_REPROVADO',
    severity: 'BLOQUEIA_AGORA',
    description: 'Freio de estacionamento reprovado no checklist de saída.',
    driverName: 'Marcos Antunes',
    action: { label: 'Ver checklist', to: '/gestao/checklists' },
  },
  {
    id: 'blk-03',
    vehicleId: 'veh-126',
    plate: 'JVR6F34',
    kind: 'PARADO_SEM_JUSTIFICATIVA',
    severity: 'SEM_VISIBILIDADE',
    description: 'Parado há 2 dias em Uberlândia, sem viagem e sem ordem aberta.',
    action: { label: 'Ver no mapa', to: '/gestao/mapa' },
  },
  {
    id: 'blk-04',
    vehicleId: 'veh-121',
    plate: 'MGF7X26',
    kind: 'DOCUMENTO_VEICULO',
    severity: 'BLOQUEIA_AGORA',
    description: 'CRLV 2025 vencido há 12 dias.',
    action: { label: 'Ver cadastro', to: '/gestao/caminhoes' },
  },
  {
    id: 'blk-05',
    vehicleId: 'veh-114',
    plate: 'PLD3P17',
    kind: 'CHECKLIST_PENDENTE',
    severity: 'SEM_VISIBILIDADE',
    description: 'Checklist de saída não realizado no turno de hoje.',
    driverName: 'Rafael Bittencourt',
    action: { label: 'Cobrar checklist', to: '/gestao/checklists' },
  },
  {
    id: 'blk-06',
    vehicleId: 'veh-103',
    plate: 'RKH2B88',
    kind: 'CNH_VENCIDA',
    severity: 'BLOQUEIA_AGORA',
    description: 'CNH de Marina Cordeiro venceu em 24/08.',
    driverName: 'Marina Cordeiro',
    action: { label: 'Ver motorista', to: '/gestao/motoristas' },
  },
  {
    id: 'blk-07',
    vehicleId: 'veh-115',
    plate: 'PLD9Q83',
    kind: 'LICENCIAMENTO',
    severity: 'BLOQUEIA_EM_BREVE',
    description: 'Licenciamento anual vence em 9 dias.',
    action: { label: 'Ver cadastro', to: '/gestao/caminhoes' },
  },
  {
    id: 'blk-08',
    vehicleId: 'veh-104',
    plate: 'RKH4C09',
    kind: 'VIAGEM_SEM_ATUALIZACAO',
    severity: 'SEM_VISIBILIDADE',
    description: 'Sem posição há 7 horas na BR-116, entre Curitiba e Joinville.',
    driverName: 'Elias Nogueira',
    action: { label: 'Abrir viagem', to: '/gestao/viagens' },
  },
  {
    id: 'blk-09',
    vehicleId: 'veh-122',
    plate: 'MGF3Z91',
    kind: 'CHECKLIST_REPROVADO',
    severity: 'BLOQUEIA_AGORA',
    description: 'Pneu do eixo dianteiro abaixo do sulco mínimo.',
    driverName: 'Jonas Ferreira',
    action: { label: 'Ver checklist', to: '/gestao/checklists' },
  },
  {
    id: 'blk-10',
    vehicleId: 'veh-116',
    plate: 'PLD4R52',
    kind: 'MANUTENCAO_VENCENDO',
    severity: 'BLOQUEIA_EM_BREVE',
    description: 'Preventiva de suspensão vence em 4 dias.',
    action: { label: 'Abrir ordem', to: '/gestao/manutencao' },
  },
  {
    id: 'blk-11',
    vehicleId: 'veh-127',
    plate: 'JVR9G58',
    kind: 'PARADO_SEM_JUSTIFICATIVA',
    severity: 'SEM_VISIBILIDADE',
    description: 'Parado há 31 horas no pátio de Ribeirão Preto, sem motorista vinculado.',
    action: { label: 'Ver no mapa', to: '/gestao/mapa' },
  },
  {
    id: 'blk-12',
    vehicleId: 'veh-117',
    plate: 'PLD6S29',
    kind: 'LICENCIAMENTO',
    severity: 'BLOQUEIA_EM_BREVE',
    description: 'Licenciamento anual vence em 15 dias.',
    action: { label: 'Ver cadastro', to: '/gestao/caminhoes' },
  },
  {
    id: 'blk-13',
    vehicleId: 'veh-128',
    plate: 'JVR5H02',
    kind: 'CHECKLIST_PENDENTE',
    severity: 'SEM_VISIBILIDADE',
    description: 'Sem checklist há 3 dias, apesar de constar como disponível na garagem.',
    action: { label: 'Cobrar checklist', to: '/gestao/checklists' },
  },
  {
    id: 'blk-16',
    vehicleId: 'veh-118',
    plate: 'PLD2T64',
    kind: 'RASTREADOR_SEM_SINAL',
    severity: 'SEM_VISIBILIDADE',
    description: 'Sem leitura do rastreador há 31 horas: pode estar rodando sem ninguém ver.',
    action: { label: 'Ver no mapa', to: '/gestao/mapa' },
  },
  {
    id: 'blk-17',
    vehicleId: 'veh-119',
    plate: 'PLD5U08',
    kind: 'RASTREADOR_SEM_SINAL',
    severity: 'SEM_VISIBILIDADE',
    description: 'Sem leitura do rastreador há 2 dias, desde a saída da oficina.',
    action: { label: 'Ver no mapa', to: '/gestao/mapa' },
  },
  {
    id: 'blk-14',
    vehicleId: 'veh-123',
    plate: 'MGF8B47',
    kind: 'MULTA',
    severity: 'BLOQUEIA_AGORA',
    description: 'Multa grave sem indicação de condutor: CRLV retido até a regularização.',
    action: { label: 'Ver multa', to: '/gestao/caminhoes' },
  },
  {
    id: 'blk-15',
    vehicleId: 'veh-109',
    plate: 'QTB5J66',
    kind: 'MULTA',
    severity: 'BLOQUEIA_EM_BREVE',
    description: '3 multas aguardando indicação de condutor, prazo em 5 dias.',
    driverName: 'Sérgio Bastos',
    action: { label: 'Ver multa', to: '/gestao/caminhoes' },
  },
];

/** Uma viagem por caminhão em `EM_VIAGEM`: os dois números têm de bater. */
const TRIPS: ActiveTrip[] = [
  {
    id: 'trp-01',
    plate: 'RKH1D23',
    driverName: 'Vinícius Vila Nova',
    destination: 'Ribeirão Preto (SP)',
    etaAt: minutesFromNow(95),
    position: [-47.4, -22.56],
    delayMinutes: 0,
  },
  {
    id: 'trp-02',
    plate: 'RKH7E45',
    driverName: 'Cláudia Menezes',
    destination: 'Feira de Santana (BA)',
    etaAt: minutesFromNow(410),
    position: [-40.84, -14.86],
    delayMinutes: 0,
  },
  {
    id: 'trp-03',
    plate: 'RKH2B88',
    driverName: 'Marina Cordeiro',
    destination: 'Betim (MG)',
    etaAt: minutesFromNow(-40),
    position: [-45.12, -20.7],
    delayMinutes: 145,
  },
  {
    id: 'trp-04',
    plate: 'RKH4C09',
    driverName: 'Elias Nogueira',
    destination: 'Joinville (SC)',
    etaAt: minutesFromNow(70),
    position: [-49.1, -25.75],
    delayMinutes: 210,
  },
  {
    id: 'trp-05',
    plate: 'RKH8F31',
    driverName: 'Patrícia Salgado',
    destination: 'Goiânia (GO)',
    etaAt: minutesFromNow(250),
    position: [-48.28, -18.92],
    delayMinutes: 0,
  },
  {
    id: 'trp-06',
    plate: 'RKH3A57',
    driverName: 'Anderson Prata',
    destination: 'Cascavel (PR)',
    etaAt: minutesFromNow(520),
    position: [-51.46, -25.39],
    delayMinutes: 35,
  },
];

/**
 * Retrato da segurança na janela curta.
 *
 * A taxa caiu de 2,3 para 1,8 por mil km: a frota melhorou, e mesmo assim há
 * três eventos críticos para tratar. Os dois números precisam aparecer juntos,
 * senão a tela conta metade da história.
 */
const SAFETY: SafetySnapshot = {
  windowLabel: 'últimas 48 horas',
  criticalEvents: 3,
  attentionEvents: 7,
  pendingContests: 2,
  perThousandKm: 1.8,
  perThousandKmPrevious: 2.3,
  byType: [
    { type: 'EXCESSO_VELOCIDADE', count: 5 },
    { type: 'FRENAGEM_BRUSCA', count: 3 },
    { type: 'SONOLENCIA', count: 1 },
    { type: 'CURVA_AGRESSIVA', count: 1 },
  ],
};

/**
 * A equipe por trás da frota.
 *
 * `unavailable` é "sem registro no período", e não indisponibilidade: inclui
 * folga e quem dirigiu sem se identificar. Disponibilidade real depende de
 * escala, que ainda não tem origem no sistema.
 */
const DRIVERS: DriverSummary = {
  total: 21,
  available: 11,
  onTrip: 6,
  unavailable: 4,
  cnhExpiringSoon: 2,
};

/** As filas que esperam uma decisão do gestor, não da plataforma. */
const DECISIONS: ManagerDecisions = {
  pendingReleases: 4,
  awaitingOwner: 2,
  openDiagnoses: 3,
  oldestWaitHours: 38,
};

export async function mockFleetOverview(): Promise<FleetOverview> {
  await delay();

  return {
    fleet: summarize(FLEET),
    drivers: DRIVERS,
    decisions: DECISIONS,
    blockers: BLOCKERS,
    trips: TRIPS,
    safety: SAFETY,
    source: 'Telemetria MiX e checklists do app, sincronizados há 4 minutos.',
  };
}
