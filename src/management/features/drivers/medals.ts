/**
 * As três cores do pódio, para o painel CLARO.
 *
 * ⚠️ Literais de cor, e não token: ouro, prata e bronze não são papéis do tema,
 * são as cores da própria medalha, e não existem na paleta. As três foram
 * escolhidas escuras o bastante para se lerem sobre o branco do painel: o
 * dourado claro do tema escuro some ali.
 *
 * Mora fora dos componentes porque a tabela da classificação e o pódio pintam a
 * mesma posição, e duas listas de cor divergiriam na primeira mexida.
 */
export const MEDAL_COLOR: Record<number, string> = {
  1: 'text-[#B8860B]',
  2: 'text-[#8A8F98]',
  3: 'text-[#A0522D]',
};

/** Anel do card do pódio, na mesma família da medalha. */
export const MEDAL_RING: Record<number, string> = {
  1: 'ring-[#B8860B]/45',
  2: 'ring-[#8A8F98]/40',
  3: 'ring-[#A0522D]/35',
};

export const MEDAL_LABEL: Record<number, string> = {
  1: '1º lugar',
  2: '2º lugar',
  3: '3º lugar',
};
