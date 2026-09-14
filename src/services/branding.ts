import { env } from '@/app/environment';
import { fontStack, fontStylesheetHref } from '@/app/fonts';
import { httpPublic } from '@/services/http';
import { useBrandingStore } from '@/stores/branding-store';

/**
 * A marca do cliente, lida antes de existir sessão.
 *
 * <h2>Por que não há parâmetro de empresa</h2>
 *
 * ⚠️ **A empresa vem do `Origin`, e a rota não aceita slug.** Aceitar
 * `?slug=` daria a qualquer pessoa na internet um enumerador dos clientes da
 * plataforma, um por tentativa: quem responde com marca existe, quem responde
 * com a marca da RookHub não. A carteira de clientes não é pública. Por isso
 * `fetchPublicBranding` não recebe argumento: quem identifica a empresa é o
 * endereço de onde a página foi aberta.
 *
 * <h2>Endereço desconhecido não é erro</h2>
 *
 * ⚠️ **Host sem empresa cadastrada devolve a marca da RookHub, com 200.** Não é
 * 404, e tratar como falha pintaria a tela de erro em `localhost`, em
 * pré-visualização do Pages e no próprio `app.` da equipe, que são exatamente os
 * lugares onde se desenvolve.
 */
export interface PublicBranding {
  colorPrimary: string | null;
  colorAccent: string | null;
  /** Chave da lista homologada, nunca um arquivo. Ver `app/fonts.ts`. */
  fontFamily: string | null;
  logoUrl: string | null;
}

export function fetchPublicBranding(): Promise<PublicBranding> {
  return httpPublic<PublicBranding>('/v1/public/branding');
}

/** Identificadores dos nós que este módulo cria, para não duplicá-los. */
const ID_ESTILO = 'rookhub-branding';
const ID_FONTE = 'rookhub-branding-font';

const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

/**
 * As variáveis de tema que a cor principal comanda.
 *
 * ⚠️ São cinco nomes para uma cor só porque a paleta expõe a marca em degraus
 * (`strong`, `bright`, `container`, `on-light`), e a interface inteira escreve
 * esses nomes: trocar só `--primary` deixaria botão, chip e foco terracota numa
 * tela que já virou azul. Ver o cabeçalho de `styles/palette.css`.
 */
function declaracoesDaCor(cor: string): string[] {
  return [
    `--primary: ${cor};`,
    `--ring: ${cor};`,
    `--color-primary-strong: ${cor};`,
    `--color-primary-bright: ${cor};`,
    `--color-primary-container: ${cor};`,
    `--color-primary-on-light: ${cor};`,
  ];
}

/**
 * Escreve a marca do cliente por cima da paleta, como um bloco `<style>`.
 *
 * ⚠️ **O seletor é `:root:root`, e a repetição é deliberada.** A paleta redefine
 * a marca dentro de `html.light`, que tem especificidade maior que `:root`: um
 * bloco com `:root` simples valeria no tema escuro e seria ignorado no claro, e
 * o defeito só apareceria para quem trocasse de tema. Repetir a pseudo-classe
 * sobe a especificidade acima de `html.light` sem depender da ordem dos
 * arquivos, que em desenvolvimento nem é a mesma do build.
 *
 * Nenhum componente muda de estrutura: o que muda são as variáveis que eles já
 * liam.
 */
export function aplicarMarca(branding: PublicBranding): void {
  const declaracoes: string[] = [];

  if (branding.colorPrimary && COR_VALIDA.test(branding.colorPrimary)) {
    declaracoes.push(...declaracoesDaCor(branding.colorPrimary));
  }
  if (branding.colorAccent && COR_VALIDA.test(branding.colorAccent)) {
    declaracoes.push(`--accent: ${branding.colorAccent};`);
    declaracoes.push(`--color-accent-bright: ${branding.colorAccent};`);
  }

  const pilha = fontStack(branding.fontFamily);
  if (pilha) {
    declaracoes.push(`--font-sans: ${pilha};`);
    declaracoes.push(`--font-display: ${pilha};`);
    carregarFonte(branding.fontFamily);
  }

  useBrandingStore.getState().setLogoUrl(enderecoDoLogo(branding.logoUrl));

  /* Cliente sem parametrização nenhuma cai aqui, e a paleta padrão é a resposta
     certa: um bloco vazio no `<head>` só confundiria quem for depurar. */
  if (declaracoes.length === 0) {
    document.getElementById(ID_ESTILO)?.remove();
    return;
  }

  const estilo = document.getElementById(ID_ESTILO) ?? document.createElement('style');
  estilo.id = ID_ESTILO;
  estilo.textContent = `:root:root {\n  ${declaracoes.join('\n  ')}\n}`;
  document.head.appendChild(estilo);
}

/** Baixa a folha do Google Fonts da fonte escolhida, uma vez por chave. */
function carregarFonte(key: string | null): void {
  const href = fontStylesheetHref(key);
  if (!href) return;

  const existente = document.getElementById(ID_FONTE);
  if (existente instanceof HTMLLinkElement && existente.href === href) return;
  existente?.remove();

  const link = document.createElement('link');
  link.id = ID_FONTE;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * O endereço absoluto do logo.
 *
 * O backend pode devolver o caminho da própria API (`/v1/public/branding/logo`),
 * que é relativo ao `apiBaseUrl` e não à página: usado como está, o `<img>`
 * pediria o arquivo ao servidor do painel e receberia o `index.html`.
 */
function enderecoDoLogo(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (/^https?:\/\//.test(logoUrl)) return logoUrl;
  return `${env.apiBaseUrl}${logoUrl}`;
}

/**
 * Lê e aplica a marca no boot.
 *
 * ⚠️ **Nunca rejeita.** Isto roda antes do login, e a marca é enfeite: API fora
 * do ar, CORS ou rede caída não podem impedir alguém de entrar. Sem resposta, a
 * paleta RookHub continua valendo, que é o padrão correto.
 */
export async function carregarMarca(): Promise<void> {
  if (env.enableMocks) return;
  try {
    aplicarMarca(await fetchPublicBranding());
  } catch {
    /* Sem marca do cliente, fica a da RookHub. */
  }
}
