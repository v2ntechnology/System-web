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
  wordmark: '/logo/logo-rookhub-white.svg',
  mark: '/logo/logo-rookhub-white-html.svg',
  text: '/logo/logo-rookhub-white-text.svg',
};

/** A arte sobre papel: torre em gradiente indigo, palavra em azul-noite. */
export const BRAND_ON_LIGHT: BrandAssets = {
  wordmark: '/logo/logo-rookhub-dark.svg',
  mark: '/logo/logo-rookhub-dark-html.svg',
  text: '/logo/logo-rookhub-dark-text.svg',
};

/**
 * A arte certa para o tema em que a tela está.
 *
 * Para o que fica **sobre fotografia ou sobre o painel indigo** não use este
 * gancho: ali a arte é sempre a branca, independente do tema, porque o fundo não
 * acompanha a rampa. Use `BRAND_ON_DARK` direto.
 */
export function useBrandAssets(): BrandAssets {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  return isDark ? BRAND_ON_DARK : BRAND_ON_LIGHT;
}
