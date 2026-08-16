import type {
  AnalyticsPeriod,
  EntryKind,
  LaunchEntry,
  OperatorOverview,
  TriageFill,
  WarningSeverity,
  YardVehicle,
} from '@/management/types';

import { ApiError, delay } from './latency';
import { enqueueRelease } from './manager';

/**
 * Substitutos dos endpoints da visão do operador.
 *
 * ⚠️ Dados fictícios, exclusivos de desenvolvimento.
 */

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  '30D': 'últimos 30 dias',
  '3M': 'últimos 3 meses',
  '6M': 'últimos 6 meses',
  '12M': 'últimos 12 meses',
};

const OPERATOR_NAME = 'Camila Prado';

/* -------------------------------------------------------------------------- */
/* Lançamentos                                                                 */
/* -------------------------------------------------------------------------- */

/** Mutável: lançar precisa aparecer na lista, senão a tela não fecha o ciclo. */
const ENTRIES: LaunchEntry[] = [
  {
    id: 'lan-001',
    kind: 'ABASTECIMENTO',
    at: '2026-08-07T05:40:00-03:00',
    createdAt: '2026-08-07T06:05:00-03:00',
    plate: 'RKH4A12',
    driverName: 'Vinícius Vila Nova',
    description: 'Posto Rodoserra — BR-116 km 218',
    amount: 3_284.5,
    documentNumber: 'NF 118432',
    createdBy: OPERATOR_NAME,
  },
  {
    id: 'lan-002',
    kind: 'MULTA',
    at: '2026-08-05T14:12:00-03:00',
    createdAt: '2026-08-07T07:20:00-03:00',
    plate: 'RKH3G56',
    driverName: 'Wagner Teixeira',
    description: 'Excesso de velocidade — 20% acima do limite',
    amount: 195.23,
    documentNumber: 'AIT S-4471882',
    createdBy: OPERATOR_NAME,
  },
  {
    id: 'lan-003',
    kind: 'ORDEM_MANUTENCAO',
    at: '2026-08-06T09:00:00-03:00',
    createdAt: '2026-08-06T09:15:00-03:00',
    plate: 'RKH9C10',
    description: 'Corretiva — folga no terminal de direção',
    amount: 1_450,
    documentNumber: 'OS-4431',
    createdBy: OPERATOR_NAME,
  },
  {
    id: 'lan-004',
    kind: 'DESPESA',
    at: '2026-08-06T18:30:00-03:00',
    createdAt: '2026-08-06T19:02:00-03:00',
    plate: 'RKH7E45',
    driverName: 'Edson Bastos',
    description: 'Pernoite não previsto — desvio na BR-116',
    amount: 180,
    documentNumber: 'REC 3391',
    createdBy: OPERATOR_NAME,
  },
  {
    id: 'lan-005',
    kind: 'ABASTECIMENTO',
    at: '2026-08-06T11:25:00-03:00',
    createdAt: '2026-08-06T11:48:00-03:00',
    plate: 'RKH2B88',
    driverName: 'Marina Cordeiro',
    description: 'Posto Ipiranga — Registro/SP',
    amount: 2_912.8,
    documentNumber: 'NF 118390',
    createdBy: OPERATOR_NAME,
  },
];

export interface EntryPayload {
  kind: EntryKind;
  plate: string;
  at: string;
  description: string;
  amount: number;
  documentNumber?: string | undefined;
  driverName?: string | undefined;
}

/** Substituto do `GET /v1/operator/entries`. */
export async function mockEntries(): Promise<LaunchEntry[]> {
  await delay(550);
  return ENTRIES.map((item) => ({ ...item }));
}

