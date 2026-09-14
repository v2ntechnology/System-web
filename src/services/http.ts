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
 * O 402: o plano da empresa não cobre o módulo que a rota serve.
 *
 * ⚠️ **Não é o 403, e a diferença é o que a tela mostra.** 403 é assunto entre a
 * pessoa e quem administra a equipe dela: falta permissão, e quem resolve está
 * na mesma empresa. 402 é assunto comercial: a permissão existe, o plano é que
 * não vai até ali, e quem resolve é o Dono com a RookHub. Mostrar "sem acesso"
 * nos dois casos manda metade das pessoas cobrar a pessoa errada.
 *
 * O backend separa os dois de propósito, e o corpo do 402 diz **qual** módulo
 * faltou, em `modulo`, e em que plano a empresa está, em `plano`. É com o
 * `modulo` que a oferta consegue dizer o que falta em vez de falar em "recursos
 * avançados": ver `PlanLockedState`.
 */
export class PlanUpgradeError extends ApiError {
  constructor(
    message: string,
    /** Chave do módulo barrado (`integrations`, `analytics`…). Nulo se o backend omitir. */
    readonly modulo: string | null,
    /** Plano atual da empresa, como o backend o nomeia. */
    readonly plano: string | null,
  ) {
    super(message, 402);
    this.name = 'PlanUpgradeError';
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

/* -------------------------------------------------------------------------- */
/* Acesso de suporte                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A empresa que o suporte está lendo, ou `null` fora do modo suporte.
 *
 * ⚠️ **É a única exceção à regra de que a empresa vem sempre do token.** Um
 * token de plataforma mais `X-Rookhub-Tenant: <slug>` abre a empresa do cliente
 * e **somente em GET**. O backend recusa qualquer outro método antes do
 * controller, com 403, e audita a tentativa.
 */
let tenantDeSuporte: string | null = null;

export function setSupportTenant(slug: string | null): void {
  tenantDeSuporte = slug;
}

export function getSupportTenant(): string | null {
  return tenantDeSuporte;
}

/** O método efetivo de uma requisição. `fetch` sem `method` é GET. */
function metodoDe(init: RequestInit): string {
  return (init.method ?? 'GET').toUpperCase();
}

/**
 * Rota que é da plataforma, e não de uma empresa.
 *
 * ⚠️ **O cabeçalho de suporte não vai nestas**, e isso importa duas vezes. O
 * backend aplica o cabeçalho a QUALQUER requisição que o traga, então um GET do
 * backoffice sairia resolvendo o schema do cliente e gravaria uma linha de
 * acesso de suporte para uma tela que não é do cliente: a auditoria encheria de
 * ruído justamente onde ela precisa ser conferível. E o backoffice continua
 * podendo escrever, porque o modo suporte não é sobre ele.
 */
function ehRotaDaPlataforma(path: string): boolean {
  return path.startsWith('/v1/saas/') || path.startsWith('/v1/public/');
}

/**
 * Os cabeçalhos da requisição, com token e, no modo suporte, a empresa lida.
 *
 * ⚠️ **A escrita no cliente é barrada aqui, e não só no servidor.** No modo
 * suporte, um POST sairia sem o cabeçalho e acertaria o plano de controle da
 * plataforma, e não o cliente que está na tela: o pior desfecho possível,
 * porque parece ter funcionado. Recusar localmente transforma isso numa
 * mensagem. O backend recusa de todo jeito; esta trava existe para que a
 * requisição nem saia.
 */
function cabecalhos(path: string, init: RequestInit, json: boolean): Headers {
  const headers = new Headers(init.headers);
  /* Quem já declarou o tipo manda: o envio de logo vai com o tipo do arquivo, e
     sobrescrever com JSON aqui faria o backend responder 415. */
  if (json && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (tenantDeSuporte && !ehRotaDaPlataforma(path)) {
    if (metodoDe(init) !== 'GET') {
      throw new ApiError(
        'O modo suporte é somente leitura. Saia dele antes de qualquer alteração.',
        403,
      );
    }
    headers.set('X-Rookhub-Tenant', tenantDeSuporte);
  }

  return headers;
}

/**
 * O erro que uma resposta não-ok representa, com o corpo lido uma única vez.
 *
 * O 402 sai daqui como `PlanUpgradeError`, carregando `modulo` e `plano`: são
 * campos fora do RFC 7807 que o backend acrescenta, e sem eles a tela só
 * conseguiria dizer "faça upgrade", sem dizer de quê.
 */
async function erroDaResposta(response: Response): Promise<ApiError> {
  const generico = `Erro na requisição (${response.status}).`;

  let corpo: unknown = null;
  try {
    corpo = await response.json();
  } catch {
    /* Corpo vazio ou não-JSON: sobra o genérico. */
  }

  const campo = (nome: string): string | null => {
    if (!corpo || typeof corpo !== 'object') return null;
    const valor = (corpo as Record<string, unknown>)[nome];
    return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
  };

  const detalhe = campo('detail') ?? generico;

  if (response.status === 402) {
    return new PlanUpgradeError(detalhe, campo('modulo'), campo('plano'));
  }
  return new ApiError(detalhe, response.status);
}

export async function httpRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = cabecalhos(path, init, true);

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });

