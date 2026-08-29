import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as LabelPrimitive from '@radix-ui/react-label';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface CheckboxProps extends Omit<
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  'id'
> {
  label: ReactNode;
  /**
   * A consequência de marcar, embaixo do rótulo.
   *
   * Não é enfeite: nas duas caixas que o painel tem hoje, desmarcar tira a
   * pessoa da escala e tira o caminhão da frota disponível. Quem lê só o rótulo
   * não sabe disso, e quem descobre depois já mexeu.
   */
  description?: ReactNode | undefined;
  /** Mensagem de erro. Dispara `aria-invalid` e o estilo de erro. */
  error?: string | undefined;
  /** `light` dentro de um `LightCard`; `dark` sobre o grafite. */
  surface?: 'dark' | 'light' | undefined;
  id?: string | undefined;
  /** Classe do container, e não da caixa. A caixa tem tamanho fixo. */
  className?: string | undefined;
}

const SURFACES = {
  dark: {
    box: 'border-outline bg-surface-lowest',
    label: 'text-on-surface',
    description: 'text-on-surface-muted',
    ring: 'focus-visible:ring-secondary',
    hover: 'group-hover:border-on-surface/40',
  },
  light: {
    box: 'border-light-outline bg-light',
    label: 'text-on-light',
    description: 'text-on-light-muted',
    ring: 'focus-visible:ring-primary-on-light',
    hover: 'group-hover:border-on-light/40',
  },
} as const;

/**
 * Caixa de marcação do painel.
 *
 * <h2>Por que aceita descrição</h2>
 *
 * A versão anterior só tinha rótulo de uma linha, e por isso não era usada em
 * lugar nenhum: as duas caixas reais do painel precisavam explicar o efeito
 * embaixo, e cada tela montou a sua com `<input type="checkbox">` cru. Duas
 * cópias soltas de um controle é como o sistema perde consistência sem ninguém
 * decidir isso.
 *
 * <h2>A área de clique é a linha inteira</h2>
 *
 * ⚠️ O `<label>` embrulha rótulo e descrição, então clicar no texto explicativo
 * também marca. Uma caixa de 20px como único alvo é um alvo pequeno demais para
 * quem preenche trinta cadastros seguidos, e a descrição é justamente onde o
 * olho está quando a decisão é tomada.
 */
export function Checkbox({
  label,
  description,
  error,
  surface = 'dark',
  className,
  id,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const describedBy = description
    ? `${checkboxId}-description`
    : error
      ? `${checkboxId}-error`
      : undefined;
  const styles = SURFACES[surface];

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <LabelPrimitive.Root
        htmlFor={checkboxId}
        className="group flex cursor-pointer select-none items-start gap-2.5"
      >
        <CheckboxPrimitive.Root
          id={checkboxId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
            styles.box,
            styles.hover,
            /* `primary-strong`, e não `primary`: o âncora reprova AA com o
               branco do sinal de conferido. Mesmo par do `SpectrumButton`. */
            'data-[state=checked]:border-primary-strong data-[state=checked]:bg-primary-strong',
            'data-[state=indeterminate]:border-primary-strong data-[state=indeterminate]:bg-primary-strong',
            error && 'border-error',
            styles.ring,
            'focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator className="text-on-primary">
            {props.checked === 'indeterminate' ? (
              <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden="true">
                <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden="true">
                <path
                  d="M1.5 6.5L4.5 9.5L10.5 2.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

        <span className="min-w-0">
          <span className={cn('text-body-md block', styles.label)}>{label}</span>
          {description ? (
            <span
              id={`${checkboxId}-description`}
              className={cn('text-label-md mt-0.5 block normal-case', styles.description)}
            >
              {description}
            </span>
          ) : null}
        </span>
      </LabelPrimitive.Root>

      {error ? (
        <p
          id={`${checkboxId}-error`}
          role="alert"
          className={cn(
            'text-label-md normal-case',
            surface === 'light' ? 'text-error-on-light' : 'text-error',
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
