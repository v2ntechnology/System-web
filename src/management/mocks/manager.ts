import type {
  AnalyticsPeriod,
  Anomaly,
  ChecklistFailure,
  Diagnosis,
  ManagerOverview,
  OperationalMetric,
  OperationalTrendPoint,
  ReleaseRequest,
} from '@/management/types';

import { ApiError, delay } from './latency';
import { countPendingOwnerApprovals, enqueueOwnerApproval } from './owner';

/**
 * Substitutos dos endpoints da visão do gestor.
 *
 * ⚠️ Nada aqui devolve receita, margem ou lucro. O gestor analisa a operação em
 * profundidade; o resultado financeiro global é do dono, e o que sobe de um para
 * o outro é o **parecer**, não a planilha.
 *
 * Dados fictícios, exclusivos de desenvolvimento.
 */

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  '30D': 'últimos 30 dias',
  '3M': 'últimos 3 meses',
  '6M': 'últimos 6 meses',
  '12M': 'últimos 12 meses',
};

/** Quem está logado no mock — o backend tira isso do token. */
const MANAGER_NAME = 'Rafael Antunes';

/* -------------------------------------------------------------------------- */
/* Liberações                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fila de liberações.
 *
 * Mutável de propósito: liberar, exigir plano de ação e escalar precisam
 * refletir na lista, senão a tela não exercita o estado pós-decisão.
 */
const RELEASES: ReleaseRequest[] = [
  {
    id: 'rel-001',
    kind: 'VEICULO',
    subject: 'RKH5F77',
    plate: 'RKH5F77',
    driverName: 'Patrícia Nunes',
    severity: 'LEVE',
    status: 'PENDENTE',
    requestedAt: '2026-08-06T06:40:00-03:00',
    tripCode: 'VG-2291',
    destination: 'Juiz de Fora — MG',
    waitingHours: 2,
    blockers: [
      {
        id: 'blk-001',
        label: 'Lanterna de placa queimada',
        source: 'Checklist de saída #5120',
        severity: 'LEVE',
        at: '2026-08-06T06:35:00-03:00',
        hasPhoto: true,
      },
      {
        id: 'blk-002',
        label: 'Triângulo de sinalização ausente',
        source: 'Checklist de saída #5120',
        severity: 'LEVE',
        at: '2026-08-06T06:35:00-03:00',
        hasPhoto: false,
      },
    ],
  },
  {
    id: 'rel-002',
    kind: 'VEICULO',
    subject: 'RKH9C10',
    plate: 'RKH9C10',
    driverName: 'Edson Bastos',
    severity: 'MEDIA',
    status: 'PENDENTE',
    requestedAt: '2026-08-06T05:10:00-03:00',
    tripCode: 'VG-2288',
    destination: 'Vitória — ES',
    waitingHours: 4,
    blockers: [
      {
        id: 'blk-003',
        label: 'Folga no terminal de direção',
        source: 'Checklist de devolução #5109',
        severity: 'MEDIA',
        at: '2026-08-06T05:05:00-03:00',
        hasPhoto: true,
      },
      {
        id: 'blk-004',
        label: 'Pneu do eixo dianteiro com 2,1 mm de sulco',
        source: 'Inspeção de pátio',
        severity: 'MEDIA',
        at: '2026-08-06T05:08:00-03:00',
        hasPhoto: true,
      },
    ],
  },
  {
    id: 'rel-003',
    kind: 'MOTORISTA',
    subject: 'Wagner Teixeira',
    driverName: 'Wagner Teixeira',
    plate: 'RKH3G56',
    severity: 'GRAVE',
    status: 'PENDENTE',
    requestedAt: '2026-08-06T04:20:00-03:00',
    tripCode: 'VG-2286',
    destination: 'Feira de Santana — BA',
    waitingHours: 6,
    blockers: [
      {
        id: 'blk-005',
        label: 'Três eventos de sonolência na última jornada',
        source: 'Telemetria e visão computacional',
        severity: 'GRAVE',
        at: '2026-08-06T03:50:00-03:00',
        hasPhoto: false,
      },
      {
        id: 'blk-006',
        label: 'Jornada excedida em 1h40 sem pausa registrada',
        source: 'Controle de jornada',
        severity: 'GRAVE',
        at: '2026-08-06T04:10:00-03:00',
        hasPhoto: false,
      },
    ],
  },
  {
    id: 'rel-004',
    kind: 'VEICULO',
    subject: 'RKH2B88',
    plate: 'RKH2B88',
    driverName: 'Marina Cordeiro',
    severity: 'LEVE',
    status: 'LIBERADO',
    requestedAt: '2026-08-05T07:15:00-03:00',
    tripCode: 'VG-2279',
    destination: 'Campinas — SP',
    waitingHours: 1,
    blockers: [
      {
        id: 'blk-007',
        label: 'Nível de água do parabrisa abaixo do mínimo',
        source: 'Checklist de saída #5098',
        severity: 'LEVE',
        at: '2026-08-05T07:10:00-03:00',
        hasPhoto: false,
      },
    ],
    decision: {
      by: MANAGER_NAME,
      at: '2026-08-05T07:28:00-03:00',
      note: 'Reservatório completado no pátio antes da saída. Sem impacto na viagem.',
    },
  },
  {
    id: 'rel-005',
    kind: 'VEICULO',
    subject: 'RKH1D23',
    plate: 'RKH1D23',
    driverName: 'Wagner Teixeira',
    severity: 'GRAVE',
    status: 'AGUARDANDO_DONO',
    requestedAt: '2026-08-05T17:50:00-03:00',
    waitingHours: 38,
    blockers: [
      {
        id: 'blk-008',
        label: 'Vazamento no sistema de freio',
        source: 'Checklist de devolução #4417',
        severity: 'GRAVE',
        at: '2026-08-05T17:45:00-03:00',
        hasPhoto: true,
      },
    ],
    decision: {
      by: MANAGER_NAME,
      at: '2026-08-05T18:20:00-03:00',
      note: 'Reparo concluído e reteste aprovado. Ocorrência grave: liberação depende do proprietário.',
      actionPlan: [
        'Troca de pastilhas e cilindro mestre concluída na Oficina Central',
        'Reteste do checklist de freio aprovado em 05/08',
        'Motorista reciclado em condução defensiva antes da próxima viagem',
      ],
    },
    /* Casa com `apr-001` na fila do dono — é o mesmo caso, visto dos dois lados. */
    escalatedApprovalId: 'apr-001',
  },
];