/** Substituto do `POST /v1/operator/entries`. */
export async function mockCreateEntry(payload: EntryPayload): Promise<LaunchEntry> {
  await delay(850);

  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(payload.plate)) {
    throw new ApiError(
      422,
      'Placa inválida',
      'Use o formato Mercosul (ABC1D23) ou o antigo (ABC1234), sem hífen.',
    );
  }

  /*
   * Duplicidade de documento é o erro mais comum do lançamento manual: a mesma
   * nota digitada duas vezes infla o custo do veículo em silêncio. O backend
   * tem índice único; aqui a checagem imita o 409 dele.
   */
  if (payload.documentNumber) {
    const duplicated = ENTRIES.find(
      (entry) =>
        entry.documentNumber?.toLowerCase() === payload.documentNumber?.toLowerCase() &&
        entry.kind === payload.kind,
    );

    if (duplicated) {
      throw new ApiError(
        409,
        'Documento já lançado',
        `${payload.documentNumber} já consta em ${duplicated.plate}, lançado por ${duplicated.createdBy}.`,
      );
    }
  }

  const created: LaunchEntry = {
    ...payload,
    id: `lan-${String(ENTRIES.length + 1).padStart(3, '0')}`,
    createdAt: new Date().toISOString(),
    createdBy: OPERATOR_NAME,
  };

  ENTRIES.unshift(created);
  return { ...created };
}

/* -------------------------------------------------------------------------- */
/* Triagem                                                                     */
/* -------------------------------------------------------------------------- */

const TRIAGE: TriageFill[] = [
  {
    id: 'tri-001',
    plate: 'RKH3G56',
    driverName: 'Wagner Teixeira',
    templateName: 'Checklist de devolução',
    filledAt: '2026-08-07T04:10:00-03:00',
    receivedAt: '2026-08-07T04:15:00-03:00',
    clockSkewHours: 0,
    status: 'PENDENTE',
    blocking: true,
    failures: [
      {
        id: 'tif-001',
        label: 'Cinto de segurança do motorista',
        severity: 'GRAVE',
        note: 'Trava não retém. Motorista relatou folga desde a viagem anterior.',
        hasPhoto: true,
      },
      {
        id: 'tif-002',
        label: 'Buzina sem funcionamento',
        severity: 'MEDIA',
        hasPhoto: false,
      },
    ],
  },
  {
    id: 'tri-002',
    plate: 'RKH8H34',
    driverName: 'Marina Cordeiro',
    templateName: 'Checklist de saída',
    filledAt: '2026-08-06T16:20:00-03:00',
    receivedAt: '2026-08-06T16:24:00-03:00',
    clockSkewHours: 0,
    status: 'PENDENTE',
    blocking: true,
    failures: [
      {
        id: 'tif-003',
        label: 'Extintor com carga vencida',
        severity: 'MEDIA',
        note: 'Vencimento em 07/2026.',
        hasPhoto: false,
      },
    ],
  },
  {
    id: 'tri-003',
    plate: 'RKH7E45',
    driverName: 'Edson Bastos',
    templateName: 'Checklist de devolução',
    filledAt: '2026-08-05T23:05:00-03:00',
    receivedAt: '2026-08-06T11:05:00-03:00',
    /* RN-054 — 12h de divergência entre o relógio do aparelho e o servidor. */
    clockSkewHours: 12,
    status: 'PENDENTE',
    blocking: false,
    failures: [
      {
        id: 'tif-004',
        label: 'Espelho retrovisor direito trincado',
        severity: 'LEVE',
        hasPhoto: true,
      },
    ],
  },
  {
    id: 'tri-004',
    plate: 'RKH5F77',
    driverName: 'Patrícia Nunes',
    templateName: 'Checklist de saída',
    filledAt: '2026-08-06T06:30:00-03:00',
    receivedAt: '2026-08-06T06:35:00-03:00',
    clockSkewHours: 0,
    status: 'APROVADO',
    blocking: false,
    failures: [
      {
        id: 'tif-005',
        label: 'Nível do parabrisa abaixo do mínimo',
        severity: 'LEVE',
        hasPhoto: false,
      },
    ],
    decision: {
      by: OPERATOR_NAME,
      at: '2026-08-06T06:52:00-03:00',
      note: 'Reservatório completado no pátio. Sem impedimento para a saída.',
    },
  },
];

/** Substituto do `GET /v1/operator/triage`. */
export async function mockTriage(): Promise<TriageFill[]> {
  await delay(600);
  return TRIAGE.map((item) => ({ ...item }));
}

export interface TriagePayload {
  fillId: string;
  /**
   * `APROVAR` — resolvido no pátio.
   * `MANUTENCAO` — abre ordem, sem impedir a saída.
   * `ESCALAR` — abre pedido de liberação na fila do gestor.
   */
  action: 'APROVAR' | 'MANUTENCAO' | 'ESCALAR';
  note: string;
}

