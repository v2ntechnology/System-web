import { env } from '@/app/environment';
import type { PaginatedResponse } from '@/types';

/* -------------------------------------------------------------------------- */
/* Simulação de rede (Fase 1)                                                  */
/* -------------------------------------------------------------------------- */

/** Simula um atraso de rede curto para demonstrar estados de carregamento. */
export function networkDelay(min = 250, max = 650): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Envolve dados mockados em uma Promise com atraso simulado, permitindo
 * também simular cenários de erro (para exercitar os estados de erro da UI).
 */
export async function mockResponse<T>(
  data: T,
  options: { failRate?: number; min?: number; max?: number } = {},
): Promise<T> {
  const { failRate = 0, min, max } = options;
  await networkDelay(min, max);
  if (failRate > 0 && Math.random() < failRate) {
    throw new ApiError('Não foi possível carregar os dados. Tente novamente.', 503);
  }
  return structuredClone(data);
}

/* -------------------------------------------------------------------------- */
/* Cliente HTTP (preparado para a Fase 2)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cliente HTTP preparado para a integração futura com a API real.
 * Ele já contempla um interceptador de autenticação e o tratamento de 401
 * (sessão expirada). Nenhum token real é gerado nesta fase — o getter abaixo
 * é um ponto de extensão a ser conectado ao fluxo de autenticação do backend.
 */

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureHttpClient(options: {
  getAccessToken?: TokenGetter;
  onUnauthorized?: UnauthorizedHandler;
}): void {
  if (options.getAccessToken) getAccessToken = options.getAccessToken;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

export async function httpRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });

  if (response.status === 401) {
    onUnauthorized();
    throw new ApiError('Sessão expirada.', 401);
  }

  if (!response.ok) {
    throw new ApiError(`Erro na requisição (${response.status}).`, response.status);
  }

  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Paginação e ordenação em memória                                            */
/* -------------------------------------------------------------------------- */

export function paginate<T>(items: T[], page = 1, pageSize = 10): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

export function sortBy<T>(items: T[], key: keyof T, dir: 'asc' | 'desc' = 'asc'): T[] {
  const sorted = [...items].sort((a, b) => compareValues(a[key], b[key]));
  return dir === 'desc' ? sorted.reverse() : sorted;
}
