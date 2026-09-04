/**
 * Tipos da visão geral do gestor (versão 2).
 *
 * Escopo deliberadamente operacional: **nada de dinheiro**. Receita, custo e
 * margem são do painel do proprietário. A pergunta desta tela é uma só: quantos
 * caminhões podem rodar hoje e o que está impedindo os outros.
 *
 * Slice isolado de propósito enquanto a tela está em avaliação. Nada aqui é
 * importado pela visão geral atual, e nada daqui importa código dela.
 */

/** Estados da frota. Mutuamente exclusivos: a soma fecha com o total. */
export type FleetState = 'DISPONIVEL' | 'EM_VIAGEM' | 'MANUTENCAO' | 'PARADO' | 'SEM_SINAL';

export interface FleetVehicle {
  id: string;
  plate: string;
  model: string;
  state: FleetState;
}

/** Quebra da frota por estado, já contada. */
export interface FleetSummary {
  total: number;
  available: number;
  onTrip: number;
  inMaintenance: number;
  /** Parado sem viagem e sem ordem aberta. */
  idle: number;
  /**
   * Sem leitura do rastreador há mais de 24 horas.
   *
   * ⚠️ Separado de `idle` de propósito: um caminhão sem sinal não está parado,
   * está invisível. Somados, o gestor vai procurar na oficina um veículo que
   * pode estar rodando com o rastreador mudo.
   */
  noSignal: number;
}

/**
 * Prontidão de gente.
 *
 * Treze caminhões disponíveis não saem sem motorista, então o número anda ao
 * lado do da frota. `unavailable` é "sem registro no período", que inclui folga
 * e quem dirigiu sem se identificar: chamar isso de indisponibilidade daria
 * quase a equipe inteira no primeiro dia de coleta.
 */
export interface DriverSummary {
  total: number;
  available: number;
  onTrip: number;
  unavailable: number;
  /** CNH vencendo nos próximos 60 dias. */
  cnhExpiringSoon: number;
}

/**
 * As filas que dependem de uma decisão do gestor.
 *
 * ⚠️ Não é o mesmo que impedimento. Impedimento é o que a plataforma detecta;
 * isto é o que ela está **esperando de você**, e cada pedido na fila é um
 * caminhão parado no pátio.
 */
export interface ManagerDecisions {
  pendingReleases: number;
  /** Casos graves que subiram: não são mais da alçada do gestor. */
  awaitingOwner: number;
  /** Anomalias detectadas ainda sem parecer escrito. */
  openDiagnoses: number;
  /** Espera do pedido mais antigo da fila, em horas. */
  oldestWaitHours: number;
}

/**
 * Degraus de impedimento, em ordem de urgência.
 *
 * `SEM_VISIBILIDADE` não é "menos grave": é o que não dá para afirmar. Um
 * checklist não realizado pode esconder um bloqueio, e por isso ele fica na
 * mesma fila, e não num canto separado da tela.
 */
export type BlockerSeverity = 'BLOQUEIA_AGORA' | 'BLOQUEIA_EM_BREVE' | 'SEM_VISIBILIDADE';

export type BlockerKind =
  | 'CHECKLIST_REPROVADO'
  | 'DOCUMENTO_VEICULO'
  | 'CNH_VENCIDA'
  | 'MANUTENCAO_VENCENDO'
  | 'LICENCIAMENTO'
  | 'MULTA'
  | 'CHECKLIST_PENDENTE'
  | 'PARADO_SEM_JUSTIFICATIVA'
  | 'VIAGEM_SEM_ATUALIZACAO'
  | 'RASTREADOR_SEM_SINAL';

/** Ação primária do item. Hoje só navega; a tratativa em si virá do backend. */
export interface BlockerAction {
  label: string;
  to: string;
}

export interface Blocker {
  id: string;
  vehicleId: string;
  plate: string;
  kind: BlockerKind;
  severity: BlockerSeverity;
  /** Uma linha, no imperativo do fato: o que está errado, com o número dele. */
  description: string;
  driverName?: string | undefined;
  action: BlockerAction;
}

export interface ActiveTrip {
  id: string;
  plate: string;
  driverName: string;
  destination: string;
  /** Previsão de chegada, ISO 8601. */
  etaAt: string;
  /** Última posição conhecida, `[longitude, latitude]` como o MapLibre espera. */
  position: [number, number];
  /** Minutos de atraso sobre a previsão original. Zero quando está no prazo. */
  delayMinutes: number;
}

/** Tipos de evento de condução que a tela sabe desenhar. */
export type SafetyEventType =
  | 'EXCESSO_VELOCIDADE'
  | 'SONOLENCIA'
  | 'FRENAGEM_BRUSCA'
  | 'CURVA_AGRESSIVA'
  | 'CELULAR_AO_VOLANTE';

/**
 * Retrato da segurança na janela recente.
 *
 * ⚠️ `perThousandKm` é o número que mede segurança, e não a contagem bruta: uma
 * frota que rodou o dobro no mês gera o dobro de eventos sem ter piorado nada.
 * A contagem serve para dimensionar a fila de tratativa, a taxa para dizer se
 * melhorou ou piorou.
 */
export interface SafetySnapshot {
  /** Janela do retrato, escrita para aparecer na tela ("últimas 48 horas"). */
  windowLabel: string;
  criticalEvents: number;
  attentionEvents: number;
  /** Contestações de motorista aguardando decisão do gestor. */
  pendingContests: number;
  perThousandKm: number;
  perThousandKmPrevious: number;
  byType: { type: SafetyEventType; count: number }[];
}

export interface FleetOverview {
  fleet: FleetSummary;
  drivers: DriverSummary;
  decisions: ManagerDecisions;
  blockers: Blocker[];
  trips: ActiveTrip[];
  safety: SafetySnapshot;
  /** Procedência do dado (RN-121): o número vem com a origem colada nele. */
  source: string;
}
