import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SelectPrimitive from '@radix-ui/react-select';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { usePointerClose } from '@/hooks/use-pointer-close';
import { cn } from './lib/cn';
import { FIELD_SURFACES, HIGHLIGHT_ITEM, POPOVER_LAYER } from './lib/field-surfaces';

export interface GlassInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string;
  /** Mensagem de erro. Quando presente, dispara aria-invalid e o estilo de erro. */
  error?: string | undefined;
  hint?: string | undefined;
  /** Elemento decorativo à esquerda do campo (ex.: ícone de e-mail). */
  leading?: ReactNode | undefined;
  /** Elemento à direita do campo (ex.: botão de revelar senha). */
  trailing?: ReactNode | undefined;
  /** Formato arredondado total, usado nas telas de autenticação (Figma). */
  pill?: boolean | undefined;
  /**
   * `light` para uso dentro de um `LightCard`; `dark` sobre o grafite.
   *
   * Mesmo contrato do `StatusChip`: os tokens `on-surface-*` são praticamente
   * invisíveis sobre o painel claro (regra 2b), então o par de cores inteiro
   * muda junto com a superfície — não só o fundo.
   */
  surface?: 'dark' | 'light' | undefined;
  /**
   * Esconde o rótulo visualmente, mantendo-o para leitores de tela.
   * O placeholder passa a carregar a identificação visual do campo.
   */
  hideLabel?: boolean | undefined;
  id?: string | undefined;
}

/* Os pares de cor moram em `lib/field-surfaces` desde que o campo de data
   nasceu: três campos numa linha precisam do mesmo foco e do mesmo poço. */

/**
 * Campo de entrada em "poço" (FE-06 / FE-12).
 * Raio de 12px por padrão (FE-02) ou pill nas telas de autenticação.
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  {
    label,
    error,
    hint,
    leading,
    trailing,
    pill = false,
    hideLabel = false,
    surface = 'dark',
    className,
    id,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const styles = FIELD_SURFACES[surface];

  return (
    <div className="flex flex-col gap-1.5">
      <LabelPrimitive.Root
        htmlFor={inputId}
        className={cn('text-label-md uppercase', styles.label, hideLabel && 'sr-only')}
      >
        {label}
      </LabelPrimitive.Root>

      <div
        className={cn(
          'flex items-center gap-2 transition-colors',
          styles.well,
          pill ? 'rounded-pill px-5' : 'px-3',
          error ? styles.wellError : styles.wellFocus,
        )}
      >
        {leading ? <span className={cn('shrink-0', styles.muted)}>{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'text-body-md w-full bg-transparent',
            styles.text,
            pill ? 'h-13' : 'h-11',
            styles.placeholder,
            'focus:outline-none',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>

      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className={cn('text-label-md normal-case', styles.error, pill && 'px-5')}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${inputId}-hint`}
          className={cn('text-label-md normal-case', styles.muted, pill && 'px-5')}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface GlassSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  surface?: 'dark' | 'light' | undefined;
  hideLabel?: boolean | undefined;
  /**
   * `well` (padrão) repete o poço do `GlassInput`, para formulário. `outline`
   * é a versão de barra de filtros: contorno fino sobre a superfície da tela,
   * igual ao campo de busca que costuma ficar ao lado.
   */
  variant?: 'well' | 'outline' | undefined;
  /** Formato arredondado total, usado nas barras de filtro. */
  pill?: boolean | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
}

/**
 * Seleção no mesmo contrato visual do `GlassInput`.
 *
 * Radix e não `<select>` nativo: a lista nativa é desenhada pelo sistema
 * operacional, ignora a paleta e abre em cinza de Windows no meio do painel
 * escuro. Com o listbox do Radix a caixa aberta é nossa, a seta gira no
 * próprio eixo ao abrir e o teclado continua vindo pronto do primitivo.
 */
