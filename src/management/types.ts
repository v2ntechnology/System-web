/**
 * Contratos de domínio compartilhados entre as aplicações.
 *
 * Estes tipos são escritos à mão APENAS enquanto não existe backend.
 * Quando o backend expuser o OpenAPI 3.1 (BE-04), o cliente e os tipos
 * passam a ser gerados em `packages/api-client` e este pacote fica restrito
 * a tipos puramente de frontend.
 */

/**
 * Papéis de usuário (RF-003).
 *
 * `DRIVER` não tem acesso ao painel: entra apenas pelo app do motorista
 * (`apps/driver`). Ele mora no mesmo union porque a autorização é do backend e
 * o token é o mesmo — separar o tipo daria a impressão de dois sistemas de
 * identidade, que não é o caso.
 */
export type Role = 'OWNER' | 'MANAGER' | 'OPERATOR' | 'MAINTENANCE' | 'SUPER_ADMIN' | 'DRIVER';

/** Módulos contratáveis por plano (RF-002 / tenant_modules). */
export type Module =
  'FLEET' | 'TRIPS' | 'CHECKLIST' | 'COSTS' | 'MAINTENANCE' | 'SAFETY' | 'ASSISTANT';

export interface Tenant {
  id: string;
  name: string;
  /** Módulos efetivamente contratados — base do gate de entitlement (RF-002). */
  modules: Module[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  avatarUrl?: string | undefined;
  /** RF-007 — controla se OPERATOR enxerga valores financeiros. */
  operatorSeesFinancials: boolean;
  mfaEnabled: boolean;
  /** Só em contas DRIVER: cadastro correspondente em `drivers`. */
  driverId?: string | undefined;
}

export interface Session {
  user: User;
  tenant: Tenant;
  /** JWT de acesso — 15 min (BE-11). Mockado nesta fase. */
  accessToken: string;
  expiresAt: string;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

/** Hub/filial que o dashboard está exibindo. */
export interface Hub {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface DriverRanking {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | undefined;
  /** Score de segurança 0–100 (RF-031). */
  score: number;
  /** 1 = ouro, 2 = prata, 3 = bronze. */
  position: number;
}

export interface HubMetric {
  id: string;
  label: string;
  value: number;
  unit?: string | undefined;
  accent: 'indigo' | 'cyan';
  icon: 'truck' | 'wrench' | 'route' | 'warning';
}

export type MaintenanceStatus = 'ATRASADA' | 'HOJE' | 'AGENDADA';

export interface MaintenanceOrder {
  id: string;
  /** Placa do veículo. */
  plate: string;
  model: string;
  service: string;
  status: MaintenanceStatus;
  /** Data prevista, ISO 8601. */
  dueAt: string;
  workshop: string;
}

/** Um mês da série de custo por km, em camadas (RN-055). */
export interface CostPerKmPoint {
  /** Rótulo curto do período, ex.: "jan". */
  month: string;
  fuel: number;
  maintenance: number;
  fixed: number;
}

export interface DashboardSummary {
  hub: Hub;
  topDrivers: DriverRanking[];
  metrics: HubMetric[];
  maintenance: MaintenanceOrder[];
  costPerKm: CostPerKmPoint[];
}

/* -------------------------------------------------------------------------- */
/* Frota                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `SEM_SINAL` nasceu do dado real: numa frota de verdade sempre há caminhão que
 * parou de reportar, por rastreador desligado, veículo em pátio ou equipamento
 * com defeito. Sem esse estado ele apareceria como disponível, e alguém contaria
 * com um caminhão que ninguém sabe onde está.
 *
 * `BLOQUEADO` continua sendo outra coisa: pendência de checklist (RF-016), que
 * impede a saída de um veículo que está reportando normalmente.
 */
export type VehicleStatus = 'EM_VIAGEM' | 'DISPONIVEL' | 'MANUTENCAO' | 'BLOQUEADO' | 'SEM_SINAL';

/**
 * Campo opcional aqui significa "a telemetria não tem essa informação".
 *
 * Ano de fabricação, custo por quilômetro e plano de manutenção não existem na
 * MiX. A tela mostra travessão no lugar. Preencher com zero seria pior: ninguém
 * distinguiria depois o medido do inventado.
 */
export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  /** Sem origem na telemetria: cadastro manual. */
  year?: number | undefined;
  status: VehicleStatus;
  /** Motorista atualmente vinculado, quando houver. */
  driverName?: string | undefined;
  odometerKm: number;
  /** Filial a que o veículo pertence no fornecedor. */
  unit?: string | undefined;
  /** R$/km consolidado dos últimos 30 dias. Depende de custos, que não vêm da telemetria. */
  costPerKm?: number | undefined;
  /** Km restantes até a próxima manutenção preventiva. Negativo = vencida. */
  kmToMaintenance?: number | undefined;
  /** Última sincronização com o rastreador, ISO 8601 (RN-140). Ausente = nunca reportou. */
  lastSyncAt?: string | undefined;
}

/** Uma barra do mini-ranking de despesa: quanto um veículo pesou na categoria. */
export interface ExpenseRankEntry {
  plate: string;
  value: number;
}

export type ExpenseCategoryId = 'MAINTENANCE' | 'FUEL' | 'FINES';

export interface ExpenseCategory {
  id: ExpenseCategoryId;
  label: string;
  /** Total gasto na categoria no período. */
  total: number;
  /** Variação percentual contra o período anterior. */
  deltaPercent: number;
  /** Os veículos que mais pesaram, em ordem decrescente. */
  ranking: ExpenseRankEntry[];
}

/** Custo total acumulado por veículo — base do bloco "Top caminhões". */
export interface VehicleCostRank {
  plate: string;
  value: number;
}

/** Detalhamento de um veículo, carregado sob demanda ao selecioná-lo. */
export interface VehicleDetail {
  vehicleId: string;
  /**
   * km/l consolidado do período.
   *
   * Ausente quando o rastreador não informa consumo: depende de o veículo ter a
   * rede CAN ligada ao equipamento, e boa parte da frota real não tem.
   */
  fuelEfficiency?: number | undefined;
  /** Percentual do período com o veículo efetivamente rodando. */
  availability?: number | undefined;
  openOrders: number;
  /** Última manutenção concluída, ISO 8601. Vazio quando não há registro. */
  lastMaintenanceAt: string;
  /** Custo mensal do veículo, R$/km. Vazio enquanto não houver origem de custo. */
  monthlyCost: { month: string; value: number }[];
  /** Quilômetros por dia, medidos pelos trechos. Alimenta o gráfico de uso. */
  dailyDistance?: { day: string; km: number }[] | undefined;
  /** Distância total e número de trechos no período. */
  distanceKm?: number | undefined;
  journeys?: number | undefined;
  recentEvents: {
    id: string;
    label: string;
    at: string;
    severity: 'CRITICO' | 'ATENCAO' | 'INFO';
  }[];
}

/** Posição de um veículo no mapa ao vivo. */
export interface VehiclePosition {
  vehicleId: string;
  plate: string;
  status: VehicleStatus;
  driverName?: string | undefined;
  /** [longitude, latitude] — ordem do GeoJSON, não a de "lat, long" do senso comum. */
  coordinates: [number, number];
  speedKmh: number;
  /** Direção em graus, 0 = norte. */
  heading: number;
  /** Última sincronização com o rastreador, ISO 8601 (RN-140). */
  lastSyncAt: string;
  /**
   * Trecho ou cidade mais próxima, para quem lê sem olhar o mapa.
   *
   * Vazio quando a MiX não geocodificou a leitura: as posições do fluxo
   * incremental vêm sem `FormattedAddress`, que só acompanha início e fim de
   * trecho. A lista mostra a coordenada nesse caso.
   */
  place?: string | undefined;
}

/* -------------------------------------------------------------------------- */
/* Custos (RF-018 a RF-022)                                                    */
/* -------------------------------------------------------------------------- */

/** Custo consolidado de um veículo no período, nas três camadas (RN-055). */
export interface VehicleCostRow {
  vehicleId: string;
  plate: string;
  model: string;
  kmDriven: number;
  fuel: number;
  maintenance: number;
  fixed: number;
  /** Soma das camadas dividida pelos km — o número que o dono olha. */
  costPerKm: number;
}

/** Abastecimento individual, com a marcação de anomalia (RF-022). */
export interface FuelingRecord {
  id: string;
  at: string;
  plate: string;
  driverName: string;
  station: string;
  liters: number;
  pricePerLiter: number;
  total: number;
  /** km/l apurado desde o abastecimento anterior. */
  efficiency: number;
  /**
   * Fora do padrão histórico do veículo. O motivo acompanha porque "anomalia"
   * sem explicação não ajuda ninguém a decidir.
   */
  anomaly?: string | undefined;
}

export interface CostsSummary {
  totalCostPerKm: number;
  deltaPercent: number;
  fuel: number;
  maintenance: number;
  fixed: number;
  kmDriven: number;
  /** Procedência do número (RN-121). */
  source: string;
  layers: CostPerKmPoint[];
  vehicles: VehicleCostRow[];
  fuelings: FuelingRecord[];
}

/* -------------------------------------------------------------------------- */
/* Viagens (RF-011)                                                            */
/* -------------------------------------------------------------------------- */

/** Máquina de estados da viagem (RF-011). A ordem aqui é a ordem do fluxo. */
export type TripStatus =
  'PLANEJADA' | 'EM_CARREGAMENTO' | 'EM_TRANSITO' | 'EM_DESCARGA' | 'CONCLUIDA' | 'CANCELADA';

export interface TripEvent {
  status: TripStatus;
  at: string;
  note?: string | undefined;
}

export interface Trip {
  id: string;
  code: string;
  status: TripStatus;
  origin: string;
  destination: string;
  distanceKm: number;
  driverName: string;
  plate: string;
  cargo: string;
  startedAt: string;
  /** Prazo acordado com o cliente, ISO 8601. */
  dueAt: string;
  /** Conclusão real; ausente enquanto a viagem não terminou. */
  finishedAt?: string | undefined;
  /** Progresso 0–100 da distância percorrida. */
  progressPercent: number;
  timeline: TripEvent[];
}

/* -------------------------------------------------------------------------- */
/* Motoristas                                                                  */
/* -------------------------------------------------------------------------- */

export type DriverStatus = 'EM_VIAGEM' | 'DISPONIVEL' | 'DESCANSO' | 'AFASTADO';

export interface Driver {
  id: string;
  name: string;
  avatarUrl?: string | undefined;
  status: DriverStatus;
  /**
   * Nota de condução, 0 a 100 (RF-031).
   *
   * Ausente quando o motorista rodou pouco demais no período para ter nota. Cada
   * cliente configura eventos diferentes na telemetria, então a nota é relativa
   * à própria frota: 75 é a média dela, 100 é quem não gera evento.
   */
  score?: number | undefined;
  /** Variação do score contra o período anterior, em pontos. */
  scoreDelta?: number | undefined;
  tripsCount: number;
  kmDriven: number;
  criticalEvents: number;
  /** Sem origem na telemetria: vem do RH. */
  cnhCategory?: string | undefined;
  /** Vencimento da CNH, ISO 8601. Sem origem na telemetria. */
  cnhExpiresAt?: string | undefined;
  currentVehiclePlate?: string | undefined;
  /** Filial a que o motorista pertence no fornecedor. */
  unit?: string | undefined;
}

export type WarningSeverity = 'LEVE' | 'MEDIA' | 'GRAVE';

/**
 * Mídia de um evento de segurança.
 *
 * RN-092 — o RookHub **não armazena vídeo**. Guarda metadados e uma URL assinada
 * que aponta para o fornecedor (Hik-Connect), com expiração máxima de 15 minutos
 * (RNF-022). Por isso a URL é pedida sob demanda, e não vem na listagem.
 */
export interface EventMedia {
  provider: string;
  durationSeconds: number;
  /** Instante do clipe, ISO 8601. */
  recordedAt: string;
  /** Preenchida só quando o usuário pede para assistir. */
  signedUrl?: string | undefined;
  expiresAt?: string | undefined;
}

export interface DriverWarning {
  id: string;
  title: string;
  description: string;
  severity: WarningSeverity;
  /** Data da advertência, ISO 8601. */
  at: string;
  /** Quem aplicou. */
  issuedBy: string;
  /** Trecho onde ocorreu, quando houver. */
  location?: string | undefined;
  vehiclePlate?: string | undefined;
  /** Motorista contestou a advertência (RF-029). */
  contested?: boolean | undefined;
  media?: EventMedia | undefined;
}

/**
 * Categorias de comportamento ao volante.
 *
 * As três últimas entraram com o dado real: a frota usa câmera MiX Vision, que
 * gera alerta de colisão e de cinto, e o pacote de direção econômica gera
 * aceleração brusca. Sem elas, esses eventos cairiam todos em um balde só.
 *
 * O backend classifica pela descrição do tipo de evento, porque cada cliente
 * batiza os eventos do jeito dele: nesta frota eles se chamam "VELOCIDADE
 * LIMITE" e "USO DOS FREIOS".
 */
export type RoadEventType =
  | 'EXCESSO_VELOCIDADE'
  | 'FRENAGEM_BRUSCA'
  | 'ACELERACAO_BRUSCA'
  | 'CURVA_AGRESSIVA'
  | 'JORNADA_EXCEDIDA'
  | 'DISTRACAO'
  | 'SONOLENCIA'
  | 'COLISAO_IMINENTE'
  | 'CINTO_SEGURANCA';

export interface RoadEventCount {
  type: RoadEventType;
  label: string;
  count: number;
  /** Variação contra o período anterior, em ocorrências. */
  delta: number;
}

/**
 * Ficha completa do motorista.
 *
 * ⚠️ **Tudo que é de RH é opcional.** CPF, CNH, admissão, salário e regime não
 * existem na telemetria: a MiX devolve nome, matrícula e telefone, mais o que o
 * veículo mediu. Enquanto não houver integração com a folha, esses campos
 * chegam vazios e a tela diz "não informado".
 *
 * A alternativa seria preencher com valor plausível, e um CPF mascarado
 * inventado passaria por real para qualquer pessoa que olhasse.
 */
export interface DriverProfile {
  driverId: string;