/** Substituto do `GET /v1/manager/releases`. */
export async function mockReleases(): Promise<ReleaseRequest[]> {
  await delay(600);
  return RELEASES.map((item) => ({ ...item }));
}

/**
 * Abre um pedido na fila do gestor.
 *
 * Chamado pela triagem do operador quando um checklist reprovado impede a saída.
 * É a mesma lista que a tela de Liberações lê — no backend, uma tabela só. A
 * cadeia inteira do RookHub passa por aqui: motorista → operador → gestor →
 * proprietário.
 */
export function enqueueRelease(request: Omit<ReleaseRequest, 'id' | 'status'>): ReleaseRequest {
  const created: ReleaseRequest = {
    ...request,
    id: `rel-${String(RELEASES.length + 1).padStart(3, '0')}`,
    status: 'PENDENTE',
  };
  RELEASES.unshift(created);
  return created;
}

/** Quantos pedidos esperam o gestor — usado pelo painel do operador. */
export function countPendingReleases() {
  return RELEASES.filter((item) => item.status === 'PENDENTE').length;
}

export interface ReleaseDecisionPayload {
  releaseId: string;
  /** `LIBERAR` só vale para leve e média; grave sempre escala. */
  action: 'LIBERAR' | 'ESCALAR' | 'RECUSAR';
  note: string;
  /** Passos do plano de ação — obrigatório em ocorrência média. */
  actionPlan?: string[] | undefined;
}

/**
 * Substituto do `POST /v1/manager/releases/{id}/decision`.
 *
 * As regras do fluxo de risco vivem aqui **e no backend** — a tela apenas
 * reflete. Leve o gestor libera direto; média exige plano de ação; grave ele não
 * pode liberar de jeito nenhum, só escalar para o proprietário.
 */
