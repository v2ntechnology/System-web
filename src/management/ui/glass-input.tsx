import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './lib/cn';

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

/**
 * Pares de cor de campo, por superfície.
 *
 * Um objeto e não classes soltas porque `GlassInput` e `GlassSelect` precisam
 * ficar idênticos: dois campos lado a lado com foco de cor diferente é o tipo de
 * detalhe que ninguém reporta e todo mundo percebe.
 */
const FIELD_SURFACES = {
  dark: {
    well: 'glass-well focus-within:border-secondary focus-within:ring-secondary/60 focus-within:ring-1',
    wellFocus: '',
    wellError:
      'border-error focus-within:border-error focus-within:ring-error/60 ring-1 ring-error/60',
    label: 'text-on-surface-variant',
    text: 'text-on-surface',
    placeholder: 'placeholder:text-on-surface-muted',
    muted: 'text-on-surface-muted',
    error: 'text-error',
  },
  light: {
    well: 'light-well focus-within:border-primary-on-light focus-within:ring-primary-on-light/50 focus-within:ring-1',
    wellFocus: '',
    wellError:
      'border-error-on-light focus-within:border-error-on-light focus-within:ring-error-on-light/50 ring-1 ring-error-on-light/50',
    label: 'text-on-light-variant',
    text: 'text-on-light',
    placeholder: 'placeholder:text-on-light-muted',
    muted: 'text-on-light-muted',
    error: 'text-error-on-light',
  },
} as const;

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

export interface GlassSelectProps extends Omit<ComponentPropsWithoutRef<'select'>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  options: { value: string; label: string }[];
  surface?: 'dark' | 'light' | undefined;
  hideLabel?: boolean | undefined;
  id?: string | undefined;
}

/**
 * Seleção em poço, no mesmo contrato visual do `GlassInput`.
 *
 * `<select>` nativo de propósito: no pátio e no celular o seletor do sistema é
 * mais rápido e mais acessível que qualquer listbox nossa — e não custa
 * dependência nem teclado reimplementado.
 */
export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect(
  { label, error, hint, options, surface = 'dark', hideLabel = false, className, id, ...props },
  ref,
) {
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

      <div
        className={cn(
          'flex items-center transition-colors',
          styles.well,
          'px-3',
          error ? styles.wellError : styles.wellFocus,
        )}
      >
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'text-body-md h-11 w-full bg-transparent focus:outline-none',
            styles.text,
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            /* `bg` explícito: a lista aberta é desenhada pelo sistema e não
               herda o fundo transparente do campo. */
            <option key={option.value} value={option.value} className="bg-surface-container">
              {option.label}
            </option>
          ))}
        </select>
      </div>

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
});