  /* Pessoais */
  birthDate?: string | undefined;
  cpfMasked?: string | undefined;
  phone?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;

  /* Habilitação */
  cnhNumber?: string | undefined;
  cnhCategory?: string | undefined;
  cnhExpiresAt?: string | undefined;
  /** Exerce Atividade Remunerada, obrigatório para motorista profissional. */
  cnhEar?: boolean | undefined;
  /** Pontos na CNH (0 a 40 antes da suspensão). */
  cnhPoints?: number | undefined;

  /* Contrato */
  hiredAt?: string | undefined;
  role?: string | undefined;
  /** Salário base mensal. Só chega ao cliente se o papel puder ver (RF-007). */
  monthlySalary?: number | undefined;
  contractType?: string | undefined;

  /* Operação no período: isto sim vem da telemetria. */
  avgFuelEfficiency?: number | undefined;
  onTimeDeliveryRate?: number | undefined;
  hoursDriven?: number | undefined;
  distanceKm?: number | undefined;
  journeys?: number | undefined;
  /** Filial a que pertence no fornecedor. */
  unit?: string | undefined;
  employeeNumber?: string | undefined;
  currentVehiclePlate?: string | undefined;

  /** Evolução da nota. `month` carrega a data quando a série é diária. */
  scoreHistory: { month: string; score: number }[];
  roadEvents: RoadEventCount[];
  warnings: DriverWarning[];
}

export type RankingPeriod = 'MES' | 'ANO';

export interface DriverRankEntry {
  driverId: string;
  name: string;
  avatarUrl?: string | undefined;
  score: number;
  kmDriven: number;
  position: number;
}

/* -------------------------------------------------------------------------- */
/* Segurança (RF-025 a RF-031)                                                 */
/* -------------------------------------------------------------------------- */

export type SafetySeverity = 'CRITICO' | 'ATENCAO' | 'LEVE';

export interface SafetyEvent {
  id: string;
  type: RoadEventType;
  typeLabel: string;
  severity: SafetySeverity;
  driverId: string;
  driverName: string;
  plate: string;
  at: string;
  location: string;
  description: string;
  /** Já virou advertência formal para o motorista. */
  warned: boolean;
  media?: EventMedia | undefined;
}

export type ContestStatus = 'PENDENTE' | 'ACEITA' | 'RECUSADA';

/** Contestação de evento pelo motorista (RF-029). */
export interface SafetyContest {
  id: string;
  eventId: string;
  eventLabel: string;
  driverName: string;
  plate: string;
  at: string;
  /** Justificativa escrita pelo motorista. */
  reason: string;
  status: ContestStatus;
  /** Preenchido quando o gestor decide — vai para o log de auditoria. */
  decision?: { by: string; at: string; note: string };
}

/**
 * Câmera priorizada para o operador (RN-080).
 *
 * ⚠️ O score vem de **sinais não-visuais** — telemetria, jornada, horário,
 * histórico (DAT-04). O RookHub não analisa vídeo; `RT-03` rejeita formalmente
 * construir pipeline próprio de mídia.
 */
export interface CopilotCamera {
  vehicleId: string;
  plate: string;
  driverName: string;
  /** 0–100. Probabilidade relativa de evento nas próximas horas. */
  riskScore: number;
  /** Sinais que compuseram o score, do mais pesado para o menos. */
  signals: { label: string; weight: 'ALTO' | 'MEDIO' }[];
  hoursDriving: number;
  place: string;
}

/**
 * `fleetScore` é a média das notas dos motoristas, e as notas são relativas à
 * própria frota. Ele mede a dispersão da equipe, não segurança absoluta: uma
 * frota inteira dirigindo mal, mas por igual, tira nota alta.
 *
 * O número que mede segurança é `eventsPer1000Km` comparado ao período
 * anterior. É ele que responde "melhoramos ou pioramos".
 */
export interface SafetySummary {
  events: SafetyEvent[];
  contests: SafetyContest[];
  copilot: CopilotCamera[];
  fleetScore?: number | undefined;
  scoreDelta?: number | undefined;
  /** Eventos de condução por mil quilômetros rodados no período. */
  eventsPer1000Km?: number | undefined;
  eventsPer1000KmPrevious?: number | undefined;
  /** Contagem por categoria, com o período anterior para comparação. */
  byType?:
    { type: RoadEventType; label: string; count: number; previousCount: number }[] | undefined;
  totalEvents?: number | undefined;
  criticalEvents?: number | undefined;
  distanceKm?: number | undefined;
}

/* -------------------------------------------------------------------------- */
/* Manutenção (RF-023, RF-024)                                                 */
/* -------------------------------------------------------------------------- */

export type ServiceOrderType = 'PREVENTIVA' | 'CORRETIVA';
export type ServiceOrderStatus = 'ABERTA' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'ATRASADA';

export interface ServiceOrder {
  id: string;
  code: string;
  plate: string;
  model: string;
  type: ServiceOrderType;
  status: ServiceOrderStatus;
  service: string;
  workshop: string;
  openedAt: string;
  dueAt: string;
  finishedAt?: string | undefined;
  cost: number;
  /** Horas com o veículo parado — o custo invisível da manutenção. */
  downtimeHours: number;
  items: { label: string; cost: number }[];
}

/** Plano preventivo por quilometragem (RF-023). */
export interface MaintenancePlan {
  id: string;
  name: string;
  intervalKm: number;
  appliesTo: string;
  /** Veículos que já passaram do intervalo. */
  overdueVehicles: string[];
  nextVehicles: { plate: string; kmToService: number }[];
}

export interface Workshop {
  id: string;
  name: string;
  city: string;
  ordersInPeriod: number;
  averageCost: number;
  averageDowntimeHours: number;
}

export interface MaintenanceSummary {
  orders: ServiceOrder[];
  plans: MaintenancePlan[];
  workshops: Workshop[];
}

/* -------------------------------------------------------------------------- */
/* Checklists (RF-012 a RF-017)                                                */
/* -------------------------------------------------------------------------- */

export type ChecklistResult = 'APROVADO' | 'REPROVADO';

export interface ChecklistItemResult {
  label: string;
  result: ChecklistResult;
  note?: string | undefined;
  /** Foto anexada pelo motorista (RN-040). */
  hasPhoto?: boolean | undefined;
}

export interface ChecklistFill {
  id: string;
  plate: string;
  driverName: string;
  templateName: string;
  /** Versão do template usada — gravada em cada preenchimento (RN-033). */
  templateVersion: string;
  /**
   * Dois timestamps (RN-054): `filledAt` vem do relógio do aparelho, `receivedAt`
   * do servidor. Divergência acima de 6h vira flag de auditoria.
   */
  filledAt: string;
  receivedAt: string;
  result: ChecklistResult;
  /** Reprovação que impede a saída do veículo (RF-016). */
  blocking: boolean;
  releasedAt?: string | undefined;
  releasedBy?: string | undefined;
  releaseReason?: string | undefined;
  items: ChecklistItemResult[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  version: string;
  itemCount: number;
  updatedAt: string;
  appliesTo: string;
  active: boolean;
}

export interface ChecklistSummary {
  fills: ChecklistFill[];
  templates: ChecklistTemplate[];
}

/* -------------------------------------------------------------------------- */
/* Configurações                                                               */
/* -------------------------------------------------------------------------- */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mfaEnabled: boolean;
  lastAccessAt?: string | undefined;
}

export type IntegrationHealth = 'OK' | 'ATRASADA' | 'FALHA';

/** Fornecedor conectado, com a saúde da sincronização (RN-140). */
export interface Integration {
  id: string;
  provider: string;
  kind: string;
  health: IntegrationHealth;
  lastSuccessfulSyncAt: string;
  vehiclesCovered: number;
  note?: string | undefined;
}

export interface SettingsSummary {
  members: TeamMember[];
  integrations: Integration[];
  /** Todos os módulos do catálogo, contratados ou não (RF-002). */
  modules: { id: Module; label: string; description: string; contracted: boolean }[];
  planName: string;
}

/* -------------------------------------------------------------------------- */
/* Relatórios                                                                  */
/* -------------------------------------------------------------------------- */

export type ReportCategory = 'CUSTOS' | 'OPERACAO' | 'SEGURANCA' | 'MANUTENCAO';

export type ReportFormat = 'PDF' | 'XLSX' | 'CSV';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  /** Módulo exigido pelo plano — trava a exportação quando não contratado (RF-002). */
  requiredModule: Module;
  /** Última geração, ISO 8601. */
  generatedAt: string;
  /** Formatos disponíveis para download. */
  formats: ReportFormat[];
  /** Colunas que o arquivo traz — o usuário precisa saber antes de exportar. */
  columns: string[];
  /** Linhas estimadas no período selecionado. */
  estimatedRows: number;
}

/** Recorte temporal compartilhado por relatórios, custos, segurança e manutenção. */
export type AnalyticsPeriod = '30D' | '3M' | '6M' | '12M';

/** Amostra das primeiras linhas, para conferir antes de gerar o arquivo inteiro. */
export interface ReportPreview {
  reportId: string;
  columns: string[];
  rows: (string | number)[][];
  totalRows: number;
  /** Procedência do número (RN-121) — vai junto no cabeçalho do arquivo. */
  source: string;
}

export type ReportRunStatus = 'PRONTO' | 'PROCESSANDO' | 'FALHOU';

/** Uma geração concreta de relatório — o que o usuário pediu e o que saiu. */
export interface ReportRun {
  id: string;
  reportId: string;
  reportTitle: string;
  format: ReportFormat;
  periodLabel: string;
  requestedBy: string;
  requestedAt: string;
  status: ReportRunStatus;
  sizeKb?: number | undefined;
  /** Preenchido quando `status === "FALHOU"`. */
  error?: string | undefined;
}

export type ScheduleFrequency = 'DIARIO' | 'SEMANAL' | 'MENSAL';

/** Envio recorrente por e-mail (RF-038 / notifications). */
export interface ReportSchedule {
  id: string;
  reportId: string;
  reportTitle: string;
  frequency: ScheduleFrequency;
  format: ReportFormat;
  /** Próxima execução, ISO 8601. */
  nextRunAt: string;
  recipients: string[];
  active: boolean;
}

/* -------------------------------------------------------------------------- */
/* Assistente — "Pergunte à sua frota" (RF-033 a RF-037)                       */
/* -------------------------------------------------------------------------- */

export interface AssistantSeries {
  label: string;
  data: { x: string; y: number }[];
}

export interface AssistantTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Ação contextual embutida na resposta (RN-116). */
export interface AssistantAction {
  label: string;
  to?: string | undefined;
}

export interface AssistantAnswer {
  id: string;
  text: string;
  /** Gráfico, quando a resposta é uma série temporal ou comparação. */
  chart?: {
    kind: 'bar' | 'line';
    unit: string;
    series: AssistantSeries[];
  };
  table?: AssistantTable | undefined;
  actions?: AssistantAction[] | undefined;
  /**
   * Procedência do número (RN-121). Toda resposta declara em cima de que dado e de
   * que período foi calculada — sem isso o gestor não pode confiar para decidir.
   */
  source?: string | undefined;
  /** Verdadeiro quando a pergunta caiu fora do escopo temático (RN-120/RN-124). */
  refused?: boolean | undefined;
}

export interface AssistantTurn {
  id: string;
  question: string;
  answer?: AssistantAnswer | undefined;
  status: 'pending' | 'done' | 'error';
}

/* -------------------------------------------------------------------------- */
/* Notificações — Central global multi-módulo (RF-038)                         */
/* -------------------------------------------------------------------------- */

export type NotificationSeverity = 'CRITICO' | 'ATENCAO' | 'INFO';

/** Módulo que originou a notificação — a central é multi-módulo por definição. */
export type NotificationSource =
  'SAFETY' | 'MAINTENANCE' | 'CHECKLIST' | 'TRIPS' | 'COSTS' | 'INTEGRATIONS';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  source: NotificationSource;
  /** ISO 8601. */
  at: string;
  read: boolean;
  /** Ação contextual embutida (RN-091) — abrir a viagem, ligar para o motorista. */
  actionLabel?: string | undefined;
  actionTo?: string | undefined;
}

