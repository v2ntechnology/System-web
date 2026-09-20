import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** O atributo que marca, dentro do trilho, qual item a pastilha deve cobrir. */
export const PILL_ACTIVE_ATTR = 'data-pill-active';

interface Medida {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A pastilha que DESLIZA até a opção escolhida, num controle segmentado.
 *
 * O `ThemeSwitch` já fazia isso com um `translate-x-9` fixo, e ali funciona
 * porque os dois botões são quadrados do mesmo tamanho. Numa barra de abas as
 * larguras mudam com o texto ("Motoristas 113" contra "Equipe de apoio 2"), e
 * mais ainda com a contagem, que muda sozinha quando o filtro muda. Sem medir,
 * a pastilha pararia no lugar errado na primeira aba de nome longo.
 *
 * <h2>Como usar</h2>
 *
 * O trilho recebe `ref` e precisa ser `relative`; o item escolhido recebe
 * `{...pillActive}` (ou `data-pill-active` na mão); e `pillStyle` vai num
 * `<span>` absoluto que é o primeiro filho do trilho, atrás dos botões.
 *
 * ⚠️ **`chave` precisa mudar sempre que o conjunto de itens mudar**, e não só
 * quando a escolha muda. Os filtros do mapa ao vivo escondem a situação que
 * zerou: sem isso na chave, o botão some, os vizinhos andam e a pastilha fica
 * cobrindo o rótulo errado até alguém clicar de novo.
 *
 * ⚠️ Enquanto não há medida, `pillStyle` sai com a pastilha invisível, e não
 * nula: um `<span>` que entra no DOM depois começaria a transição a partir do
 * canto esquerdo do trilho, e a primeira troca de aba pareceria um salto.
 */
export function useSlidingPill<T extends HTMLElement = HTMLDivElement>(chave: string) {
  const trackRef = useRef<T>(null);
  const [medida, setMedida] = useState<Medida | null>(null);

  useLayoutEffect(() => {
    const trilho = trackRef.current;
    if (!trilho) return;

    const medir = () => {
      const alvo = trilho.querySelector<HTMLElement>(`[${PILL_ACTIVE_ATTR}]`);
      if (!alvo) {
        setMedida(null);
        return;
      }

      /* `offsetLeft` conta a partir da borda interna do trilho, que é a mesma
         origem de um filho `absolute` com `left: 0`. Por isso a pastilha não
         precisa descontar o `p-1.5` do trilho, e continua certa quando ele
         rola na horizontal. */
      setMedida({
        left: alvo.offsetLeft,
        top: alvo.offsetTop,
        width: alvo.offsetWidth,
        height: alvo.offsetHeight,
      });
    };

    medir();

    /* A largura do item muda sem que a escolha mude: a contagem ao lado do
       rótulo vai de 113 para 71 quando alguém filtra, e a fonte só carrega
       depois da primeira pintura. */
    const observador = new ResizeObserver(medir);
    observador.observe(trilho);
    for (const filho of trilho.children) observador.observe(filho);

    return () => observador.disconnect();
  }, [chave]);

  const pillStyle: CSSProperties = medida
    ? {
        transform: `translate3d(${medida.left}px, ${medida.top}px, 0)`,
        width: medida.width,
        height: medida.height,
      }
    : { opacity: 0 };

  return { trackRef, pillStyle, pillActive: { [PILL_ACTIVE_ATTR]: '' } } as const;
}
