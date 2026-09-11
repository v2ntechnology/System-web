/**
 * O slug da transportadora é subdomínio **e** nome do schema no Postgres.
 *
 * Por ser as duas coisas, ele não é um campo de texto qualquer: um valor mal
 * formado vira nome de schema inválido, e um valor colidindo com a lista abaixo
 * derruba um endereço que a própria plataforma usa. A validação mora aqui, e não
 * dentro da tela, porque o backend precisará da mesma regra, palavra por
 * palavra, quando existir.
 */

/**
 * Endereços que a plataforma reserva para si.
 *
 * `app` é o mais importante: é por onde o Super Admin entra, e liberá-lo a um
 * cliente tiraria a porta de casa.
 */
export const RESERVED_SLUGS = [
  'app',
  'api',
  'www',
  'admin',
  'mail',
  'cdn',
  'status',
  'docs',
  'dev',
  'staging',
  'painel',
  'suporte',
] as const;

/** Começa por letra, segue com letra, dígito ou hífen. De 3 a 31 caracteres. */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;

export type SlugError = 'empty' | 'format' | 'reserved' | 'taken';

export const SLUG_ERROR_MESSAGE: Record<SlugError, string> = {
  empty: 'Defina o endereço da transportadora.',
  format:
    'Use de 3 a 31 caracteres: comece por letra e siga com letras minúsculas, números ou hífen.',
  reserved: 'Este endereço é reservado pela plataforma.',
  taken: 'Já existe uma transportadora com este endereço.',
};

/** Devolve o primeiro erro encontrado, ou `null` se o slug serve. */
export function validateSlug(slug: string, takenSlugs: string[]): SlugError | null {
  if (!slug) return 'empty';
  if (!SLUG_PATTERN.test(slug)) return 'format';
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return 'reserved';
  if (takenSlugs.includes(slug)) return 'taken';
  return null;
}

/**
 * Sugere um slug a partir do nome da empresa.
 *
 * É só um ponto de partida para o campo: a decisão continua sendo do time da
 * RookHub, porque o endereço aparece no e-mail do cliente e não se troca depois.
 */
export function suggestSlug(companyName: string): string {
  const base = companyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');
  return base.slice(0, 31);
}

/** Endereço final que o cliente vai acessar. */
export function tenantDomain(slug: string): string {
  return `${slug || '…'}.rookhub.com.br`;
}
