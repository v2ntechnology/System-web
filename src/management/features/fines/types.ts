/**
 * Multas e notificações, como a API entrega.
 *
 * ⚠️ **Os nomes seguem o contrato do `Backend-web`**, que por sua vez normaliza
 * o que a Smartec manda. A Smartec troca a caixa do nome do campo entre
 * respostas e até dentro da mesma resposta (`PLACA` e `Placa`, `CodigoInfracao`
 * e `CODIGO_INFRACAO` lado a lado): nada disso chega aqui, e não deve chegar.
 */

/** Fase da infração. Notificação ainda aceita indicar condutor; multa é para pagar. */
export type FineStage = 'NOTIFICACAO' | 'MULTA';

export interface Fine {
  id: string;
  smartecId: string;
  stage: FineStage;
  plate: string;
  renavam: string;
  /**
   * ⚠️ **Falso quando a placa não tem cadastro no RookHub, e isso é informação,
   * não erro.** O token da Smartec alcança a frota do grupo inteiro: são 138
   * veículos lá contra 40 aqui, e as outras 100 placas são de outras empresas.
   * Elas aparecem na lista avisando que não têm cadastro, e **ficam fora de
   * toda soma de dinheiro e de ponto**.
   */
  registered: boolean;
  vehicleId: string | null;
  fleetNumber: string | null;
  /** Base de operação, do NOSSO cadastro. Hoje todas do Rio de Janeiro. */
  unit: string | null;
  ait: string | null;
  infractionAt: string | null;
  location: string | null;
  city: string | null;
  /** ⚠️ UF da INFRAÇÃO, que não é a base do veículo nem o emplacamento dele. */
  uf: string | null;
  description: string | null;
  infractionCode: string | null;
  points: number | null;
  amount: number | null;
  amountWithDiscount: number | null;
  discountAmount: number | null;
  agency: string | null;
  dueDate: string | null;
  /** Só a notificação tem. Passou a data, perdeu-se a chance de indicar quem dirigia. */
  indicationDeadline: string | null;
  documentUrl: string | null;
  boletoUrl: string | null;
  boletoAmount: number | null;
  boletoDueDate: string | null;
  boletoDiscountPercent: number | null;
  paymentConfirmed: boolean;
  /**
   * A situação escrita pelo órgão, crua.
   *
   * ⚠️ A plataforma **não traduz nem normaliza**: o vocabulário é do DETRAN e
   * muda por UF. Nula quando ninguém perguntou ainda, o que não é o mesmo que
   * "em aberto".
   */
  status: string | null;
  paidAt: string | null;
  /**
   * O que foi pago de verdade.
   *
   * ⚠️ Pode ser **menor que `amount`**: quem paga em até 30 dias costuma pegar
   * desconto. É este número que vale para o custo da frota.
   */
  paidAmount: number | null;
  /**
   * ⚠️ **Link para o sistema da Smartec, que pede a conta deles.**
   *
   * Não é um comprovante em PDF. A tela diz "abrir na Smartec", nunca
   * "comprovante": prometer um arquivo que não temos gera chamado.
   */
  smartecPaymentUrl: string | null;
  /** ⚠️ Quando a SMARTEC pesquisou, não quando a infração aconteceu. */
  searchedAt: string | null;
  /**
   * De onde a linha veio.
   *
   * ⚠️ A tela precisa disto para não prometer o que não tem: a infração
   * digitada à mão não ganha PDF nem boleto do órgão, e a sincronização não a
   * altera.
   */
  source: 'SMARTEC' | 'MANUAL';
  /** Observação de quem cadastrou à mão. Sempre nula no que veio da Smartec. */
  notes: string | null;
}

/** O que a tela de cadastro manda. Só placa e data são obrigatórias. */
export interface NewFine {
  stage: FineStage;
  plate: string;
  infractionAt: string;
  ait?: string | undefined;
  location?: string | undefined;
  city?: string | undefined;
  uf?: string | undefined;
  description?: string | undefined;
  infractionCode?: string | undefined;
  points?: number | undefined;
  amount?: number | undefined;
  agency?: string | undefined;
  dueDate?: string | undefined;
  indicationDeadline?: string | undefined;
  notes?: string | undefined;
}

/**
 * Os números do topo da tela.
 *
 * ⚠️ `openAmount` e `points` contam **só a frota cadastrada**. O
 * `withoutRegistration` existe para a tela poder dizer quantas placas ficaram
 * de fora da conta, em vez de esconder a diferença.
 */
export interface FineSummary {
  total: number;
  fines: number;
  notices: number;
  openAmount: number;
  points: number;
  withoutRegistration: number;
  indicationExpiring: number;
  overdue: number;
  /**
   * Confirmadas pelo órgão.
   *
   * ⚠️ Conta a frota inteira, cadastrada ou não, ao contrário de `openAmount` e
   * `points`. Aqui não há soma de dinheiro nosso: é quantidade, e esconder a
   * multa paga de uma placa sem cadastro faria a aba "Pagas" não bater com a
   * lista que ela mesma filtra.
   */
  paid: number;
}

export interface FineList {
  items: Fine[];
  summary: FineSummary;
  /** Vazio quando nunca houve coleta. A tela precisa dizer isso, não inventar data. */
  collectedAt: string;
}

/** Recorte da lista. Tudo opcional: sem filtro, a tela mostra o período inteiro. */
export interface FineFilters {
  from?: string;
  to?: string;
  stage?: FineStage;
  search?: string;
  registered?: boolean;
}
