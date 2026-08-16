import type { Extension, ExtensionBilling } from '@/management/types';

/**
 * Preço de uma extensão, na conta do seu modelo de cobrança.
 *
 * Vive na feature e não no mock porque é **regra de apresentação de preço**, não
 * transporte: a tela precisa dela para somar o carrinho antes de o usuário
 * confirmar, e ela tem de sobreviver ao dia em que a pasta `mocks/` for deletada.
 *
 * ⚠️ O valor que vale é sempre o que o backend cobra. Isto é a estimativa que a
 * tela mostra para o usuário decidir — não a fatura.
 */
export function extensionMonthlyCost(extension: Extension, billableVehicles: number): number {
  switch (extension.billing.model) {
    case 'MENSAL_FIXO':
      return extension.billing.monthlyPrice;
    case 'POR_VEICULO':
      return extension.billing.pricePerVehicle * billableVehicles;
    case 'INCLUSA':
      return 0;
  }
}

/** Como o preço é lido na vitrine: "R$ 12/veículo", "R$ 240/mês", "Inclusa". */
export function billingLabel(billing: ExtensionBilling, format: (value: number) => string): string {
  switch (billing.model) {
    case 'MENSAL_FIXO':
      return `${format(billing.monthlyPrice)} por mês`;
    case 'POR_VEICULO':
      return `${format(billing.pricePerVehicle)} por veículo`;
    case 'INCLUSA':
      return 'Inclusa no seu plano';
  }
}