/* -------------------------------------------------------------------------- */
/* Visão do Dono — estratégica e macro (RF-003)                                */
/* -------------------------------------------------------------------------- */

/**
 * Tom de um achado do resumo analítico.
 *
 * Não é severidade de incidente: diz se o período **ganhou** ou **perdeu**
 * dinheiro naquele ponto. `ATENCAO` é o que ainda não virou perda.
 */
export type OwnerInsightTone = 'GANHO' | 'ATENCAO' | 'PERDA';

/**
 * Achado do resumo analítico textual.
 *
 * O dono não deve precisar interpretar gráfico para saber onde está perdendo
 * dinheiro — o texto afirma o quê, o porquê e quanto custou.
 */
export interface OwnerInsight {
  id: string;
  tone: OwnerInsightTone;
  title: string;
  /** Texto corrido: o que aconteceu e a causa apurada. */
  text: string;
  /** Impacto no resultado do período. Negativo = prejuízo. */
  impact: number;
  /** Procedência do número (RN-121). */
  source: string;
  /** Para onde ir e resolver — sem isso o achado morre na leitura (RN-116). */
  action?: { label: string; to: string };
}

/** Natureza da linha da DRE — define o sinal e a apresentação. */
export type IncomeStatementLineKind = 'RECEITA' | 'DEDUCAO' | 'CUSTO' | 'RESULTADO';

