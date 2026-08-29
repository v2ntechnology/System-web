import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SelectPrimitive from '@radix-ui/react-select';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './lib/cn';
import {
  FIELD_SURFACES,
  HIGHLIGHT_ITEM,
  POPOVER_LAYER,
  PORTAL_FOCUS_RING,
} from './lib/field-surfaces';

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

  return (
    <div className="flex flex-col gap-1.5">
      <LabelPrimitive.Root
        htmlFor={selectId}
        className={cn('text-label-md uppercase', styles.label, hideLabel && 'sr-only')}
      >
        {label}
      </LabelPrimitive.Root>

      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            /* O giro vive no gatilho porque é ele que carrega `data-state`. */
            'text-body-md flex h-11 w-full items-center justify-between gap-2 whitespace-nowrap transition-colors data-[state=open]:[&>svg]:rotate-180 disabled:pointer-events-none disabled:opacity-50',
            variant === 'well'
              ? styles.well
              : 'border-outline-variant bg-surface-lowest focus-visible:ring-secondary border focus-visible:outline-none focus-visible:ring-2',
            styles.text,
            pill ? 'rounded-pill px-4' : 'px-3',
            error ? styles.wellError : styles.wellFocus,
            className,
          )}
        >
          <SelectPrimitive.Value />
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
            sideOffset={8}
            className={cn(
              'bg-surface-low ring-outline-variant min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1',
              POPOVER_LAYER,
            )}
          >
            <SelectPrimitive.Viewport className="max-h-72">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  /* Sem `secondary` aqui: a lista é portalizada para o `body` e
                     sai de `.management-theme`, onde esse token vira o cinza de
                     controle do painel operacional. */
                  className={cn(
                    'text-on-surface text-body-md flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none transition-colors',
                    HIGHLIGHT_ITEM,
                    /* A escolha atual ganha fundo além do peso e do check: só
                       peso de fonte é fraco demais para achar a linha certa numa
                       lista de vinte filiais. */
                    'data-[state=checked]:bg-primary-strong/15 data-[state=checked]:font-medium',
                    PORTAL_FOCUS_RING,
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="text-primary-strong ml-auto">
                    <CheckIcon size={14} aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
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