export function GlassSelect({
  label,
  options,
  value,
  onValueChange,
  error,
  hint,
  surface = 'dark',
  hideLabel = false,
  variant = 'well',
  pill = false,
  disabled = false,
  id,
  className,
}: GlassSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
  const styles = FIELD_SURFACES[surface];

  /*
   * ⚠️ A mecânica de "quem fechou a lista" mora no hook, e não aqui.
   *
   * Ela nasceu neste arquivo e ficou só nele, então o select do painel do
   * operador e da manutenção continuou acendendo o anel depois do clique.
   * Componente compartilhado pelos quatro perfis tem uma implementação só:
   * o que muda entre os painéis é a pele.
   */
  const pointer = usePointerClose();

  return (
    <div className="flex flex-col gap-1.5">
      <LabelPrimitive.Root
        htmlFor={selectId}
        className={cn('text-label-md uppercase', styles.label, hideLabel && 'sr-only')}
      >
        {label}
      </LabelPrimitive.Root>

      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        onOpenChange={pointer.onOpenChange}
      >
        <SelectPrimitive.Trigger
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            /* O giro vive no gatilho porque é ele que carrega `data-state`. */
            'text-body-md flex h-11 w-full items-center justify-between gap-2 overflow-hidden transition-colors data-[state=open]:[&>svg]:rotate-180 disabled:pointer-events-none disabled:opacity-50',
            /* `wellTrigger`, e não `well`: o gatilho é focável por si só, e o
               `focus-within` do poço acenderia o anel em mais casos do que o
               teclado justifica. Ver a nota em `field-surfaces.ts`. */
            variant === 'well'
              ? styles.wellTrigger
              : 'border-outline-variant bg-surface-lowest focus-visible:ring-secondary border focus-visible:outline-none focus-visible:ring-2',
            styles.text,
            pill ? 'rounded-pill px-4' : 'px-3',
            error ? styles.wellError : styles.wellFocus,
            className,
          )}
        >
          {/*
           * ⚠️ O invólucro com `min-w-0 flex-1 truncate` é o que segura o texto
           * dentro do campo.
           *
           * O gatilho é `flex`, e item de flex tem `min-width: auto`: ele se
           * recusa a encolher abaixo do próprio conteúdo. Com um nome longo como
           * "SERVIOESTE - RJ CAMPOS DOS GOYTACAZES", o valor empurrava a seta
           * para fora e vazava por cima da borda do poço. `whitespace-nowrap` no
           * gatilho piorava: impedia a quebra sem permitir o corte.
           *
           * `min-w-0` libera o encolhimento, `truncate` corta com reticências, e
           * o `overflow-hidden` do gatilho é a rede de segurança para o que
           * escapar. `text-left` porque o `<button>` centraliza o texto por
           * padrão, e um valor centralizado desalinha da coluna do rótulo.
           */}
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectPrimitive.Value />
          </span>
          {/* A seta gira no próprio eixo ao abrir e desfaz o giro ao fechar. */}
          <SelectPrimitive.Icon asChild>
            <ChevronDownIcon
              size={18}
              aria-hidden="true"
              className={cn('shrink-0 transition-transform duration-200', styles.muted)}
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            /* Perto do gatilho: 6px lê como "esta lista é daquele campo". Com os
               8px anteriores e a sombra pesada, a caixa parecia solta na tela. */
            sideOffset={6}
            /* Sem folga, a lista encostava na borda da janela e o Radix a virava
               para cima, cobrindo os indicadores acima do filtro. */
            collisionPadding={16}
            {...pointer.contentProps}
            className={cn(
              'bg-surface-low ring-outline-variant min-w-[var(--radix-select-trigger-width)] max-w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-md p-1.5 ring-1',
              /* Sombra de papel: deslocamento e desfoque de verdade, no lugar
                 dos 90% de preto de antes. Sombra quase opaca sobre papel é
                 mancha, e ela só existia para destacar a lista contra a foto
                 escura do banner, que saiu no redesign de 30/08/2026. */
              'shadow-[0_2px_6px_rgba(28,26,24,0.05),0_20px_40px_-16px_rgba(28,26,24,0.18)]',
              /* Abre a partir da borda do gatilho, e não do centro da tela: o
                 movimento diz de onde a lista saiu. */
              'origin-[var(--radix-select-content-transform-origin)]',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              POPOVER_LAYER,
            )}
          >
            {/*
             * ⚠️ Os botões de rolagem não são enfeite: a barra de rolagem é
             * invisível no sistema inteiro (decisão do usuário em 19/08/2026), e
             * numa lista cortada sem pista nenhuma o corte lê como fim da lista.
             * Com vinte filiais, a pessoa concluía que a dela não estava ali.
             *
             * O Radix só os monta quando há de fato o que rolar, então em lista
             * curta eles não ocupam espaço.
             */}
            <SelectPrimitive.ScrollUpButton className="text-on-surface-muted flex h-6 cursor-default items-center justify-center">
              <ChevronUpIcon size={14} aria-hidden="true" />
            </SelectPrimitive.ScrollUpButton>

            <SelectPrimitive.Viewport className="max-h-[min(18rem,var(--radix-select-content-available-height))]">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  /* Sem `secondary` aqui: a lista é portalizada para o `body` e
                     sai de `.management-theme`, onde esse token vira o cinza de
                     controle do painel operacional. */
                  className={cn(
                    'text-on-surface text-body-md rounded-sm relative flex cursor-pointer select-none items-center gap-3 py-2 pl-3 pr-2 outline-none transition-colors',
                    HIGHLIGHT_ITEM,
                    /* A escolha atual: peso, e o visto em indigo à direita. O
                       fundo saiu. Com fundo indigo a 15% em toda linha marcada,
                       a lista tinha duas cores de realce disputando (a da linha
                       escolhida e a da linha sob o cursor) e ficava difícil
                       enxergar para onde o cursor estava indo. O visto é o sinal
                       de escolha; o fundo é o sinal de cursor. */
                    'data-[state=checked]:font-medium',
                    /* ⚠️ Sem anel de foco no item. O Radix foca a opção
                       escolhida por código assim que a lista abre, e o anel
                       aparecia por cima do realce logo na abertura, mesmo quando
                       a lista foi aberta com o mouse: duas marcas disputando a
                       mesma linha.
                       Numa lista de opções quem indica a posição do teclado é o
                       realce de fundo (`data-[highlighted]`), que o Radix move
                       com as setas. É o padrão de `listbox`, e é suficiente. */
                  )}
                >
                  {/* `min-w-0` e `truncate`: nomes de empresa como
                      "SERVIOESTE - RJ CAMPOS DOS GOYTACAZES" estouravam a
                      largura e empurravam o visto para fora da caixa. */}
                  <SelectPrimitive.ItemText>
                    <span className="block min-w-0 truncate">{option.label}</span>
                  </SelectPrimitive.ItemText>

                  {/* Largura reservada mesmo sem o visto: sem ela, a linha
                      escolhida ficava alguns pixels mais estreita que as outras
                      e o texto da lista dançava ao trocar de opção. */}
                  <span className="ml-auto flex size-4 shrink-0 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon size={15} className="text-primary-strong" aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>

            <SelectPrimitive.ScrollDownButton className="text-on-surface-muted flex h-6 cursor-default items-center justify-center">
              <ChevronDownIcon size={14} aria-hidden="true" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error ? (
        <p
          id={`${selectId}-error`}
          role="alert"
          className={cn('text-label-md normal-case', styles.error)}
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className={cn('text-label-md normal-case', styles.muted)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