/**
 * Linha da DRE.
 *
 * Valores sempre **positivos**; quem carrega o sinal é o `kind`. Guardar
 * "-1.640.000" no custo obrigaria cada tela a adivinhar a convenção.
 */
export interface IncomeStatementLine {
  id: string;
  label: string;
  kind: IncomeStatementLineKind;
  value: number;
  /** Participação na receita líquida, em %. */
  sharePercent: number;
  /** Variação contra o período anterior, em %. */
  deltaPercent: number;
  /**
   * Texto que substitui a variação quando o percentual não tem significado.
   *
   * Variação percentual sobre base negativa é aritmética sem leitura: sair de
   * −R$ 322 mil para +R$ 1,3 mi dá "−517%", que o olho lê como piora quando é o
   * oposto. Nesses casos o backend manda a frase e a tela mostra a frase.
   */
  deltaNote?: string | undefined;
  /** Detalhamento, quando a linha agrupa categorias. */
  children?: { label: string; value: number; deltaPercent: number }[];
}

export type OperationalCostCategoryId =
  'FUEL' | 'PEOPLE' | 'FIXED' | 'MAINTENANCE' | 'TIRES' | 'FINES';

export interface OperationalCostCategory {
  id: OperationalCostCategoryId;
  label: string;
  value: number;
  deltaPercent: number;
  /** R$/km da categoria — o único jeito de comparar períodos de km diferente. */
  costPerKm: number;
  /** Participação no custo total, em %. */
  sharePercent: number;
}

