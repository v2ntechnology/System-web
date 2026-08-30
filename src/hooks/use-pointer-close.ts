import { useRef } from 'react';

/**
 * Devolve o foco ao gatilho só quando a lista foi fechada pelo teclado.
 *
 * <h2>O problema</h2>
 *
 * Ao fechar um `Select` do Radix, ele devolve o foco ao gatilho por código. O
 * navegador trata foco programático como foco de teclado, então `:focus-visible`
 * casa e o anel acende: a pessoa clica numa opção com o mouse, a lista some e o
 * campo fica contornado como se ela estivesse navegando de Tab. Relatado pelo
 * usuário em 30/08/2026 no caminho do clique fora, e medido também no caminho
 * mais comum de todos, que é escolher uma opção com o mouse.
 *
 * ⚠️ Trocar `focus-within` por `focus-visible` no campo não resolve. Medido no
 * navegador: depois de fechar por ponteiro, os dois casam. A decisão precisa ser
 * tomada aqui, onde se sabe **como** a lista fechou.
 *
 * <h2>Por que é um hook, e não uma classe repetida em cada campo</h2>
 *
 * ⚠️ Os quatro perfis usam dois conjuntos de componentes: `components/ui` no
 * painel do operador e da manutenção, `management/ui` no do dono e do gestor.
 * A primeira correção entrou só no `GlassSelect` da gestão, e o operador ficou
 * com o anel aceso por mais um dia. Comportamento de componente compartilhado
 * mora num lugar só; o que muda entre os painéis é a pele, não a mecânica.
 *
 * <h2>Uso</h2>
 *
 * ```tsx
 * const pointer = usePointerClose();
 *
 * <Select.Root onOpenChange={pointer.onOpenChange}>
 *   <Select.Trigger />
 *   <Select.Content {...pointer.contentProps} />
 * </Select.Root>
 * ```
 *
 * Quem já tem o próprio `onOpenChange` chama o do hook lá dentro.
 */
export function usePointerClose() {
  const closedByPointer = useRef(false);

  return {
    /** No `Root`. Zera a marca a cada abertura. */
    onOpenChange: (open: boolean) => {
      if (open) closedByPointer.current = false;
    },

    /** Espalhado no `Content`. */
    contentProps: {
      /* Clique fora fecha a lista: ponteiro. */
      onPointerDownOutside: () => {
        closedByPointer.current = true;
      },
      /*
       * Clique numa opção também fecha, e também é ponteiro.
       *
       * ⚠️ Este é o caminho mais usado, e era o que continuava acendendo o anel
       * depois de escolher com o mouse. Marcar nos dois eventos, em vez de
       * tratar só o clique fora, cobre qualquer forma nova de fechar sem
       * precisar lembrar de voltar aqui.
       */
      onPointerDown: () => {
        closedByPointer.current = true;
      },
      /*
       * Seta, Enter, Esc ou digitar para buscar: teclado. Precisa reverter,
       * porque a pessoa pode abrir com o mouse e escolher com o teclado, e a
       * partir dali ela está navegando sem ver o cursor.
       */
      onKeyDown: () => {
        closedByPointer.current = false;
      },
      onCloseAutoFocus: (event: Event) => {
        /* Fechou por teclado: o Radix devolve o foco ao gatilho e o anel acende,
           que é o comportamento certo. Quem navega sem mouse precisa enxergar
           onde está. */
        if (!closedByPointer.current) return;

        /* Fechou por ponteiro: não devolve o foco. */
        event.preventDefault();
        closedByPointer.current = false;
      },
    },
  };
}
