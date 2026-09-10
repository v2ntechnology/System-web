import { DeleteIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';

/**
 * Arrastar a notificação para o lado revela a lixeira; soltar depois do limiar
 * dispensa (RF-038).
 *
 * O gesto tem dois desfechos, como no padrão que todo celular ensina: um arraste
 * curto **abre** a faixa e deixa a lixeira clicável, e um arraste longo, mais da
 * metade da linha, dispensa direto ao soltar. Quem só encostou volta ao lugar
 * sozinho.
 *
 * ⚠️ Usa Pointer Events, não touch e mouse separados: é o mesmo caminho para
 * dedo, caneta e mouse, e o `setPointerCapture` garante que o gesto continue
 * sendo entregue aqui mesmo se o ponteiro sair do elemento no meio do arraste.
 *
 * ⚠️ **Dispensar não é excluir, e não é ler.** No painel de gestão o alerta não
 * é gravado: ele é derivado do estado atual a cada consulta, e o que persiste é
 * a decisão de não querer mais vê-lo (`POST /v1/notifications/dismiss`). Quem
 * arrasta não está dizendo que leu, está dizendo que não vai tratar.
 */

/** Faixa visível quando o item abre sem completar o gesto: cabe o alvo de toque de 44px com folga. */
const OPEN_OFFSET = 84;
/** A partir daqui o arraste conta como intenção de abrir; abaixo disso é toque comum. */
const OPEN_THRESHOLD = 24;
/** Fração da largura do item que dispara a dispensa direta ao soltar. */
const DISMISS_RATIO = 0.55;
/*
 * Tempos da saída: primeiro o item termina de sair pelo lado, depois a linha
 * colapsa e as de baixo sobem. Separados de propósito, porque colapsar junto com
 * o deslize faz a lista pular.
 */
const SLIDE_OUT_MS = 190;
const COLLAPSE_MS = 240;

interface SwipeToDismissProps {
  onDismiss: () => void;
  children: ReactNode;
  /** Rótulo do botão revelado, para leitor de tela. */
  label?: string;
  /**
   * Fundo opaco do conteúdo que desliza, na cor da caixa que o hospeda.
   *
   * ⚠️ Sem ele a faixa vermelha aparece POR BAIXO do texto da notificação
   * enquanto ela desliza, e os dois viram um borrão. É prop porque os dois sinos
   * moram em superfícies diferentes: `surface-low` na gestão e `popover` no
   * operacional.
   */
  surfaceClassName?: string;
}

export function SwipeToDismiss({
  onDismiss,
  children,
  label = 'Dispensar',
  surfaceClassName = 'bg-surface-low',
}: SwipeToDismissProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const draggingRef = useRef(false);
  /* Diz se houve arraste de verdade: é o que impede o clique do conteúdo de disparar no fim do gesto. */
  const movedRef = useRef(false);

  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /*
   * Largura medida no início do gesto.
   *
   * ⚠️ Ela existe como estado, e não como leitura do ref na hora de desenhar,
   * porque ler ref durante o render é proibido: o valor não é rastreado e a tela
   * pode ficar com um limiar velho. Medir uma vez no `pointerdown` basta, já que
   * a linha não muda de largura no meio do arraste.
   */
  const [width, setWidth] = useState(0);
  /* Altura travada no instante da dispensa: dá o ponto de partida para a linha colapsar até zero. */
  const [height, setHeight] = useState<number | undefined>(undefined);

  const widthOf = () => wrapRef.current?.offsetWidth ?? 320;

  const dismiss = () => {
    if (leaving) return;
    const element = wrapRef.current;
    /* Sai da tela antes de avisar quem manda na lista: sem isso o item some seco,
       e o gesto perde a resposta visual que o torna compreensível. */
    if (element) setHeight(element.offsetHeight);
    setLeaving(true);
    setAnimating(true);
    setOffset(widthOf());
    /* Só depois de o item sair pelo lado a linha encolhe, e aí as debaixo sobem para o lugar dela. */
    window.setTimeout(() => setHeight(0), SLIDE_OUT_MS);
    window.setTimeout(onDismiss, SLIDE_OUT_MS + COLLAPSE_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving || event.button === 2) return;
    draggingRef.current = true;
    movedRef.current = false;
    startXRef.current = event.clientX - offset;
    setWidth(widthOf());
    setAnimating(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || leaving) return;
    /* Só para a direita: arrastar para a esquerda não tem ação nenhuma aqui. */
    const next = Math.max(0, Math.min(event.clientX - startXRef.current, widthOf()));
    if (next > 4) movedRef.current = true;
    setOffset(next);
  };

  const finishDrag = () => {
    if (!draggingRef.current || leaving) return;
    draggingRef.current = false;
    setAnimating(true);
    if (offset >= widthOf() * DISMISS_RATIO) dismiss();
    else setOffset(offset >= OPEN_THRESHOLD ? OPEN_OFFSET : 0);
  };

  /* Clique que vem logo depois de um arraste não é clique: seria abrir a notificação sem querer. */
  const handleClickCapture = (event: ReactMouseEvent) => {
    if (!movedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    movedRef.current = false;
  };

  const open = offset > 0;
  /* Passou do ponto de não volta: a faixa fica vermelha cheia e a lixeira ganha a
     tinta de cima, dizendo "solte agora e some". É o único aviso que a pessoa
     recebe antes de a linha sumir.

     ⚠️ O `width > 0` não é defesa contra o impossível: antes do primeiro gesto a
     largura é zero, e `0 >= 0` daria o alerta de exclusão numa linha parada. */
  const willDismiss = width > 0 && offset >= width * DISMISS_RATIO;

  return (
    <div
      ref={wrapRef}
      className="rounded-md relative overflow-hidden"
      style={{
        maxHeight: height,
        opacity: height === 0 ? 0 : 1,
        transition: leaving
          ? `max-height ${COLLAPSE_MS}ms ease-in, opacity ${COLLAPSE_MS}ms ease-in`
          : undefined,
      }}
    >
      {/* A faixa ocupa a linha inteira e é recortada pelo raio do wrapper: sem raio
          próprio, ela encaixa no bloco em vez de virar um segundo cartão ao lado. */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden transition-colors duration-150',
          willDismiss ? 'bg-error' : 'bg-error/15',
        )}
        style={{ width: Math.max(offset, 0) }}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            'rounded-pill flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 p-0 transition-[transform,background-color,color] duration-150',
            willDismiss ? 'text-on-error bg-on-error/20' : 'text-error bg-transparent',
          )}
          style={{
            /* O ícone cresce junto com o gesto e some se a faixa ficar estreita demais para ele. */
            transform: `scale(${willDismiss ? 1.12 : 1})`,
            opacity: offset > 44 ? 1 : 0,
          }}
          title={label}
          aria-label={label}
          tabIndex={open ? 0 : -1}
          onClick={dismiss}
        >
          <DeleteIcon size={19} />
        </button>
      </div>

      {/*
        ⚠️ `[&>*]:!rounded-none` é o que faz a lixeira ENCAIXAR: o item traz o
        próprio raio, e com raio nos dois lados sobra um vão em forma de ampulheta
        entre a faixa e a notificação, invisível no fundo liso e escancarado no
        hover, quando o item ganha cor. Quem arredonda as pontas é só o wrapper,
        que já recorta tudo com `overflow-hidden`.
      */}
      {/*
        ⚠️ `select-none` e o `onDragStart` abaixo não são zelo: sem eles o gesto
        simplesmente NÃO ACONTECE quando o item é um link.

        Âncora e imagem são arrastáveis por padrão no navegador. Puxar uma delas
        inicia o drag nativo, o navegador toma o ponteiro para si e manda
        `pointercancel`, então o arraste morre no primeiro pixel e a linha volta
        para o lugar, como se nada tivesse sido clicado. É o caso do sino da
        gestão, cujo item inteiro é um `Link`. Segurar o texto para selecionar dá
        no mesmo, com o arraste virando seleção no meio do caminho.
      */}
      <div
        className={cn('relative touch-pan-y select-none [&>*]:!rounded-none', surfaceClassName)}
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? `transform ${SLIDE_OUT_MS}ms ease-out` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
      >
        {children}
      </div>
    </div>
  );
}