  if (response.status === 401) {
    onUnauthorized();
    throw new ApiError('Sessão expirada.', 401);
  }

  if (!response.ok) {
    throw await erroDaResposta(response);
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
 * Uma rota que não tem sessão para exigir.
 *
 * ⚠️ **Não manda `Authorization` nem trata 401 como sessão perdida**, e as duas
 * coisas importam. A marca do cliente é lida **antes do login**, quando não há
 * token nenhum: passar pelo `httpRequest` faria um 401 dali marcar a sessão como
 * expirada e jogar quem está digitando a senha para a tela de sessão expirada.
 *
 * Quem identifica a empresa nessas rotas é o `Origin`, que o navegador manda
 * sozinho. Ver `services/branding.ts`.
 */
export async function httpPublic<T>(path: string): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`);
  if (!response.ok) throw await erroDaResposta(response);
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
  const headers = cabecalhos(path, init, true);

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });

  if (response.status === 401) {
    onUnauthorized();
    throw new ApiError('Sessão expirada.', 401);
  }
  if (!response.ok) {
    throw await erroDaResposta(response);
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
  const headers = cabecalhos(path, {}, false);

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
 * Envia um arquivo como **bytes crus**, com o `Content-Type` do próprio arquivo.
 *
 * ⚠️ **Não é `multipart/form-data`.** As rotas de logo recebem o corpo do
 * arquivo direto, e o tipo do arquivo é o tipo da requisição: é assim que o
 * backend valida PNG ou SVG sem depender do nome. Mandar um `FormData` aqui
 * responderia 415, porque o tipo seria o do envelope, não o da imagem.
 *
 * As recusas previstas são de tamanho e de tipo: 413 para arquivo acima de
 * 256 KB e 415 para qualquer coisa que não seja PNG ou SVG. Quem chama mostra a
 * frase do backend, que já distingue as duas.
 */
export function httpUpload<T>(path: string, file: File): Promise<T> {
  return httpRequest<T>(path, {
    method: 'POST',
    body: file,
    /* O tipo do arquivo, e não `application/json`: por isso não passa pelo
       `Content-Type` padrão que o `cabecalhos` escreveria. */
    headers: { 'Content-Type': file.type },
  });
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
 *
 * ⚠️ Exportada porque a troca de senha não pode passar pelo `httpRequest`: lá o
 * 401 significa sessão perdida, e ali significa "a senha atual que você digitou
 * está errada". Ver `changePassword`.
 */
export async function motivoDoErro(response: Response): Promise<string> {
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