/** Um mês da série de resultado. */
export interface ResultPoint {
  month: string;
  /** Receita bruta do mês. */
  revenue: number;
  /** Custo operacional total do mês. */
  cost: number;
  /** Margem líquida do mês, em % da receita líquida. */
  netMarginPercent: number;
}

export interface IncomeStatement {
  periodLabel: string;
  revenue: number;
  /** Receita bruta menos as deduções sobre o faturamento. */
  netRevenue: number;
  deductions: number;
  totalCost: number;
  /** Receita líquida menos o custo total. Negativo = prejuízo no período. */
  netResult: number;
  netMarginPercent: number;
  /** Variação da margem contra o período anterior, em pontos percentuais. */
  netMarginDeltaPoints: number;
  kmDriven: number;
  costPerKm: number;
  /** Procedência do número (RN-121). */
  source: string;
  lines: IncomeStatementLine[];
  categories: OperationalCostCategory[];
  /**
   * Série mensal de tendência — sempre 12 meses, independente do período
   * agregado. Um recorte de 30 dias renderiza um gráfico de um ponto só.
   */
  series: ResultPoint[];
}

/** Rentabilidade de um veículo no período — gamificação do ativo. */
export interface FleetProfitability {
  vehicleId: string;
  plate: string;
  model: string;
  revenue: number;
  cost: number;
  /** Receita menos custo no período. */
  result: number;
  /** Margem do veículo, em % da própria receita. */
  marginPercent: number;
  kmDriven: number;
  revenuePerKm: number;
  costPerKm: number;
  position: number;
}

/**
 * Destaque de gamificação do motorista (RF-031).
 *
 * As conquistas vêm nomeadas do backend: o dono premia lendo a lista, sem
 * precisar cruzar score com km numa planilha.
 */
export interface DriverHighlight {
  driverId: string;
  name: string;
  avatarUrl?: string | undefined;
  position: number;
  score: number;
  /** Variação do score contra o período anterior, em pontos. */
  scoreDelta: number;
  kmDriven: number;
  fuelEfficiency: number;
  onTimeDeliveryRate: number;
  criticalEvents: number;
  badges: string[];
}

/**
 * Decisão que só o dono pode tomar.
 *
 * `LIBERACAO_VEICULO` e `LIBERACAO_MOTORISTA` — ocorrência grave bloqueia o ativo
 * e a liberação exige aprovação formal do dono. São dois valores e não um porque
 * a tela precisa dizer o que está retido: "liberação de veículo" num pedido sobre
 * pessoa é ruído no meio de uma decisão séria. `PARECER_CRITICO` — síntese
 * analítica que o gestor enviou. `INVESTIMENTO` — gasto acima da alçada dele.
 */
export type OwnerApprovalKind =
  'LIBERACAO_VEICULO' | 'LIBERACAO_MOTORISTA' | 'PARECER_CRITICO' | 'INVESTIMENTO';

export type OwnerApprovalStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

export interface OwnerApproval {
  id: string;
  kind: OwnerApprovalKind;
  title: string;
  /** Síntese analítica redigida pelo gestor. */
  summary: string;
  severity: WarningSeverity;
  status: OwnerApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  plate?: string | undefined;
  driverName?: string | undefined;
  /** Impacto financeiro estimado da decisão. */
  financialImpact?: number | undefined;
  /** Plano de ação do gestor — obrigatório em ocorrência média e grave. */
  actionPlan?: string[] | undefined;
  /** Números que embasam o parecer, já formatados pelo backend. */
  evidence: { label: string; value: string }[];
  decision?: { by: string; at: string; note: string };
}

/** Cabeçalho da visão do dono — o que aparece antes de qualquer clique. */
export interface OwnerSummary {
  periodLabel: string;
  revenue: number;
  netResult: number;
  netMarginPercent: number;
  netMarginDeltaPoints: number;
  costPerKm: number;
  kmDriven: number;
  source: string;
  insights: OwnerInsight[];
  categories: OperationalCostCategory[];
  series: ResultPoint[];
  /** Quantas decisões esperam o dono agora. */
  pendingApprovals: number;
}