export async function mockDecideRelease({
  releaseId,
  action,
  note,
  actionPlan,
}: ReleaseDecisionPayload): Promise<ReleaseRequest> {
  await delay(800);

  const target = RELEASES.find((item) => item.id === releaseId);

  if (!target) {
    throw new ApiError(404, 'Liberação não encontrada', 'Este pedido não existe mais.');
  }

  if (target.status !== 'PENDENTE') {
    throw new ApiError(
      409,
      'Pedido já tratado',
      'Alguém já decidiu esta liberação. Recarregue a fila.',
    );
  }

  if (note.trim().length < 10) {
    throw new ApiError(422, 'Justificativa obrigatória', 'Descreva o motivo da decisão.');
  }

  if (target.severity === 'GRAVE' && action === 'LIBERAR') {
    throw new ApiError(
      403,
      'Ocorrência grave não é sua alçada',
      'O veículo permanece bloqueado até a aprovação formal do proprietário.',
    );
  }

  if (target.severity === 'MEDIA' && action === 'LIBERAR' && (actionPlan?.length ?? 0) === 0) {
    throw new ApiError(
      422,
      'Plano de ação obrigatório',
      'Ocorrência média exige pelo menos um passo de plano de ação.',
    );
  }

  const decision = {
    by: MANAGER_NAME,
    at: new Date().toISOString(),
    note: note.trim(),
    ...(actionPlan && actionPlan.length > 0 ? { actionPlan } : {}),
  };

  if (action === 'ESCALAR') {
    /* O caso vira uma decisão na fila do dono — mesma tabela, dois painéis. */
    const created = enqueueOwnerApproval({
      /* O dono precisa ver o que está retido: caminhão e motorista não são a
         mesma decisão, mesmo quando a pendência é a mesma. */
      kind: target.kind === 'MOTORISTA' ? 'LIBERACAO_MOTORISTA' : 'LIBERACAO_VEICULO',
      title: `Liberar ${target.subject} após ocorrência grave`,
      summary: note.trim(),
      severity: 'GRAVE',
      requestedBy: MANAGER_NAME,
      requestedAt: new Date().toISOString(),
      plate: target.plate,
      driverName: target.driverName,
      actionPlan,
      evidence: [
        { label: 'Pendências', value: `${target.blockers.length}` },
        { label: 'Horas parado', value: `${target.waitingHours} h` },
        ...target.blockers.slice(0, 2).map((blocker) => ({
          label: blocker.source,
          value: blocker.label,
        })),
      ],
    });

    target.status = 'AGUARDANDO_DONO';
    target.escalatedApprovalId = created.id;
  } else {
    target.status = action === 'LIBERAR' ? 'LIBERADO' : 'RECUSADO';
  }

  target.decision = decision;
  return { ...target };
}

/* -------------------------------------------------------------------------- */
/* Anomalias e pareceres                                                       */
/* -------------------------------------------------------------------------- */

const ANOMALIES: Anomaly[] = [
  {
    id: 'ano-001',
    title: 'Custos fixos 10,4% acima do período anterior',
    description:
      'A camada de custos fixos por quilômetro subiu de R$ 0,64 para R$ 0,67 nos últimos seis meses, enquanto a quilometragem cresceu. É o único custo que sobe com a frota rodando mais.',
    category: 'CUSTO',
    severity: 'MEDIA',
    detectedAt: '2026-08-04T08:00:00-03:00',
    evidence: [
      { label: 'Variação', value: '+10,4%' },
      { label: 'Custo por km', value: 'R$ 0,67' },
      { label: 'Participação no custo', value: '17%' },
      { label: 'Impacto no período', value: 'R$ 355.380' },
    ],
  },
  {
    id: 'ano-002',
    title: 'Três corretivas no RKH3G56 em 60 dias',
    description:
      'O Iveco S-Way acumulou três ordens corretivas em dois meses e opera 18% acima do custo por km da frota. O padrão sugere causa sistêmica, não evento isolado.',
    category: 'MANUTENCAO',
    severity: 'MEDIA',
    detectedAt: '2026-08-03T09:30:00-03:00',
    evidence: [
      { label: 'Corretivas em 60 dias', value: '3 ordens' },
      { label: 'Custo por km', value: '18% acima da frota' },
      { label: 'Disponibilidade', value: '82%' },
    ],
    diagnosisId: 'dgn-001',
  },
  {
    id: 'ano-003',
    title: 'Eventos de sonolência concentrados na madrugada',
    description:
      'Sete de nove eventos de sonolência do período ocorreram entre 2h e 5h, sempre nos mesmos dois motoristas. A escala de madrugada não está distribuída.',
    category: 'SEGURANCA',
    severity: 'GRAVE',
    detectedAt: '2026-08-06T04:30:00-03:00',
    evidence: [
      { label: 'Eventos no período', value: '9' },
      { label: 'Entre 2h e 5h', value: '7 (78%)' },
      { label: 'Motoristas envolvidos', value: '2' },
      { label: 'Jornadas excedidas', value: '4' },
    ],
  },
  {
    id: 'ano-004',
    title: 'Desvio de rota recorrente no trecho BR-116',
    description:
      'Doze viagens desviaram da rota planejada no mesmo trecho, com acréscimo médio de 38 km. Pode ser obra na pista — ou rota planejada desatualizada.',
    category: 'OPERACAO',
    severity: 'LEVE',
    detectedAt: '2026-08-02T14:15:00-03:00',
    evidence: [
      { label: 'Viagens afetadas', value: '12' },
      { label: 'Acréscimo médio', value: '38 km' },
      { label: 'Combustível extra', value: 'R$ 4.820' },
    ],
  },
];

