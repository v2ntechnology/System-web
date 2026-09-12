/**
 * Quem é a casa, lida do endereço.
 *
 * A plataforma passa a ter dois tipos de porta (12/09/2026):
 *
 * - `app.rookhub.com.br` é a da equipe RookHub, e leva ao backoffice;
 * - `<cliente>.rookhub.com.br` é a da transportadora, e leva ao painel dela.
 *
 * ⚠️ **Isto é experiência de uso, não segurança.** Quem manda é o papel no
 * token, verificado pelo `Backend-web`: trocar o endereço na barra não dá acesso
 * a nada. O que isto resolve é a pessoa cair na porta certa em vez de ver uma
 * tela que não é dela.
 *
 * ⚠️ **Versão provisória.** O desenho definitivo está em
 * `docs/ONBOARDING_TRANSPORTADORAS.md`: o slug entra no login e num cabeçalho de
 * toda requisição, e o backend resolve o schema do cliente a partir dele. Hoje
 * existe **uma** transportadora e o tenant vem da claim do token, então o
 * endereço ainda não escolhe dado nenhum.
 */

/** Slug reservado à equipe RookHub. É a porta do Super Admin. */
export const SLUG_PLATAFORMA = 'app';

/** Enquanto houver uma transportadora só, é para cá que o cliente é mandado. */
export const SLUG_CLIENTE_PADRAO = 'servioeste';

const DOMINIO = 'rookhub.com.br';

/**
 * O espelho de desenvolvimento do domínio de produção.
 *
 * ⚠️ **Todo navegador resolve qualquer `*.localhost` para 127.0.0.1 sozinho**,
 * por obrigação da RFC 6761, sem ninguém editar arquivo de hosts. É o que deixa
 * `app.localhost:5173` e `servioeste.localhost:5173` valerem no MESMO servidor
 * do Vite, reproduzindo a separação de produção em vez de exigir uma variável de
 * ambiente e um reinício para trocar de modo.
 */
const DOMINIO_LOCAL = 'localhost';

export type ModoDeAcesso = 'plataforma' | 'cliente';

/**
 * O domínio a que o endereço pertence, ou `null` quando não é um dos dois.
 *
 * `localhost` puro devolve `null` de propósito: sem subdomínio não há slug, e é
 * o que distingue "estou no espelho local" de "estou num endereço qualquer".
 */
function dominioDoEndereco(hostname: string): string | null {
  if (hostname.endsWith('.' + DOMINIO)) return DOMINIO;
  if (hostname.endsWith('.' + DOMINIO_LOCAL)) return DOMINIO_LOCAL;
  return null;
}

/**
 * O slug do endereço atual, ou `null` quando não há como saber.
 *
 * O `VITE_TENANT_SLUG` continua valendo como saída de emergência, para quem
 * abrir em `localhost` puro, num IP da rede ou numa pré-visualização do Pages e
 * ainda assim quiser forçar um modo.
 */
export function slugDoEndereco(hostname: string = window.location.hostname): string | null {
  const dominio = dominioDoEndereco(hostname);
  if (dominio) return hostname.slice(0, -(dominio.length + 1)).toLowerCase();

  const doAmbiente = import.meta.env.VITE_TENANT_SLUG;
  return typeof doAmbiente === 'string' && doAmbiente.length > 0 ? doAmbiente.toLowerCase() : null;
}

/**
 * O modo do endereço atual.
 *
 * ⚠️ **O padrão é `cliente`, e é de propósito.** Endereço desconhecido, IP,
 * pré-visualização do Pages ou `localhost` puro sem variável caem no painel da
 * transportadora, que é o que 99% das pessoas usa. Errar para o lado do
 * backoffice deixaria o operador olhando uma tela de administração de
 * plataforma.
 */
export function modoDeAcesso(hostname?: string): ModoDeAcesso {
  return slugDoEndereco(hostname) === SLUG_PLATAFORMA ? 'plataforma' : 'cliente';
}

/**
 * Endereço completo de um slug, no mesmo mundo em que se está.
 *
 * Em produção sai `https://<slug>.rookhub.com.br`; no espelho local sai
 * `http://<slug>.localhost:<porta>`. A porta viaja junto porque o Vite não roda
 * na 80, e perdê-la mandaria o desenvolvimento para um endereço morto.
 */
export function enderecoDoSlug(
  slug: string,
  hostname: string = window.location.hostname,
  porta: string = window.location.port,
): string {
  if (dominioDoEndereco(hostname) === DOMINIO_LOCAL) {
    return `http://${slug}.${DOMINIO_LOCAL}${porta ? ':' + porta : ''}`;
  }
  return `https://${slug}.${DOMINIO}`;
}

/** Verdadeiro quando o endereço tem subdomínio que a aplicação entende. */
export function temSubdominioConhecido(hostname: string = window.location.hostname): boolean {
  return dominioDoEndereco(hostname) !== null;
}

/**
 * Para onde mandar quem caiu na porta errada, ou `null` quando está na certa.
 *
 * A regra é de mão única: **quem não é super admin não fica no `app.`**, e vai
 * para o endereço da transportadora. O contrário NÃO acontece: super admin no
 * endereço do cliente é deixado em paz, porque é assim que ele demonstra o
 * painel de gestão e o operacional, caminho que o plano de onboarding prevê.
 *
 * ⚠️ **É redirecionamento, nunca bloqueio.** O `app.` é o endereço que a
 * Servioeste usa desde sempre, e vai continuar chegando gente por ali por
 * meses. Quem chegar entra normalmente e é levado ao lugar certo, com a sessão
 * intacta: o cookie de refresh é do `api.`, que é same-site com os dois.
 *
 * ⚠️ **Endereço sem subdomínio conhecido devolve `null` sempre**, e é o que
 * impede o laço: em `localhost` puro não existe outro lugar para onde ir, e
 * redirecionar travaria o desenvolvimento. No espelho `*.localhost` existe, e aí
 * o redirecionamento vale, igual à produção.
 */
export function enderecoCerto(ehSuperAdmin: boolean): string | null {
  if (!temSubdominioConhecido()) return null;
  if (ehSuperAdmin || modoDeAcesso() !== 'plataforma') return null;
  return enderecoDoSlug(SLUG_CLIENTE_PADRAO);
}