/**
 * Substituto do `POST /v1/operator/triage/{id}`.
 *
 * A regra que importa: reprovação que impede a saída (RF-016) **não** se resolve
 * no pátio. O operador faz a tratativa inicial e escala — quem autoriza a saída é
 * o gestor.
 */
export async function mockTriageDecision({
  fillId,
  action,
  note,
}: TriagePayload): Promise<TriageFill> {
  await delay(800);

  const target = TRIAGE.find((item) => item.id === fillId);

  if (!target) {
    throw new ApiError(404, 'Checklist não encontrado', 'Este preenchimento não existe mais.');
  }

  if (target.status !== 'PENDENTE') {
    throw new ApiError(
      409,
      'Checklist já triado',
      'Alguém já tratou este preenchimento. Recarregue a fila.',
    );
  }

  if (note.trim().length < 10) {
    throw new ApiError(422, 'Tratativa obrigatória', 'Descreva o que foi verificado no pátio.');
  }

  if (target.blocking && action === 'APROVAR') {
    throw new ApiError(
      403,
      'Reprovação bloqueante não é sua alçada',
      'O veículo só sai com autorização do gestor. Escale o pedido.',
    );
  }

  const decision = { by: OPERATOR_NAME, at: new Date().toISOString(), note: note.trim() };

  if (action === 'ESCALAR') {
    /* A maior severidade das reprovações define o degrau do fluxo de risco. */
    const order: WarningSeverity[] = ['LEVE', 'MEDIA', 'GRAVE'];
    const severity = target.failures.reduce<WarningSeverity>(
      (worst, item) =>
        order.indexOf(item.severity) > order.indexOf(worst) ? item.severity : worst,
      'LEVE',
    );

    const created = enqueueRelease({
      kind: 'VEICULO',
      subject: target.plate,
      plate: target.plate,
      driverName: target.driverName,
      severity,
      requestedAt: new Date().toISOString(),
      waitingHours: 0,
      blockers: target.failures.map((failure) => ({
        id: failure.id,
        label: failure.label,
        source: `${target.templateName} · triagem de ${OPERATOR_NAME}`,
        severity: failure.severity,
        at: target.receivedAt,
        hasPhoto: failure.hasPhoto,
      })),
    });

    target.status = 'ESCALADO';
    target.releaseRequestId = created.id;
  } else {
    target.status = action === 'MANUTENCAO' ? 'ENVIADO_MANUTENCAO' : 'APROVADO';
  }

  target.decision = decision;
  return { ...target };
}

/* -------------------------------------------------------------------------- */
/* Pátio                                                                       */
/* -------------------------------------------------------------------------- */