/* -------------------------------------------------------------------------- */
/* Visão do Gestor — analítica intermediária e liberações (RF-003)             */
/* -------------------------------------------------------------------------- */

/**
 * Indicador do painel operacional do gestor.
 *
 * ⚠️ Nenhum indicador daqui carrega receita, margem ou lucro: a visão do gestor
 * é operacional por definição, e o resultado financeiro global é do dono. O que
 * o gestor apura em detalhe sobe sintetizado, via parecer.
 */
export interface OperationalMetric {
  id: string;
  label: string;
  value: number;
  unit?: string | undefined;
  /** Variação contra o período anterior, na mesma unidade do valor. */
  delta: number;
  /**
   * Verdadeiro quando **subir é ruim** (eventos, reprovações, desvios).
   *
   * Sem isso a tela pinta de verde uma alta de fadiga — a seta para cima não
   * significa a mesma coisa em todo indicador.
   */
  lowerIsBetter: boolean;
  hint: string;
}

/** Uma semana da série de eventos operacionais. */
export interface OperationalTrendPoint {
  label: string;
  fatigue: number;
  routeDeviation: number;
  speeding: number;
}

/** Item reprovado num checklist, na fila de tratativa do gestor. */
export interface ChecklistFailure {
  id: string;
  plate: string;
  driverName: string;
  item: string;
  severity: WarningSeverity;
  at: string;
  /** Impede a saída do veículo (RF-016). */
  blocking: boolean;
  hasPhoto: boolean;
}

export interface ManagerOverview {
  periodLabel: string;
  source: string;
  /* Prontidão — o que pode sair agora. */
  vehiclesReady: number;
  vehiclesBlocked: number;
  driversReady: number;
  driversUnavailable: number;
  /* Filas que dependem do gestor. */
  pendingReleases: number;
  awaitingOwner: number;
  openAnomalies: number;
  metrics: OperationalMetric[];
  trend: OperationalTrendPoint[];
  failures: ChecklistFailure[];
}

/* --- Gestão de liberações (workflows de risco) ---------------------------- */

export type ReleaseSubjectKind = 'VEICULO' | 'MOTORISTA';

/**
 * Estado de um pedido de liberação.
 *
 * `AGUARDANDO_DONO` existe porque ocorrência grave **não** é decisão do gestor:
 * o veículo fica bloqueado e a liberação exige aprovação formal do proprietário.
 */
export type ReleaseStatus = 'PENDENTE' | 'LIBERADO' | 'AGUARDANDO_DONO' | 'RECUSADO';

/** Pendência concreta que impede a saída. */
export interface ReleaseBlocker {
  id: string;
  label: string;
  /** De onde veio o apontamento — checklist, telemetria, manutenção. */
  source: string;
  severity: WarningSeverity;
  at: string;
  hasPhoto: boolean;
}

export interface ReleaseRequest {
  id: string;
  kind: ReleaseSubjectKind;
  /** Placa do veículo ou nome do motorista, conforme o tipo. */
  subject: string;
  plate?: string | undefined;
  driverName?: string | undefined;
  /** A maior severidade entre as pendências — é ela que define o fluxo. */
  severity: WarningSeverity;
  status: ReleaseStatus;
  requestedAt: string;
  /** Viagem que depende desta liberação, quando houver. */
  tripCode?: string | undefined;
  destination?: string | undefined;
  /** Horas de ativo parado esperando a decisão. */
  waitingHours: number;
  blockers: ReleaseBlocker[];
  decision?: {
    by: string;
    at: string;
    note: string;
    /** Obrigatório em ocorrência média. */
    actionPlan?: string[] | undefined;
  };
  /** Preenchido quando o caso sobe para o dono. */
  escalatedApprovalId?: string | undefined;
}

/* --- Pareceres e diagnósticos --------------------------------------------- */

export type DiagnosisCategory = 'CUSTO' | 'SEGURANCA' | 'MANUTENCAO' | 'OPERACAO';

/**
 * Anomalia detectada pela plataforma, aguardando explicação do gestor.
 *
 * O objetivo do módulo é que o número chegue ao dono **já explicado**: sem o
 * parecer, o dono vê a variação e não a causa.
 */
export interface Anomaly {
  id: string;
  title: string;
  description: string;
  category: DiagnosisCategory;
  severity: WarningSeverity;
  detectedAt: string;
  /** Números que dispararam a detecção, já formatados. */
  evidence: { label: string; value: string }[];
  /** Parecer já redigido para esta anomalia, quando houver. */
  diagnosisId?: string | undefined;
}

export type DiagnosisStatus = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO';

export interface Diagnosis {
  id: string;
  anomalyId: string;
  anomalyTitle: string;
  category: DiagnosisCategory;
  status: DiagnosisStatus;
  /** Causa apurada pelo gestor. */
  finding: string;
  actionPlan: string[];
  writtenBy: string;
  updatedAt: string;
  /** Subiu para aprovação do dono (caso crítico). */
  sentToOwner: boolean;
}

/* -------------------------------------------------------------------------- */
/* Visão do Operador — lançamento e rotina de pátio (RF-003)                   */
/* -------------------------------------------------------------------------- */

/** Os quatro documentos que o operador digita na plataforma. */
export type EntryKind = 'ABASTECIMENTO' | 'MULTA' | 'ORDEM_MANUTENCAO' | 'DESPESA';

/**
 * Um lançamento feito pelo operador.
 *
 * ⚠️ `amount` é o valor do documento que ele tem na mão — nota, AIT, orçamento.
 * Digitar não é o mesmo que ter visibilidade financeira: o RF-007 trata do
 * **consolidado** (total do período, custo por km), não do papel sobre a mesa.
 */
export interface LaunchEntry {
  id: string;
  kind: EntryKind;
  /** Data do documento, ISO 8601. */
  at: string;
  /** Quando foi lançado na plataforma — os dois divergem, e isso importa. */
  createdAt: string;
  plate: string;
  driverName?: string | undefined;
  /** Posto, infração, serviço ou motivo, conforme o tipo. */
  description: string;
  amount: number;
  /** Nota fiscal, AIT ou número da ordem — é o que torna o lançamento auditável. */
  documentNumber?: string | undefined;
  createdBy: string;
}

/* --- Triagem de checklists ------------------------------------------------ */

export type TriageStatus = 'PENDENTE' | 'APROVADO' | 'ENVIADO_MANUTENCAO' | 'ESCALADO';

/** Item reprovado que o operador precisa triar. */
export interface TriageItem {
  id: string;
  label: string;
  severity: WarningSeverity;
  note?: string | undefined;
  hasPhoto: boolean;
}

