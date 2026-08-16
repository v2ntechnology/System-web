import type { Subscription } from '@/management/types';

import { extensionsMonthlyTotal } from './extensions';
import { delay } from './latency';

/**
 * Substituto do `GET /v1/billing/subscription`.
 *
 * ⚠️ Números fictícios. O valor do ciclo bate com a conta do plano: 48 veículos
 * × R$ 89 = R$ 4.272 — dado de cobrança que não fecha é o tipo de coisa que
 * ninguém confere no mock e explode na integração com o gateway.
 *
 * O cartão aparece só com os quatro últimos dígitos, **inclusive aqui**: mock
 * com número completo vira exemplo copiado para o código de produção.
 */
export async function mockSubscription(): Promise<Subscription> {
  await delay(650);

  /*
   * As extensões contratadas entram na próxima fatura, somadas ao plano. Vem de
   * `mocks/extensions.ts` e não de um número aqui: ativar uma extensão tem de
   * mudar o valor que a tela de cobrança mostra, senão a promessa da tela de
   * extensões ("entra na sua próxima fatura") é mentira.
   */
  const extensions = extensionsMonthlyTotal();
  const planAmount = 4_272;

  return {
    planName: 'Frota Pro',
    planDescription:
      'Rastreamento, checklist digital, manutenção, custos e assistente de IA, com cobrança por veículo ativo.',
    cycle: 'MENSAL',
    status: 'ATIVA',
    amount: planAmount + extensions,
    planAmount,
    extensionsAmount: extensions,
    pricePerVehicle: 89,
    startedAt: '2025-03-14T00:00:00-03:00',
    nextChargeAt: '2026-09-01T00:00:00-03:00',
    cancelAtPeriodEnd: false,

    quotas: [
      {
        id: 'vehicles',
        label: 'Veículos ativos',
        used: 48,
        limit: 60,
        overageNote: 'Acima de 60, cada veículo entra na próxima fatura por R$ 89.',
      },
      {
        id: 'users',
        label: 'Usuários do painel',
        used: 11,
        limit: 15,
        overageNote: 'Usuário adicional custa R$ 39 por mês.',
      },
      {
        id: 'assistant',
        label: 'Perguntas ao assistente',
        used: 1_284,
        limit: 3_000,
        unit: 'no mês',
        overageNote: 'Excedente cobrado a R$ 0,04 por pergunta.',
      },
      {
        id: 'storage',
        label: 'Retenção de checklists',
        used: 24,
        limit: -1,
        unit: 'meses',
        overageNote: 'Sem limite neste plano. Mídia de evento não é armazenada (RN-092).',
      },
    ],

    paymentMethod: {
      kind: 'CARTAO',
      brand: 'Visa',
      last4: '4417',
      expiresAt: '09/2028',
      holderName: 'TRANSPORTADORA NORTE LTDA',
    },

    invoices: [
      {
        id: 'inv-2608',
        number: '2026-08',
        status: 'ABERTA',
        periodLabel: 'ago/2026',
        issuedAt: '2026-08-01T00:00:00-03:00',
        dueAt: '2026-08-10T00:00:00-03:00',
        amount: 4_272,
      },
      {
        id: 'inv-2607',
        number: '2026-07',
        status: 'PAGA',
        periodLabel: 'jul/2026',
        issuedAt: '2026-07-01T00:00:00-03:00',
        dueAt: '2026-07-10T00:00:00-03:00',
        paidAt: '2026-07-08T00:00:00-03:00',
        amount: 4_183,
      },
      {
        id: 'inv-2606',
        number: '2026-06',
        status: 'PAGA',
        periodLabel: 'jun/2026',
        issuedAt: '2026-06-01T00:00:00-03:00',
        dueAt: '2026-06-10T00:00:00-03:00',
        paidAt: '2026-06-09T00:00:00-03:00',
        amount: 4_183,
      },
      {
        id: 'inv-2605',
        number: '2026-05',
        status: 'FALHOU',
        periodLabel: 'mai/2026',
        issuedAt: '2026-05-01T00:00:00-03:00',
        dueAt: '2026-05-10T00:00:00-03:00',
        paidAt: '2026-05-12T00:00:00-03:00',
        amount: 4_094,
        failureReason: 'Cartão recusado pelo emissor na primeira tentativa. Pago no dia 12.',
      },
      {
        id: 'inv-2604',
        number: '2026-04',
        status: 'PAGA',
        periodLabel: 'abr/2026',
        issuedAt: '2026-04-01T00:00:00-03:00',
        dueAt: '2026-04-10T00:00:00-03:00',
        paidAt: '2026-04-07T00:00:00-03:00',
        amount: 4_094,
      },
      {
        id: 'inv-2603',
        number: '2026-03',
        status: 'PAGA',
        periodLabel: 'mar/2026',
        issuedAt: '2026-03-01T00:00:00-03:00',
        dueAt: '2026-03-10T00:00:00-03:00',
        paidAt: '2026-03-06T00:00:00-03:00',
        amount: 4_005,
      },
    ],
  };
}