const YARD: YardVehicle[] = [
  {
    vehicleId: 'veh-001',
    plate: 'RKH4A12',
    model: 'Scania R 450',
    status: 'DISPONIVEL',
    bay: 'A-01',
    odometerKm: 412_880,
    kmToMaintenance: 8_120,
    lastChecklistAt: '2026-08-07T05:20:00-03:00',
    lastChecklistResult: 'APROVADO',
    lastSyncAt: '2026-08-07T07:42:00-03:00',
  },
  {
    vehicleId: 'veh-003',
    plate: 'RKH2B88',
    model: 'Scania R 450',
    status: 'EM_VIAGEM',
    driverName: 'Marina Cordeiro',
    odometerKm: 388_140,
    kmToMaintenance: 3_400,
    lastChecklistAt: '2026-08-05T07:10:00-03:00',
    lastChecklistResult: 'APROVADO',
    lastSyncAt: '2026-08-07T07:40:00-03:00',
  },
  {
    vehicleId: 'veh-006',
    plate: 'RKH1D23',
    model: 'Mercedes-Benz Arocs',
    status: 'BLOQUEADO',
    bay: 'C-04',
    odometerKm: 501_220,
    kmToMaintenance: -1_180,
    lastChecklistAt: '2026-08-05T17:45:00-03:00',
    lastChecklistResult: 'REPROVADO',
    blockingReason: 'Ocorrência grave aguardando aprovação do proprietário',
    lastSyncAt: '2026-08-07T06:10:00-03:00',
  },
  {
    vehicleId: 'veh-007',
    plate: 'RKH3G56',
    model: 'Iveco S-Way',
    status: 'BLOQUEADO',
    bay: 'C-02',
    odometerKm: 296_540,
    kmToMaintenance: 620,
    lastChecklistAt: '2026-08-07T04:10:00-03:00',
    lastChecklistResult: 'REPROVADO',
    blockingReason: 'Checklist de devolução reprovado — cinto de segurança',
    lastSyncAt: '2026-08-07T07:31:00-03:00',
  },
  {
    vehicleId: 'veh-002',
    plate: 'RKH7E45',
    model: 'Volvo FH 540',
    status: 'DISPONIVEL',
    bay: 'A-03',
    odometerKm: 344_910,
    kmToMaintenance: 12_400,
    lastChecklistAt: '2026-08-06T11:05:00-03:00',
    lastChecklistResult: 'REPROVADO',
    lastSyncAt: '2026-08-07T07:39:00-03:00',
  },
  {
    vehicleId: 'veh-004',
    plate: 'RKH9C10',
    model: 'DAF XF',
    status: 'MANUTENCAO',
    bay: 'OF-1',
    odometerKm: 268_330,
    kmToMaintenance: 5_900,
    lastChecklistAt: '2026-08-06T05:05:00-03:00',
    lastChecklistResult: 'REPROVADO',
    blockingReason: 'Em oficina — folga no terminal de direção',
    lastSyncAt: '2026-08-07T07:12:00-03:00',
  },
  {
    vehicleId: 'veh-005',
    plate: 'RKH5F77',
    model: 'Volvo FH 460',
    status: 'DISPONIVEL',
    bay: 'B-02',
    odometerKm: 231_760,
    kmToMaintenance: 15_240,
    lastChecklistAt: '2026-08-06T06:35:00-03:00',
    lastChecklistResult: 'APROVADO',
    lastSyncAt: '2026-08-07T07:44:00-03:00',
  },
  {
    vehicleId: 'veh-008',
    plate: 'RKH8H34',
    model: 'Mercedes-Benz Actros',
    /* Reprovação bloqueante trava o veículo (RF-016) — não pode ficar
       "disponível" com impedimento aberto, que é contradição na mesma linha. */
    status: 'BLOQUEADO',
    bay: 'B-05',
    odometerKm: 178_450,
    kmToMaintenance: 2_100,
    lastChecklistAt: '2026-08-06T16:20:00-03:00',
    lastChecklistResult: 'REPROVADO',
    blockingReason: 'Extintor com carga vencida — triagem pendente',
    lastSyncAt: '2026-08-07T07:36:00-03:00',
  },
];

/** Substituto do `GET /v1/operator/yard`. */
export async function mockYard(): Promise<YardVehicle[]> {
  await delay(600);
  return YARD.map((item) => ({ ...item }));
}

/**
 * Substituto do `GET /v1/operator/overview`.
 *
 * `canSeeFinancials` imita o backend: quando o papel não tem visibilidade
 * financeira (RF-007), o campo **não vem no payload** — não é a tela que
 * esconde. Ela só explica que está bloqueado.
 */
export async function mockOperatorOverview(
  period: AnalyticsPeriod,
  canSeeFinancials: boolean,
): Promise<OperatorOverview> {
  await delay(650);

  const today = ENTRIES.filter(
    (entry) => new Date(entry.createdAt).toDateString() === new Date('2026-08-07').toDateString(),
  );

  const pending = TRIAGE.filter((item) => item.status === 'PENDENTE');

  return {
    periodLabel: PERIOD_LABEL[period],
    source: `Lançamentos, checklists e rastreador · ${PERIOD_LABEL[period]}`,
    triagePending: pending.length,
    triageBlocking: pending.filter((item) => item.blocking).length,
    entriesToday: today.length,
    amountToday: canSeeFinancials ? today.reduce((sum, entry) => sum + entry.amount, 0) : undefined,
    vehiclesInYard: YARD.filter((item) => Boolean(item.bay)).length,
    /*
     * "Impedimento" é o que trava a saída, não o status do veículo: um caminhão
     * em oficina também não sai. Contar por `status === BLOQUEADO` deixava o
     * indicador do topo em 2 e o quadro do pátio em 4, na mesma tela.
     */
    vehiclesBlocked: YARD.filter((item) => Boolean(item.blockingReason)).length,
    recentEntries: ENTRIES.slice(0, 5).map((entry) => ({ ...entry })),
  };
}