export interface TriageFill {
  id: string;
  plate: string;
  driverName: string;
  templateName: string;
  /**
   * Dois timestamps (RN-054): `filledAt` vem do relógio do aparelho,
   * `receivedAt` do servidor.
   */
  filledAt: string;
  receivedAt: string;
  /** Divergência entre os dois relógios. Acima de 6h vira flag de auditoria. */
  clockSkewHours: number;
  status: TriageStatus;
  /** Reprovação que impede a saída do veículo (RF-016). */
  blocking: boolean;
  failures: TriageItem[];
  decision?: { by: string; at: string; note: string };
  /** Preenchido quando a triagem abre um pedido na fila do gestor. */
  releaseRequestId?: string | undefined;
}

/* --- Pátio ---------------------------------------------------------------- */

/** Um veículo como o operador o vê do pátio. */
export interface YardVehicle {
  vehicleId: string;
  plate: string;
  model: string;
  status: VehicleStatus;
  driverName?: string | undefined;
  /** Vaga no pátio. Ausente quando o veículo não está aqui. */
  bay?: string | undefined;
  odometerKm: number;
  /** Km até a próxima preventiva. Negativo = vencida. */
  kmToMaintenance: number;
  lastChecklistAt?: string | undefined;
  lastChecklistResult?: ChecklistResult | undefined;
  /** O que impede a saída, quando há impedimento. */
  blockingReason?: string | undefined;
  /** Última sincronização com o rastreador, ISO 8601 (RN-140). */
  lastSyncAt: string;
}

export interface OperatorOverview {
  periodLabel: string;
  source: string;
  triagePending: number;
  triageBlocking: number;
  entriesToday: number;
  /**
   * Total lançado no dia. **Ausente quando o papel não pode ver** (RF-007) — o
   * backend simplesmente não manda o campo, e a tela mostra o bloqueio.
   */
  amountToday?: number | undefined;
  vehiclesInYard: number;
  vehiclesBlocked: number;
  recentEntries: LaunchEntry[];
}

/* -------------------------------------------------------------------------- */
/* Plano e cobrança — assinatura do tenant (RF-002)                            */
/* -------------------------------------------------------------------------- */

export type BillingCycle = 'MENSAL' | 'ANUAL';

export type SubscriptionStatus = 'ATIVA' | 'INADIMPLENTE' | 'CANCELADA';

export type InvoiceStatus = 'PAGA' | 'ABERTA' | 'VENCIDA' | 'FALHOU';

/**
 * Consumo contra o limite do plano.
 *
 * `limit` negativo significa **ilimitado** — e não "zero". Um número mágico é
 * feio, mas menos feio que um `limit?: number` em que `undefined` poderia ser
 * tanto "sem limite" quanto "o backend esqueceu de mandar".
 */
export interface PlanQuota {
  id: string;
  label: string;
  used: number;
  limit: number;
  unit?: string | undefined;
  /** O que acontece ao estourar — o dono precisa saber antes, não depois. */
  overageNote?: string | undefined;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  /** Competência, ex.: "jul/2026". */
  periodLabel: string;
  issuedAt: string;
  dueAt: string;
  paidAt?: string | undefined;
  amount: number;
  /** Preenchido quando `status === "FALHOU"`. */
  failureReason?: string | undefined;
}

export interface PaymentMethod {
  kind: 'CARTAO' | 'BOLETO' | 'PIX';
  /** Bandeira do cartão. */
  brand?: string | undefined;
  /** Últimos quatro dígitos — **nunca** o número inteiro, nem no mock. */
  last4?: string | undefined;
  /** Validade no formato MM/AAAA. */
  expiresAt?: string | undefined;
  holderName?: string | undefined;
}

export interface Subscription {
  planName: string;
  planDescription: string;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  /** Valor total cobrado por ciclo — plano mais extensões. */
  amount: number;
  /** A parte do plano, sem as extensões. */
  planAmount: number;
  /**
   * A parte das extensões contratadas.
   *
   * Separado do plano porque o dono precisa saber o que é assinatura e o que é
   * serviço adicional: um total único esconde o que ele pode desligar.
   */
  extensionsAmount: number;
  /** Preço unitário por veículo, quando o plano cobra por ativo. */
  pricePerVehicle?: number | undefined;
  startedAt: string;
  nextChargeAt: string;
  /** Assinatura segue ativa até o fim do ciclo e não renova. */
  cancelAtPeriodEnd: boolean;
  quotas: PlanQuota[];
  paymentMethod: PaymentMethod;
  invoices: Invoice[];
}

/* -------------------------------------------------------------------------- */
/* Equipe — quadro de pessoas do tenant                                        */
/* -------------------------------------------------------------------------- */

/**
 * Uma pessoa do quadro.
 *
 * União discriminada por `kind` e não um objeto com tudo opcional: motorista tem
 * CNH e score, usuário do painel tem e-mail e MFA, e nenhum dos dois tem o campo
 * do outro. Com tudo opcional, cada tela precisaria checar `if (person.score)`
 * para descobrir com quem está falando.
 *
 * ⚠️ Nada de salário aqui. Dado financeiro de pessoa passa pelo RF-007 e vive na
 * ficha do motorista, que já faz esse gate. Um diretório de equipe não é lugar
 * para valor — e replicar o gate em duas telas é onde uma delas esquece.
 */
interface TeamPersonBase {
  id: string;
  name: string;
  avatarUrl?: string | undefined;
  /** Cargo legível, já pronto para exibição. */
  roleLabel: string;
  /** Admissão, ISO 8601. */
  hiredAt?: string | undefined;
  phone?: string | undefined;
}

export interface TeamDriver extends TeamPersonBase {
  kind: 'MOTORISTA';
  status: DriverStatus;
  /** Score de segurança 0–100 (RF-031). */
  score: number;
  /** Variação contra o período anterior, em pontos. */
  scoreDelta: number;
  kmDriven: number;
  criticalEvents: number;
  cnhCategory: string;
  cnhExpiresAt: string;
  currentVehiclePlate?: string | undefined;
}

export interface TeamStaff extends TeamPersonBase {
  kind: 'PAINEL';
  role: Role;
  email: string;
  active: boolean;
  mfaEnabled: boolean;
  lastAccessAt?: string | undefined;
}

export type TeamPerson = TeamDriver | TeamStaff;

export interface TeamSummary {
  headcount: number;
  drivers: number;
  staff: number;
  /** Motoristas aptos a assumir viagem agora. */
  driversAvailable: number;
  /** Em descanso, afastados ou impedidos. */
  driversUnavailable: number;
  /** CNH que vence nos próximos 60 dias — prazo de renovação, não de susto. */
  cnhExpiringSoon: number;
  /**
   * Acessos ativos sem segundo fator.
   *
   * Aparece aqui como sinal, não como gestão: quem cria, desativa e força MFA é
   * a tela de Configurações. Duas telas donas da mesma ação divergem.
   */
  withoutMfa: number;
  people: TeamPerson[];
}