const DIAGNOSES: Diagnosis[] = [
  {
    id: 'dgn-001',
    anomalyId: 'ano-002',
    anomalyTitle: 'Três corretivas no RKH3G56 em 60 dias',
    category: 'MANUTENCAO',
    status: 'ENVIADO',
    finding:
      'Desgaste prematuro de embreagem causado pelo perfil de rota, não por condução — o veículo foi escalado para trechos de serra em 80% das viagens do período. O score do motorista está estável em 91.',
    actionPlan: [
      'Remanejar o veículo para rotas de baixa declividade por 90 dias',
      'Reavaliar o custo por km ao fim do trimestre',
      'Cotar substituição caso a corretiva se repita',
    ],
    writtenBy: MANAGER_NAME,
    updatedAt: '2026-08-04T10:05:00-03:00',
    sentToOwner: true,
  },
];

/** Substituto do `GET /v1/manager/anomalies`. */
export async function mockAnomalies(): Promise<Anomaly[]> {
  await delay(600);
  return ANOMALIES.map((item) => ({ ...item }));
}

/** Substituto do `GET /v1/manager/diagnoses`. */
export async function mockDiagnoses(): Promise<Diagnosis[]> {
  await delay(500);
  return DIAGNOSES.map((item) => ({ ...item }));
}

export interface DiagnosisPayload {
  anomalyId: string;
  finding: string;
  actionPlan: string[];
  /** Sobe para aprovação do dono — obrigatório em anomalia grave. */
  sendToOwner: boolean;
}

/** Substituto do `POST /v1/manager/diagnoses`. */
export async function mockSaveDiagnosis({
  anomalyId,
  finding,
  actionPlan,
  sendToOwner,
}: DiagnosisPayload): Promise<Diagnosis> {
  await delay(800);

  const anomaly = ANOMALIES.find((item) => item.id === anomalyId);
  if (!anomaly) {
    throw new ApiError(404, 'Anomalia não encontrada', 'Esta anomalia não existe mais.');
  }

  if (finding.trim().length < 20) {
    throw new ApiError(
      422,
      'Parecer muito curto',
      'Descreva a causa apurada em pelo menos 20 caracteres.',
    );
  }

  /*
   * Anomalia grave não pode ficar só no rascunho do gestor: o dono precisa
   * decidir. A regra é do backend; a tela apenas não oferece a alternativa.
   */
  if (anomaly.severity === 'GRAVE' && !sendToOwner) {
    throw new ApiError(
      422,
      'Anomalia grave exige envio',
      'O parecer de uma anomalia grave precisa subir para o proprietário.',
    );
  }

  const existing = DIAGNOSES.find((item) => item.anomalyId === anomalyId);

  const diagnosis: Diagnosis = {
    id: existing?.id ?? `dgn-${String(DIAGNOSES.length + 1).padStart(3, '0')}`,
    anomalyId,
    anomalyTitle: anomaly.title,
    category: anomaly.category,
    status: sendToOwner ? 'ENVIADO' : 'RASCUNHO',
    finding: finding.trim(),
    actionPlan,
    writtenBy: MANAGER_NAME,
    updatedAt: new Date().toISOString(),
    sentToOwner: sendToOwner,
  };

  if (existing) Object.assign(existing, diagnosis);
  else DIAGNOSES.push(diagnosis);

  anomaly.diagnosisId = diagnosis.id;

  if (sendToOwner) {
    enqueueOwnerApproval({
      kind: 'PARECER_CRITICO',
      title: `Parecer: ${anomaly.title.toLowerCase()}`,
      summary: diagnosis.finding,
      severity: anomaly.severity,
      requestedBy: MANAGER_NAME,
      requestedAt: diagnosis.updatedAt,
      actionPlan: actionPlan.length > 0 ? actionPlan : undefined,
      evidence: anomaly.evidence,
    });
  }

  return { ...diagnosis };
}

