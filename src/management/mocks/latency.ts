/** Simula latência de rede para que estados de carregamento sejam reais em desenvolvimento. */
export function delay(ms = 700): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Erro no padrão RFC 9457 (Problem Details) — mesma forma que o backend usará (BE-04).
 * Manter o formato desde já evita retrabalho no dia da integração.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }
}
