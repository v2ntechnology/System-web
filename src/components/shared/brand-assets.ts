import { useLocation } from 'react-router';

import { modoDeAcesso } from '@/app/tenant-host';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Os arquivos da marca, em um lugar só para os dois painéis.
 *
 * ⚠️ **O sufixo do arquivo é a cor da arte, não o nome do tema.** A `-white` traz
 * a torre e o "Rook" chapados de branco, e é a que vai sobre fundo escuro; a
 * `-dark` traz a torre em gradiente e o "Rook" em azul-noite, que sobre fundo
 * escuro desapareceria. Ler o sufixo como "tema escuro" inverte os dois e o erro
 * é invisível em revisão de código: só aparece na tela, como um logo sumido.
 *
 * <h2>Por que existe um módulo só para isto</h2>
 *
 * Decisão do usuário em 30/08/2026. Os dois painéis resolviam a marca de formas
 * diferentes: o operacional trocava de arquivo por tema, e o de gestão tinha só
 * a arte branca e a pintava de preto com `brightness(0)` no claro. O filtro
 * funcionava para o "Rook", que é branco chapado, e **matava o indigo da torre**,
 * que é gradiente: no papel a marca aparecia toda preta, sem a cor do produto.
 *
 * A regra passa a ser a mesma dos ícones (`components/icons.ts`): um conceito,
 * um desenho, nos quatro perfis. Arte nova entra aqui, e não num `import` solto
 * dentro de um componente.
 *
 * Os arquivos vivem em `public/logo/` e são servidos por caminho absoluto, e não
 * importados: são trocados pelo time de marca sem passar por build.
 */
export interface BrandAssets {
  /** Torre + palavra na horizontal. O uso mais comum: topo de página. */
  wordmark: string;
  /** Só a torre, quadrada. Para espaço estreito e para o menu recolhido. */
  mark: string;
  /** Só a palavra, recortada. Usada na marca empilhada, para não repetir a torre. */
  text: string;
}

/** A arte sobre fundo escuro: branco chapado. */
export const BRAND_ON_DARK: BrandAssets = {
  wordmark: '/logo/rookhub-full-white.svg',
  mark: '/logo/rookhub-symbol-white.svg',
  text: '/logo/rookhub-wordmark-white.svg',
};

/** A arte sobre papel: torre em gradiente terracota, palavra em preto. */
export const BRAND_ON_LIGHT: BrandAssets = {
  wordmark: '/logo/rookhub-full-dark.svg',
  mark: '/logo/rookhub-symbol-dark.svg',
  text: '/logo/rookhub-wordmark-dark.svg',
};

/**
 * A arte da ÁREA INTERNA: a mesma torre, com a rampa em marinho.
 *
 * ⚠️ É a marca do backoffice, e existe para o dev saber de olho que está na
 * porta da equipe e não no painel de um cliente (decisão do usuário em
 * 14/09/2026). O desenho é idêntico ao das empresas: só a rampa de sete paradas
 * da torre muda, de terracota para o marinho do `palette.css`
 * (`#4348D9` claro, `#2A2F9E` médio, `#010066` cheio).
 *
 * ⚠️ E é ARQUIVO, não filtro. Pintar por CSS é o erro que esta pasta já cometeu
 * uma vez: o `brightness(0)` resolvia a palavra e matava o gradiente da torre.
 * Arte nova da equipe entra aqui, ao lado das outras duas.
 */
export const BRAND_DEV: BrandAssets = {
  wordmark: '/logo/rookhub-full-dev.svg',
  mark: '/logo/rookhub-symbol-dev.svg',
  text: '/logo/rookhub-wordmark-dev.svg',
};

/**
 * A arte da área interna sobre FUNDO ESCURO.
 *
 * ⚠️ O sufixo continua sendo a cor da arte, e não o nome do tema: `-dev-light` é
 * a arte CLARA da equipe, e é ela que vai no grafite. A `BRAND_DEV` tem a rampa
 * fechando em `#010066` e o "Rook" em `#0B1220`, os dois quase invisíveis ali.
 *
 * A rampa da torre é a mesma de sete paradas, subida dois degraus: as duas mais
 * escuras saem, entram duas claras no topo, e a parada mais fechada passa a ser
 * o `#4348D9`, que dá 3,5:1 sobre o grafite. A palavra inverte junto: "Rook" em
 * `#F8FAFC`, como na arte branca, e "Hub" no `#83A5EF`, 7,5:1.
 */
export const BRAND_DEV_ON_DARK: BrandAssets = {
  wordmark: '/logo/rookhub-full-dev-light.svg',
  mark: '/logo/rookhub-symbol-dev-light.svg',
  text: '/logo/rookhub-wordmark-dev-light.svg',
};

/**
 * A arte certa para o tema em que a tela está, e para a área em que ela vive.
 *
 * Para o que fica **sobre fotografia ou sobre o painel indigo** não use este
 * gancho: ali a arte é sempre a branca, independente do tema, porque o fundo não
 * acompanha a rampa. Use `BRAND_ON_DARK` direto.
 *
 * ⚠️ **Na área interna a arte clara é a `BRAND_DEV`**, e a troca é aqui, e não em
 * cada componente. Quem apareceu laranja no meio do backoffice foi a torre do
 * assistente de IA, no cabeçalho do drawer e na tela de boas-vindas: é a mesma
 * história do escopo do tema, que só parou de vazar quando passou a ser
 * resolvido num lugar só (ver o `useEffect` do `app-shell.tsx`).
 *
 * ⚠️ E a área interna tem as DUAS artes, uma por tema: a `BRAND_DEV` no papel e
 * a `BRAND_DEV_ON_DARK` no grafite. Mandar o escuro para a arte branca resolvia
 * a legibilidade e apagava o azul, que é justamente o sinal de que o dev está na
 * porta da equipe e não no painel de um cliente.
 */
export function useBrandAssets(): BrandAssets {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const { pathname } = useLocation();

  /* ⚠️ O ENDEREÇO conta junto com a rota. No `dev.rookhub.com.br` tudo é da
     equipe, inclusive a tela de entrada, que fica em `/` e não veria a rota do
     backoffice: sem isto a porta dos devs abria com a marca terracota do
     cliente e só ficava azul depois do login. */
  const areaInterna = modoDeAcesso() === 'plataforma' || pathname.startsWith('/admin-saas');

  if (areaInterna) return isDark ? BRAND_DEV_ON_DARK : BRAND_DEV;
  return isDark ? BRAND_ON_DARK : BRAND_ON_LIGHT;
}
