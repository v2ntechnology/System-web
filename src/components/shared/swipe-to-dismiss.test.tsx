import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SwipeToDismiss } from './swipe-to-dismiss';

/*
 * O gesto depende de duas coisas que o jsdom não entrega sozinho: a largura da
 * linha, que lá é sempre zero, e a captura de ponteiro, que não existe. As duas
 * são fixadas aqui para que os limiares do componente tenham sobre o que medir.
 */
const LARGURA = 400;

function renderizar(onDismiss = vi.fn()) {
  const resultado = render(
    <SwipeToDismiss onDismiss={onDismiss} label="Dispensar aviso">
      <button type="button">Abrir notificação</button>
    </SwipeToDismiss>,
  );

  const wrapper = resultado.container.firstElementChild as HTMLElement;
  Object.defineProperty(wrapper, 'offsetWidth', { value: LARGURA, configurable: true });

  /* O conteúdo que desliza é quem escuta o ponteiro. */
  const alvo = screen.getByText('Abrir notificação').parentElement as HTMLElement;
  alvo.setPointerCapture = vi.fn();

  return { onDismiss, alvo };
}

function arrastar(alvo: HTMLElement, ate: number) {
  fireEvent.pointerDown(alvo, { clientX: 0, pointerId: 1, button: 0 });
  fireEvent.pointerMove(alvo, { clientX: ate, pointerId: 1 });
  fireEvent.pointerUp(alvo, { clientX: ate, pointerId: 1 });
}

describe('SwipeToDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispensa quando o arraste passa da metade da linha', () => {
    const { onDismiss, alvo } = renderizar();

    arrastar(alvo, LARGURA * 0.8);
    /* A saída é em dois tempos: o item desliza e só então a linha colapsa. */
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('não dispensa quando o arraste fica curto', () => {
    const { onDismiss, alvo } = renderizar();

    arrastar(alvo, 40);
    vi.advanceTimersByTime(500);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('volta ao lugar quando o toque não chega a arrastar', () => {
    const { onDismiss, alvo } = renderizar();

    arrastar(alvo, 3);
    vi.advanceTimersByTime(500);

    expect(onDismiss).not.toHaveBeenCalled();
    /* Fechada, a faixa sai da árvore de acessibilidade: quem navega por leitor de
       tela não tropeça num botão de dispensar que não está à mostra. */
    expect(screen.queryByRole('button', { name: 'Dispensar aviso' })).toBeNull();
  });

  it('deixa a lixeira clicável depois de um arraste curto, e ela dispensa', () => {
    const { onDismiss, alvo } = renderizar();

    /* Arraste que abre a faixa sem completar o gesto. */
    arrastar(alvo, 40);
    const lixeira = screen.getByRole('button', { name: 'Dispensar aviso' });
    expect(lixeira).toHaveAttribute('tabindex', '0');

    fireEvent.click(lixeira);
    vi.advanceTimersByTime(500);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('impede o drag nativo, que é o que matava o gesto em cima de um link', () => {
    /*
     * ⚠️ Regressão de verdade, relatada pelo usuário no painel de gestão: lá o
     * item inteiro é um `Link`, âncora é arrastável por padrão, e o navegador
     * tomava o ponteiro para si com `pointercancel`. O arraste morria no
     * primeiro pixel e a impressão era de que o gesto não existia.
     */
    render(
      <SwipeToDismiss onDismiss={vi.fn()} label="Dispensar aviso">
        <a href="/gestao/notificacoes">Abrir notificação</a>
      </SwipeToDismiss>,
    );

    const conteudo = screen.getByText('Abrir notificação').parentElement as HTMLElement;
    const arrastoNativo = createEvent.dragStart(conteudo);
    fireEvent(conteudo, arrastoNativo);

    expect(arrastoNativo.defaultPrevented).toBe(true);
  });

  it('engole o clique que vem logo depois do arraste', () => {
    const aoAbrir = vi.fn();
    const resultado = render(
      <SwipeToDismiss onDismiss={vi.fn()} label="Dispensar aviso">
        <button type="button" onClick={aoAbrir}>
          Abrir notificação
        </button>
      </SwipeToDismiss>,
    );

    /* ⚠️ Sem fixar a largura, o `offsetWidth` do jsdom é zero e o arraste fica
       preso em zero: o teste passaria sem exercitar nada. */
    const wrapper = resultado.container.firstElementChild as HTMLElement;
    Object.defineProperty(wrapper, 'offsetWidth', { value: LARGURA, configurable: true });

    const conteudo = screen.getByText('Abrir notificação').parentElement as HTMLElement;
    conteudo.setPointerCapture = vi.fn();

    fireEvent.pointerDown(conteudo, { clientX: 0, pointerId: 1, button: 0 });
    fireEvent.pointerMove(conteudo, { clientX: 30, pointerId: 1 });
    fireEvent.pointerUp(conteudo, { clientX: 30, pointerId: 1 });
    fireEvent.click(screen.getByText('Abrir notificação'));

    /* Sem isso, soltar o arraste abriria a notificação sem querer. */
    expect(aoAbrir).not.toHaveBeenCalled();
  });
});
