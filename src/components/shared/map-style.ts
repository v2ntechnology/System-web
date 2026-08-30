import { useThemeStore, type Theme } from '@/stores/theme-store';

/**
 * A base cartográfica dos três mapas da aplicação.
 *
 * <h2>Por que existe um arquivo só para duas URLs</h2>
 *
 * São três mapas em pastas diferentes (o do painel operacional, o da frota ao
 * vivo e o das paradas de viagem) e até 30/08/2026 eles usavam bases
 * diferentes: dois no CARTO dark-matter e um no OpenFreeMap. Quem abria a frota
 * e depois uma viagem via dois mapas com desenho, cor e nível de detalhe
 * distintos, como se fossem dois produtos.
 *
 * <h2>Liberty, e não o minimalista</h2>
 *
 * Decisão do usuário em 30/08/2026: mapa mais detalhado e mais realista. O
 * `positron` e o `dark-matter` são bases de fundo, desenhadas para sumir atrás
 * do dado: quase sem nome de rua, sem área verde, sem construção. Numa central
 * de comando isso tira contexto justamente de quem precisa dele, porque saber
 * que o caminhão parou dentro de um pátio é diferente de saber que ele parou num
 * ponto do vazio.
 *
 * O Liberty traz o OpenStreetMap completo: via nomeada, quadra, área verde,
 * corpo d'água e construção. Continua vetorial, então o rótulo gira com o mapa e
 * o texto não borra no zoom, ao contrário de uma base de imagem.
 *
 * <h2>Sem chave de API, de propósito</h2>
 *
 * O documento de produto pedia Mapbox (FE-10), que exige conta e token. O
 * OpenFreeMap serve tile vetorial gratuito, sem chave e sem limite declarado, e
 * a atribuição do OpenStreetMap é inserida pela própria biblioteca. Chave de
 * mapa no navegador é chave publicada, e trocá-la depois é mudar esta constante.
 */
export const MAP_STYLE = {
  /**
   * O detalhado, que é o que a operação vê hoje.
   *
   * Nome de rua, quadra, verde e construção. É a base dos três mapas enquanto o
   * modo escuro está desligado.
   */
  light: 'https://tiles.openfreemap.org/styles/liberty',

  /**
   * O par escuro.
   *
   * ⚠️ Não existe "Liberty escuro" no OpenFreeMap, e por isso o escuro é menos
   * detalhado que o claro. Não é descuido: é o que o provedor publica. Quem
   * religar o modo escuro precisa saber que a base muda de caráter junto, e não
   * só de cor.
   */
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const satisfies Record<Theme, string>;

/**
 * A base do tema atual.
 *
 * Lê a preferência do store, que já devolve `light` enquanto o modo escuro está
 * desligado: o próprio store reescreve `dark` salvo para `light` na reidratação,
 * então não é preciso resolver de novo aqui.
 */
export function useMapStyleUrl(): string {
  return MAP_STYLE[useThemeStore((state) => state.theme)];
}

/**
 * A base do tema atual, fora do React.
 *
 * Existe para o mapa que é criado dentro de um efeito sem dependência de tema:
 * lá o valor precisa ser lido no instante da criação, e não capturado num
 * render anterior.
 */
export function mapStyleUrlNow(): string {
  return MAP_STYLE[useThemeStore.getState().theme];
}
