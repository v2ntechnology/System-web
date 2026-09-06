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
/**
 * As bases que a pessoa pode escolher no mapa ao vivo (05/09/2026).
 *
 * ⚠️ As cinco foram CONFERIDAS contra o provedor, uma a uma, e todas
 * responderam 200, com estilo de verdade dentro (48 a 119 camadas). Listar um estilo que não existe não dá erro visível: o mapa
 * fica em branco e parece que a tela quebrou.
 *
 * O OpenFreeMap publica só estas cinco, e é bom saber o que cada uma é para não
 * prometer o que não há: NÃO existe imagem de satélite aqui. Satélite exige
 * outro provedor, com chave e com custo, e chave no navegador é chave publicada.
 */
export const MAP_BASES = [
  {
    id: 'positron',
    label: 'Minimalista',
    hint: 'Base apagada: o caminhão é a única coisa que salta.',
    url: 'https://tiles.openfreemap.org/styles/positron',
  },
  {
    id: 'liberty',
    label: 'Ruas',
    hint: 'O detalhado: nome de via, quadra, verde e construção.',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  {
    id: 'bright',
    label: 'Vivo',
    hint: 'Cor forte nas vias, para enxergar a malha de longe.',
    url: 'https://tiles.openfreemap.org/styles/bright',
  },
  {
    id: 'dark',
    label: 'Escuro',
    hint: 'Fundo escuro, para monitorar de madrugada sem cansar a vista.',
    url: 'https://tiles.openfreemap.org/styles/dark',
  },
  {
    id: 'fiord',
    label: 'Noturno',
    hint: 'Escuro azulado, com menos contraste que o Escuro.',
    url: 'https://tiles.openfreemap.org/styles/fiord',
  },
] as const;

export type MapBaseId = (typeof MAP_BASES)[number]['id'];

/** A URL de uma base escolhida, ou a do tema quando ninguém escolheu. */
export function mapBaseUrl(id: MapBaseId): string {
  return MAP_BASES.find((base) => base.id === id)?.url ?? MAP_BASES[0].url;
}

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