/* -------------------------------------------------------------------------- */
/* Painel operacional                                                          */
/* -------------------------------------------------------------------------- */

const METRICS: OperationalMetric[] = [
  {
    id: 'checklist-reprovado',
    label: 'Checklists reprovados',
    value: 14,
    delta: -3,
    lowerIsBetter: true,
    hint: 'de 186 preenchimentos no período',
  },
  {
    id: 'fadiga',
    label: 'Eventos de sonolência',
    value: 9,
    delta: 2,
    lowerIsBetter: true,
    hint: 'detectados pela visão computacional',
  },
  {
    id: 'desvio-rota',
    label: 'Desvios de rota',
    value: 21,
    delta: -6,
    lowerIsBetter: true,
    hint: 'acima de 15 km da rota planejada',
  },
  {
    id: 'jornada',
    label: 'Jornadas excedidas',
    value: 4,
    delta: -2,
    lowerIsBetter: true,
    hint: 'sem pausa registrada no período legal',
  },
  {
    id: 'disponibilidade',
    label: 'Disponibilidade da frota',
    value: 91,
    unit: '%',
    delta: 3,
    lowerIsBetter: false,
    hint: 'tempo apto a rodar',
  },
  {
    id: 'pontualidade',
    label: 'Entregas no prazo',
    value: 94,
    unit: '%',
    delta: 1,
    lowerIsBetter: false,
    hint: 'contra o prazo acordado com o cliente',
  },
];

const TREND: OperationalTrendPoint[] = [
  { label: 'sem 1', fatigue: 1, harshDriving: 6, speeding: 12 },
  { label: 'sem 2', fatigue: 2, harshDriving: 5, speeding: 10 },
  { label: 'sem 3', fatigue: 1, harshDriving: 4, speeding: 9 },
  { label: 'sem 4', fatigue: 2, harshDriving: 3, speeding: 7 },
  { label: 'sem 5', fatigue: 3, harshDriving: 3, speeding: 8 },
];

const FAILURES: ChecklistFailure[] = [
  {
    id: 'fal-001',
    plate: 'RKH3G56',
    driverName: 'Wagner Teixeira',
    item: 'Cinto de segurança do motorista',
    severity: 'GRAVE',
    at: '2026-08-06T04:15:00-03:00',
    blocking: true,
    hasPhoto: true,
  },
  {
    id: 'fal-002',
    plate: 'RKH9C10',
    driverName: 'Edson Bastos',
    item: 'Folga no terminal de direção',
    severity: 'MEDIA',
    at: '2026-08-06T05:05:00-03:00',
    blocking: true,
    hasPhoto: true,
  },
  {
    id: 'fal-003',
    plate: 'RKH5F77',
    driverName: 'Patrícia Nunes',
    item: 'Lanterna de placa queimada',
    severity: 'LEVE',
    at: '2026-08-06T06:35:00-03:00',
    blocking: false,
    hasPhoto: true,
  },
  {
    id: 'fal-004',
    plate: 'RKH8H34',
    driverName: 'Marina Cordeiro',
    item: 'Extintor com carga vencida',
    severity: 'MEDIA',
    at: '2026-08-05T16:20:00-03:00',
    blocking: true,
    hasPhoto: false,
  },
  {
    id: 'fal-005',
    plate: 'RKH7E45',
    driverName: 'Edson Bastos',
    item: 'Espelho retrovisor direito trincado',
    severity: 'LEVE',
    at: '2026-08-05T11:05:00-03:00',
    blocking: false,
    hasPhoto: true,
  },
];

/** Substituto do `GET /v1/manager/overview`. */
export async function mockManagerOverview(period: AnalyticsPeriod): Promise<ManagerOverview> {
  await delay(650);

  const pending = RELEASES.filter((item) => item.status === 'PENDENTE');

  return {
    periodLabel: PERIOD_LABEL[period],
    source: `Telemetria, checklists e controle de jornada · ${PERIOD_LABEL[period]}`,
    vehiclesReady: 34,
    vehiclesBlocked: RELEASES.filter(
      (item) => item.kind === 'VEICULO' && item.status !== 'LIBERADO',
    ).length,
    driversReady: 29,
    driversUnavailable: 3,
    pendingReleases: pending.length,
    awaitingOwner: countPendingOwnerApprovals(),
    openAnomalies: ANOMALIES.filter((item) => !item.diagnosisId).length,
    metrics: METRICS,
    trend: TREND,
    failures: FAILURES,
  };
}
