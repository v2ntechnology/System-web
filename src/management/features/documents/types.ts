/**
 * Guias do veículo: licenciamento, IPVA e cronotacógrafo.
 *
 * ⚠️ **O RookHub não paga nada.** A Smartec não processa pagamento: ela entrega
 * o documento em PDF e a linha digitável, e quem paga é a pessoa, no banco dela.
 * O que esta tela oferece é material para pagar, nunca ordem de pagamento.
 */

export type DocumentKind =
  | 'LICENCIAMENTO'
  | 'IPVA_COTA1'
  | 'IPVA_COTA2'
  | 'IPVA_COTA3'
  | 'IPVA_COTA_UNICA'
  | 'CRONOTACOGRAFO';

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  plate: string;
  fleetNumber: string | null;
  kind: DocumentKind;
  exercise: number | null;
  amount: number | null;
  dueDate: string | null;
  /** PDF hospedado pela Smartec. Nulo quando ela não gerou a guia. */
  documentUrl: string | null;
  /** Só licenciamento e cronotacógrafo trazem. O IPVA vem sem, medido. */
  digitableLine: string | null;
  status: string | null;
  issuer: string | null;
  searchedAt: string | null;
  /**
   * A data da guia já passou.
   *
   * ⚠️ **Não quer dizer que há dívida.** A guia de licenciamento vence em
   * janeiro, e quem pagou em janeiro fica com a data passada o ano inteiro. Na
   * frota real são 88 com data passada e 9 pendências de verdade.
   */
  overdue: boolean;
  /** Pendência real, calculada por tipo. É esta que a tela destaca. */
  pending: boolean;
}

export interface DocumentSummary {
  total: number;
  /** Pendências de verdade, e não guias com data passada. */
  overdue: number;
  dueIn30Days: number;
  openAmount: number;
  /** Veículos que a Smartec nunca pesquisou. Conta veículo, não guia. */
  neverSearched: number;
}

export interface DocumentList {
  items: VehicleDocument[];
  summary: DocumentSummary;
}

/** Como cada tipo se chama na tela, e o que ele significa. */
export const KIND_LABEL: Record<DocumentKind, string> = {
  LICENCIAMENTO: 'Licenciamento',
  IPVA_COTA1: 'IPVA, 1ª cota',
  IPVA_COTA2: 'IPVA, 2ª cota',
  IPVA_COTA3: 'IPVA, 3ª cota',
  IPVA_COTA_UNICA: 'IPVA, cota única',
  CRONOTACOGRAFO: 'Cronotacógrafo',
};

/**
 * A situação documental de um veículo, resumida em uma palavra.
 *
 * ⚠️ **Nenhum destes níveis bloqueia nada** (decisão do usuário em 19/09/2026).
 * A frota real apareceu com 9 cronotacógrafos vencidos e 3 licenciamentos
 * atrasados, e travar 12 dos 40 caminhões de uma transportadora em operação,
 * com base num dado que a empresa ainda não conferiu, pararia o cliente por
 * engano nosso. A plataforma mostra e escreve o motivo; quem decide se o
 * caminhão sai é o gestor.
 *
 * `SEM_CONSULTA` não é o degrau leve: é o que não dá para afirmar. Sem ficha, a
 * Smartec não responde nada, e "em dia" ali seria invenção.
 */
export type ReadinessLevel = 'IRREGULAR' | 'SEM_CONSULTA' | 'RESSALVA' | 'REGULAR';

export interface VehicleReadiness {
  vehicleId: string;
  plate: string;
  fleetNumber: string | null;
  level: ReadinessLevel;
  /** Um motivo por linha, já escrito. Vazio quando o nível é `REGULAR`. */
  reasons: string[];
}

export interface ReadinessSummary {
  total: number;
  irregular: number;
  /** Ressalvas, hoje só IPVA com cota em aberto. */
  warning: number;
  neverChecked: number;
  regular: number;
}

export interface ReadinessList {
  items: VehicleReadiness[];
  summary: ReadinessSummary;
}

/**
 * Como cada nível se chama na tela.
 *
 * ⚠️ O texto descreve o DOCUMENTO, e nunca a saída do caminhão: "Documento
 * irregular", e não "Não pode sair". A plataforma não toma essa decisão.
 */
export const READINESS_LABEL: Record<ReadinessLevel, string> = {
  IRREGULAR: 'Documento irregular',
  SEM_CONSULTA: 'Nunca consultado',
  RESSALVA: 'Documento com ressalva',
  REGULAR: 'Documentação em dia',
};
