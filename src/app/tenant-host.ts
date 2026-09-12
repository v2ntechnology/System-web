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

export type ModoDeAcesso = 'plataforma' | 'cliente';

/**
 * O slug do endereço atual, ou `null` fora do domínio de produção.
 *
 * Em desenvolvimento o host é `localhost`, que não tem slug nenhum: aí vale o
 * `VITE_TENANT_SLUG`, para dar como testar os dois modos sem editar hosts.
 */
export function slugDoEndereco(hostname: string = window.location.hostname): string | null {
  if (hostname.endsWith('.' + DOMINIO)) {
    return hostname.slice(0, -(DOMINIO.length + 1)).toLowerCase();
  }
  const doAmbiente = import.meta.env.VITE_TENANT_SLUG;
  return typeof doAmbiente === 'string' && doAmbiente.length > 0 ? doAmbiente.toLowerCase() : null;
}

/**
 * O modo do endereço atual.
 *
 * ⚠️ **O padrão é `cliente`, e é de propósito.** Endereço desconhecido, IP,
 * pré-visualização do Pages ou `localhost` sem variável caem no painel da
 * transportadora, que é o que 99% das pessoas usa. Errar para o lado do
 * backoffice deixaria o operador olhando uma tela de administração de
 * plataforma.
 */
export function modoDeAcesso(hostname?: string): ModoDeAcesso {
  return slugDoEndereco(hostname) === SLUG_PLATAFORMA ? 'plataforma' : 'cliente';
}

/** Endereço completo de um slug, para mandar alguém à porta certa. */
export function enderecoDoSlug(slug: string): string {
  return `https://${slug}.${DOMINIO}`;
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
 * ⚠️ Só decide em produção. Em `localhost` devolve `null` sempre, senão o
 * desenvolvimento entra em laço tentando ir para um endereço que não existe.
 */
export function enderecoCerto(ehSuperAdmin: boolean): string | null {
  if (!window.location.hostname.endsWith('.' + DOMINIO)) return null;
  if (ehSuperAdmin || modoDeAcesso() !== 'plataforma') return null;
  return enderecoDoSlug(SLUG_CLIENTE_PADRAO);
}
