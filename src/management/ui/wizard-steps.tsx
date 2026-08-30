import { CheckIcon, WarningIcon } from '@/components/icons';

import { cn } from './lib/cn';

/**
 * A barra de etapas de um diálogo de cadastro.
 *
 * <h2>Por que existe</h2>
 *
 * Decisão do usuário em 30/08/2026. As duas fichas passaram de meia dúzia de
 * campos para trinta, e um formulário de trinta campos numa coluna só obriga a
 * pessoa a rolar três telas antes de saber o que ainda falta. Em etapas, cada
 * uma cabe na altura do diálogo e a barra responde de relance a pergunta que
 * importa: onde eu estou e quanto falta.
 *
 * <h2>As etapas são navegáveis, e não um trilho</h2>
 *
 * ⚠️ Dá para clicar direto na etapa 4, e isso é deliberado. Assistente que
 * tranca o avanço serve para fluxo de compra, onde a ordem é a regra do
 * negócio. Aqui a ordem é só arrumação: quem está corrigindo o CEP de alguém
 * não pode ser obrigado a passar por habilitação e aptidão para chegar lá.
 *
 * O botão de avançar continua existindo para quem está cadastrando do zero, que
 * é quem se beneficia da ordem.
 */
export interface WizardStep<T extends string> {
  id: T;
  label: string;
  /**
   * A etapa tem campo inválido.
   *
   * ⚠️ É o que impede o pior defeito deste tipo de tela: a pessoa clica em
   * cadastrar, nada acontece, e o campo com erro está numa etapa que ela não
   * está vendo. Sem a marca, o formulário parece quebrado.
   */
  invalid?: boolean | undefined;
  /** A etapa tem tudo que precisava ter. Some quando há erro. */
  done?: boolean | undefined;
}

export interface WizardStepsProps<T extends string> {
  steps: readonly WizardStep<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Rotula o grupo para leitor de tela. */
  label: string;
  className?: string | undefined;
}

export function WizardSteps<T extends string>({
  steps,
  value,
  onValueChange,
  label,
  className,
}: WizardStepsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        /* Rola no eixo x quando não cabe. A barra de rolagem é invisível no
           sistema inteiro (19/08/2026), e aqui isso não atrapalha: a etapa atual
           é trazida para a vista por `scrollIntoView` ao mudar. */
        'flex shrink-0 gap-1 overflow-x-auto',
        className,
      )}
    >
      {steps.map((step, indice) => {
        const atual = step.id === value;

        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={atual}
            /* A marca de erro precisa chegar a quem não enxerga a cor. */
            aria-invalid={step.invalid ? true : undefined}
            onClick={(evento) => {
              onValueChange(step.id);
              evento.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }}
            className={cn(
              'text-label-md rounded-pill focus-visible:ring-secondary flex shrink-0 items-center gap-2',
              'px-3.5 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
              atual
                ? 'bg-bright text-on-bright font-medium'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.06]',
            )}
          >
            {/*
             * O número some quando a etapa está resolvida, e dá lugar ao sinal.
             * ⚠️ Os três estados ocupam o mesmo espaço de propósito: se o ícone
             * entrasse ao lado do número, a barra inteira dançaria a cada campo
             * preenchido.
             */}
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center',
                step.invalid && !atual && 'text-error',
                step.done && !step.invalid && !atual && 'text-success',
              )}
            >
              {step.invalid ? (
                <WarningIcon size={13} />
              ) : step.done ? (
                <CheckIcon size={13} />
              ) : (
                <span className="tabular text-label-sm">{indice + 1}</span>
              )}
            </span>

            {step.label}

            {/* Só para leitor de tela: a cor e o ícone não chegam a quem ouve. */}
            {step.invalid ? <span className="sr-only">(com erro)</span> : null}
          </button>
        );
      })}
    </div>
  );
}
