import { useCallback, useRef, useState } from 'react';

/**
 * Lista que cresce ao rolar, em vez de mostrar tudo de uma vez.
 *
 * Decisão do usuário em 01/09/2026, para a lista da frota e para os eventos do
 * veículo: 41 caminhões e dezenas de eventos "USO DOS FREIOS" iguais enchiam a
 * coluna inteira e empurravam o resto da tela para baixo. A janela abre com oito
 * e cresce sozinha quando a pessoa chega ao fim.
 *
 * ⚠️ Não é paginação: não há barra, não há página, e a pessoa nunca perde o
 * lugar. Também não é carregamento sob demanda no servidor: o dado inteiro já
 * está em memória, o que muda é quanto dele vira DOM.
 *
 * O `sentinelRef` vai num elemento **depois** do último item. Quando ele entra
 * na tela, a janela cresce um passo.
 */
export function useIncrementalList<T>(
  items: T[],
  { step = 8, resetKey }: { step?: number; resetKey?: string | number | undefined } = {},
) {
  /*
   * ⚠️ A janela reabre quando esta chave muda, e NÃO quando o array muda de
   * identidade. Comparar a identidade parece mais correto e é uma armadilha:
   * quem passar uma lista criada no próprio render (um `filter` sem `useMemo`)
   * entrega um array novo a cada passada, e o ajuste de estado vira laço
   * infinito. O tamanho é a chave padrão porque filtro que muda a lista quase
   * sempre muda a contagem; quem precisar de mais precisão passa `resetKey`.
   */
  const chave = resetKey ?? items.length;
  const [limit, setLimit] = useState(step);

  /*
   * Ajuste durante o render, e não em efeito: trocar de aba ou de filtro
   * precisa voltar para os oito primeiros, e um efeito faria isso um quadro
   * depois, com a lista antiga inteira já pintada na tela.
   *
   * ⚠️ A lista anterior fica em **estado**, e não em `ref`: ler `ref.current`
   * durante o render é proibido pelo compilador do React, e este é o padrão que
   * a documentação chama de "ajustar estado quando uma prop muda".
   */
  const [anterior, setAnterior] = useState(chave);
  if (anterior !== chave) {
    setAnterior(chave);
    if (limit !== step) setLimit(step);
  }

  const observer = useRef<IntersectionObserver | null>(null);

  /* Callback ref, e não `useEffect`: o sentinela só existe quando ainda há o
     que mostrar, então ele monta e desmonta junto com a janela. */
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setLimit((atual) => atual + step);
          }
        },
        /* Cresce um pouco antes de o fim aparecer: esperar o sentinela encostar
           na borda faz a lista "engasgar" a cada passo. */
        { rootMargin: '240px' },
      );
      observer.current.observe(node);
    },
    [step],
  );

  return {
    visible: items.slice(0, limit),
    hasMore: items.length > limit,
    sentinelRef,
  };
}
