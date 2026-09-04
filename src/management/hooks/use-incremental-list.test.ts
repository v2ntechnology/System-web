import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIncrementalList } from './use-incremental-list';

/** O jsdom não tem `IntersectionObserver`: guardamos o callback para disparar. */
let dispara: (() => void) | null = null;

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: IntersectionObserverCallback) {
        dispara = () =>
          this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  dispara = null;
  vi.unstubAllGlobals();
});

const lista = (tamanho: number) => Array.from({ length: tamanho }, (_, i) => i);

describe('useIncrementalList', () => {
  it('abre com oito e cresce quando o sentinela aparece', () => {
    const { result } = renderHook(() => useIncrementalList(lista(20)));

    expect(result.current.visible).toHaveLength(8);
    expect(result.current.hasMore).toBe(true);

    /* Montar o sentinela liga o observador; entrar na tela cresce um passo. */
    act(() => result.current.sentinelRef(document.createElement('li')));
    act(() => dispara?.());

    expect(result.current.visible).toHaveLength(16);
  });

  it('não pede mais quando a lista cabe na janela', () => {
    const { result } = renderHook(() => useIncrementalList(lista(5)));

    expect(result.current.visible).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);
  });

  it('volta para os oito primeiros quando o recorte muda', () => {
    const { result, rerender } = renderHook(
      ({ itens, chave }) => useIncrementalList(itens, { resetKey: chave }),
      { initialProps: { itens: lista(20), chave: 'ATIVOS' } },
    );

    act(() => result.current.sentinelRef(document.createElement('li')));
    act(() => dispara?.());
    expect(result.current.visible).toHaveLength(16);

    /* Outra aba, mesma contagem: a janela não pode continuar aberta em 16. */
    rerender({ itens: lista(20), chave: 'PARADOS' });
    expect(result.current.visible).toHaveLength(8);
  });

  it('não entra em laço quando a lista chega nova a cada render', () => {
    /* A armadilha que a chave evita: `filter` sem `useMemo` devolve um array
       novo em toda passada. */
    const { result, rerender } = renderHook(() => useIncrementalList(lista(20)));

    rerender();
    rerender();
    expect(result.current.visible).toHaveLength(8);
  });
});
