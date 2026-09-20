import { useSlidingPill } from '@/hooks/use-sliding-pill';
import { cn } from '@/management/ui';

export interface SegmentedOption<T extends string | number> {
  id: T;
  label: string;
  /** Contagem exibida ao lado do rótulo. */
  count?: number | undefined;
}

export interface SegmentedFilterProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Rotula o grupo para leitores de tela. */
  label: string;
  className?: string | undefined;
}

/**
 * O segmentado que recorta uma lista, dentro do painel branco.
 *
 * É o gêmeo do `PageTabs` na família `light`: mesmo poço em pílula, mesma
 * pastilha clara subindo do trilho. A diferença é o papel. Aba troca a SEÇÃO da
 * página e por isso usa o Radix Tabs, com `aria-controls` e navegação por
 * setas; isto aqui filtra a MESMA lista, então são botões com `aria-pressed`,
 * que é o que descreve um filtro ligado.
 *
 * ⚠️ **Nasceu em 18/09/2026 juntando cinco cópias.** O mapa ao vivo, o pódio do
 * ranking, as notificações, os relatórios e as viagens tinham o mesmo bloco
 * escrito à mão, com a mesma sombra literal repetida em cada um. Ao dar
 * movimento à pastilha (pedido do usuário), a mecânica de medida entraria cinco
 * vezes, e a primeira divergência entre elas seria questão de tempo.
 */
export function SegmentedFilter<T extends string | number>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedFilterProps<T>) {
  /* A chave carrega os ids porque opção a menos move as vizinhas, e a contagem
     porque ela muda a largura do item sem mudar a escolha. */
  const { trackRef, pillStyle, pillActive } = useSlidingPill<HTMLDivElement>(
    `${value}|${options.map((option) => `${option.id}:${option.count ?? ''}`).join()}`,
  );

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={label}
      className={cn(
        'bg-light-container rounded-pill relative flex w-fit max-w-full gap-1 overflow-x-auto p-1.5',
        className,
      )}
    >
      {/*
       * ⚠️ A pastilha do escolhido é UMA SÓ, e DESLIZA (pedido do usuário em
       * 18/09/2026, no espírito do seletor de tema).
       *
       * Antes o fundo claro e a sombra eram do próprio botão, então a troca era
       * um corte: a pastilha apagava aqui e acendia ali. Com uma peça só, que
       * muda de posição e de largura, o olho acompanha para onde foi a escolha.
       *
       * Fica ATRÁS dos botões por vir antes no DOM, com eles subindo por
       * `relative`: à frente, cobriria o rótulo.
       */}
      <span
        aria-hidden="true"
        style={pillStyle}
        className={cn(
          'bg-light rounded-pill pointer-events-none absolute left-0 top-0',
          'shadow-[0_1px_2px_rgba(28,26,24,0.06),0_2px_8px_-4px_rgba(28,26,24,0.18)]',
          /* `transform` e `width` juntos: o destino quase nunca tem a largura
             da origem, e animar só a posição faria a pastilha chegar e depois
             crescer, em dois tempos. */
          'transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
        )}
      />

      {options.map((option) => {
        const escolhida = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={escolhida}
            onClick={() => onValueChange(option.id)}
            {...(escolhida ? pillActive : {})}
            className={cn(
              'group text-body-md rounded-pill focus-visible:ring-primary relative shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
              /* Fundo e sombra do escolhido são da pastilha acima: aqui fica só
                 o que é do texto. */
              escolhida
                ? 'text-accent font-medium'
                : 'text-on-light-variant hover:text-on-light hover:bg-on-light/[0.06]',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              /* Na opção escolhida a contagem vira dado, e não sombra do
                 rótulo: opacidade cheia em vez de meia. */
              <span className={cn('tabular ml-2 opacity-70', escolhida && 'opacity-100')}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