/* -------------------------------------------------------------------------- */
/* Extensões — marketplace de integrações contratáveis                         */
/* -------------------------------------------------------------------------- */

export type ExtensionCategory =
  'TELEMETRIA' | 'COMBUSTIVEL' | 'PEDAGIO' | 'CAMERAS' | 'COMUNICACAO' | 'FISCAL';

/**
 * Ciclo de vida de uma extensão.
 *
 * `AGUARDANDO_CONFIGURACAO` existe porque contratar e conectar são dois atos: o
 * cliente ativa (e passa a pagar) antes de ter as credenciais em mão. Sem esse
 * estado, a tela teria de mentir dizendo "ativa" sobre algo que ainda não traz
 * nenhum dado.
 */
export type ExtensionStatus = 'DISPONIVEL' | 'AGUARDANDO_CONFIGURACAO' | 'ATIVA';

/**
 * Como a extensão é cobrada.
 *
 * União discriminada: um preço fixo e um preço por veículo não são o mesmo campo
 * com significados diferentes, e a tela precisa saber qual conta apresentar.
 */
export type ExtensionBilling =
  | { model: 'MENSAL_FIXO'; monthlyPrice: number }
  | { model: 'POR_VEICULO'; pricePerVehicle: number }
  | { model: 'INCLUSA' };

/**
 * Campo de credencial pedido pelo fornecedor.
 *
 * ⚠️ `secret` **nunca** volta preenchido do backend. O que retorna é o
 * `configuredHint` mascarado — devolver a chave para a tela seria expor no
 * cliente um segredo que só o servidor precisa ter.
 */
export interface ExtensionCredentialField {
  name: string;
  label: string;
  kind: 'text' | 'secret';
  placeholder?: string | undefined;
  hint?: string | undefined;
}

export interface Extension {
  id: string;
  name: string;
  vendor: string;
  /** Uma linha do que a extensão faz. */
  tagline: string;
  description: string;
  category: ExtensionCategory;
  billing: ExtensionBilling;
  status: ExtensionStatus;
  /** O que ela traz para dentro do RookHub. */
  capabilities: string[];
  /** Onde o dado dela aparece no painel — sem isto, "integrar" é abstrato. */
  surfacesIn: string[];
  credentialFields: ExtensionCredentialField[];
  /** Pista mascarada do que já foi salvo. Nunca o segredo. */
  configuredHint?: string | undefined;
  activatedAt?: string | undefined;
  /* Saúde da sincronização, no mesmo vocabulário das integrações (RN-140). */
  health?: IntegrationHealth | undefined;
  lastSuccessfulSyncAt?: string | undefined;
  vehiclesCovered?: number | undefined;
  healthNote?: string | undefined;
  /** Módulo do plano exigido — sem ele a extensão aparece bloqueada (RF-002). */
  requiredModule?: Module | undefined;
}

export interface ExtensionsSummary {
  extensions: Extension[];
  /** Soma mensal das ativas — o que entra na próxima fatura. */
  monthlyTotal: number;
  /** Veículos ativos, base do preço por veículo. */
  billableVehicles: number;
  nextChargeAt: string;
}

/* -------------------------------------------------------------------------- */
/* App do motorista (apps/driver)                                              */
/* -------------------------------------------------------------------------- */

/**
 * O que o motorista vê ao abrir o app.
 *
 * É uma composição do que o painel já modela (`Trip`, `Driver`), recortada pela
 * ótica de quem dirige: uma viagem corrente, o que vem depois e as pendências
 * que travam a saída. No backend isto é um único `GET /v1/driver/home` — o app
 * de campo roda em rede ruim, e três chamadas na abertura custam caro.
 */
export interface DriverHome {
  driver: Driver;
  /** Viagem em andamento; ausente quando o motorista está livre. */
  currentTrip?: Trip | undefined;
  nextTrips: Trip[];
  /** RF-016 — checklist do dia ainda não enviado para o veículo atual. */
  checklistPending: boolean;
  /** Bloqueio ativo por checklist reprovado (RN-040): veículo não pode sair. */
  blockedByChecklist: boolean;
  /** Odômetro do último abastecimento — base do km/l do próximo. */
  lastOdometerKm: number;
  cnhExpiresAt: string;
}

export interface DriverChecklistItem {
  id: string;
  label: string;
  hint?: string | undefined;
  /** Reprovar este item bloqueia a saída do veículo (RF-016). */
  blocking: boolean;
  /** Reprovação exige foto anexada (RN-040). */
  requiresPhotoOnFail: boolean;
}

export interface DriverChecklistSection {
  title: string;
  items: DriverChecklistItem[];
}

export interface DriverChecklistTemplate {
  id: string;
  name: string;
  /** Gravada em cada preenchimento (RN-033) — o template muda, o histórico não. */
  version: string;
  sections: DriverChecklistSection[];
}

export interface DriverChecklistAnswer {
  itemId: string;
  result: ChecklistResult;
  note?: string | undefined;
  /** URI local da foto no aparelho; o upload é do app, não deste contrato. */
  photoUri?: string | undefined;
}

export interface DriverChecklistSubmission {
  templateId: string;
  templateVersion: string;
  plate: string;
  tripId?: string | undefined;
  /** Relógio do aparelho (RN-054) — o servidor carimba o dele na chegada. */
  filledAt: string;
  answers: DriverChecklistAnswer[];
}

export interface DriverChecklistReceipt {
  id: string;
  result: ChecklistResult;
  blocking: boolean;
  receivedAt: string;
  /** Mensagem pronta para a tela: o que acontece agora com o veículo. */
  message: string;
}

export interface DriverFuelEntryInput {
  plate: string;
  tripId?: string | undefined;
  station: string;
  liters: number;
  pricePerLiter: number;
  /** Odômetro no momento do abastecimento — sem ele não há km/l. */
  odometerKm: number;
  at: string;
  receiptPhotoUri?: string | undefined;
}

/** Confirmação do abastecimento, já com o km/l apurado pelo servidor. */
export interface DriverFuelEntryReceipt {
  id: string;
  total: number;
  efficiency: number;
  /** Fora do padrão do veículo — texto explicativo, não só um sinalizador. */
  anomaly?: string | undefined;
}

/** Erro no padrão RFC 9457 (Problem Details) — convenção do backend (BE-04). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string | undefined;
  instance?: string | undefined;
  errors?: Record<string, string[]> | undefined;
}
