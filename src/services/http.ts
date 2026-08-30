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
    throw new ApiError(await motivoDoErro(response), response.status);
  }

  /*
   * ⚠️ Resposta sem corpo não passa por `json()`.
   *
   * `204 No Content` é o que uma exclusão bem-sucedida devolve, e o corpo vem
   * vazio: `response.json()` numa string vazia lança `SyntaxError: Unexpected
   * end of JSON input`. O sintoma engana, porque a operação **funcionou** no
   * servidor e a tela mostra erro; quem for depurar vai procurar o defeito no
   * backend, onde ele não está.
   *
   * `205` entra junto pelo mesmo motivo, e o `content-length: 0` cobre o caso de
   * um 200 sem corpo. Quem chama uma rota assim tipa o retorno como `void`.
   */
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  if (response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Uma resposta que chega em pedaços, para ser lida enquanto ainda está vindo.
 *
 * ⚠️ Existe porque `httpRequest` só devolve quando o corpo TERMINOU de chegar, e
 * há resposta em que o meio do caminho importa: a conversa por voz precisa saber
 * a hora em que o assistente foi consultar o banco, e essa hora acontece antes
 * de a resposta existir. Quem chama lê o corpo linha a linha.
 *
 * Devolve a `Response` crua de propósito: o formato do fluxo é problema de quem
 * pediu, e não deste arquivo.
 */
export async function httpStream(path: string, init: RequestInit = {}): Promise<Response> {
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
    throw new ApiError(await motivoDoErro(response), response.status);
  }
  if (!response.body) {
    throw new ApiError('A resposta veio sem corpo.', 500);
  }

  return response;
}

/**
 * Um binário da API, como URL de objeto para `<img>` ou `<a download>`.
 *
 * ⚠️ Existe porque `<img src>` não manda cabeçalho, e as rotas de mídia exigem
 * `Authorization`. Apontar o `src` direto para a API devolveria 401 e a imagem
 * quebraria sem explicação. Aqui a busca é autenticada e o resultado vira um
 * blob local.
 *
 * Quem chama é dono da URL devolvida e precisa passar por `URL.revokeObjectURL`
 * ao desmontar: sem isso o blob fica na memória da aba até ela fechar.
 */
export async function httpBlob(path: string): Promise<string> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${env.apiBaseUrl}${path}`, { headers });

  if (response.status === 401) {
    onUnauthorized();
    throw new ApiError('Sessão expirada.', 401);
  }
  if (!response.ok) {
    throw new ApiError(`Erro na requisição (${response.status}).`, response.status);
  }

  return URL.createObjectURL(await response.blob());
}

/**
 * A frase que o backend mandou, quando ele mandou uma.
 *
 * O backend responde em RFC 7807 (`spring.mvc.problemdetails`), então recusa
 * prevista chega com `detail` preenchido: "Já existe um motorista cadastrado com
 * este CPF" em vez de "erro na requisição (409)". A primeira diz o que fazer a
 * seguir; a segunda manda o usuário adivinhar.
 *
 * O genérico continua valendo para erro sem corpo, resposta que não é JSON e
 * falha inesperada. Nesses casos não há frase melhor para mostrar.
 */
async function motivoDoErro(response: Response): Promise<string> {
  const generico = `Erro na requisição (${response.status}).`;
  try {
    const corpo: unknown = await response.json();
    if (corpo && typeof corpo === 'object') {
      const detalhe = (corpo as { detail?: unknown }).detail;
      if (typeof detalhe === 'string' && detalhe.trim() !== '') return detalhe;
    }
  } catch {
    /* Corpo vazio ou não-JSON: o genérico é o melhor que existe. */
  }
  return generico;
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
