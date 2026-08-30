import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { MONTHS, WEEKDAYS, YEAR_BLOCK, useDateField, type DateFieldView } from '@/lib/date-field';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { format, isSameDay, isSameMonth, setMonth, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useId } from 'react';

import { FIELD_SURFACES, POPOVER_LAYER } from './lib/field-surfaces';
import { cn } from './lib/cn';

export interface GlassDateFieldProps {
  label: string;
  /** Data em ISO (`yyyy-MM-dd`), ou string vazia. */
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  /** `light` dentro de um `LightCard`; `dark` sobre o grafite. */
  surface?: 'dark' | 'light' | undefined;
  hideLabel?: boolean | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  id?: string | undefined;
  className?: string | undefined;
}

/**
 * Campo de data do painel de gestão, no contrato do `GlassInput`.
 *
 * É o gêmeo do `DatePicker` do painel operacional: mesma máquina de estado, em
 * `lib/date-field`, com a pele daqui. Preenche digitando (dd/mm/aaaa, com
 * máscara) ou pelo calendário, que abre em três profundidades — dia, mês e ano
 * — para chegar a qualquer data em dois cliques, sem lista suspensa dentro do
 * calendário.
 *
 * ⚠️ O conteúdo é portalizado para o `body` e sai de `.management-theme`. Lá
 * fora, `secondary` volta a ser o cinza de controle do painel operacional, por
 * isso o calendário só usa tokens da paleta comum (`on-surface`, `surface-low`,
 * `outline-variant`, `primary-strong`). Ver a nota do `GlassSelect`.
 */
export function GlassDateField({
  label,
  value,
  onValueChange,
  error,
  hint,
  surface = 'dark',
  hideLabel = false,
  disabled = false,
  placeholder = 'dd/mm/aaaa',
  id,
  className,
}: GlassDateFieldProps) {
  const generatedId = useId();
  const styles = FIELD_SURFACES[surface];

  const field = useDateField({ value, onChange: onValueChange, id: id ?? generatedId });
  const describedBy = error ? `${field.fieldId}-error` : hint ? `${field.fieldId}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <LabelPrimitive.Root
        htmlFor={field.fieldId}
        className={cn('text-label-md uppercase', styles.label, hideLabel && 'sr-only')}
      >
        {label}
      </LabelPrimitive.Root>

      <div
        className={cn(
          'flex items-center gap-1 px-3 transition-colors',
          styles.well,
          error ? styles.wellError : styles.wellFocus,
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          id={field.fieldId}
          value={field.text}
          onChange={(event) => field.handleType(event.target.value)}
          onBlur={() => field.setDraft(null)}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'text-body-md h-11 w-full bg-transparent focus:outline-none',
            styles.text,
            styles.placeholder,
          )}
        />

        <PopoverPrimitive.Root open={field.open} onOpenChange={field.handleOpenChange}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Abrir calendário"
              /* ⚠️ Sem véu de fundo: botão que é só um ícone move a cor do
                 traço (ver `.acao-*` em `globals.css`). O realce a 12% e 15%
                 existia porque a 8% o botão sumia sob o cursor, mas o problema
                 era o véu ser fraco demais, e não faltar véu: com a cor andando
                 para o texto cheio o botão responde sem tapar o desenho. */
              className="acao-neutra focus-visible:ring-secondary flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            >
              <CalendarIcon size={16} aria-hidden="true" />
            </button>
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={8}
              className={cn(
                'bg-surface-low ring-outline-variant rounded-lg p-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1',
                POPOVER_LAYER,
              )}
            >
              {/*
               * Mês e ano são dois seletores separados, lado a lado (pedido do
               * usuário em 27/08/2026).
               *
               * Antes era um título só que aprofundava a cada clique: mês, depois
               * ano. Funcionava, mas obrigava a adivinhar que o texto era
               * clicável e em que profundidade se estava. Separados, cada um abre
               * a própria grade e diz sozinho o que faz.
               *
               * As setas laterais continuam andando no passo da visão aberta: um
               * mês na grade de dias, um ano na de meses, um bloco na de anos.
               */}
              <div className="mb-3 flex items-center gap-1">
                <StepButton direction={-1} view={field.view} onClick={() => field.step(-1)} />

                <div className="flex flex-1 items-center gap-1">
                  <HeaderPicker
                    open={field.view === 'months'}
                    ariaLabel="Escolher o mês"
                    onClick={() => field.setView(field.view === 'months' ? 'days' : 'months')}
                    className="flex-1"
                  >
                    {/* `first-letter` num bloco, e não `capitalize`: o segundo
                        escreve "Agosto De 2026" quando o texto tem mais de uma
                        palavra, e o pseudo-elemento não pega em flex. */}
                    <span className="block truncate first-letter:uppercase">
                      {format(field.cursor, 'MMMM', { locale: ptBR })}
                    </span>
                  </HeaderPicker>

                  <HeaderPicker
                    open={field.view === 'years'}
                    ariaLabel="Escolher o ano"
                    onClick={() => field.setView(field.view === 'years' ? 'days' : 'years')}
                    className="tabular shrink-0"
                  >
                    {field.cursor.getFullYear()}
                  </HeaderPicker>
                </div>

                <StepButton direction={1} view={field.view} onClick={() => field.step(1)} />
              </div>

              {field.view === 'months' ? (
                <div className="grid w-[17.5rem] grid-cols-3 gap-1">
                  {MONTHS.map((month, index) => (
                    <GridButton
                      key={month}
                      current={index === field.cursor.getMonth()}
                      onClick={() => {
                        field.setCursor(setMonth(field.cursor, index));
                        field.setView('days');
                      }}
                      className="h-11 capitalize"
                    >
                      {month}
                    </GridButton>
                  ))}
                </div>
              ) : field.view === 'years' ? (
                <div className="grid w-[17.5rem] grid-cols-3 gap-1">
                  {Array.from(
                    { length: YEAR_BLOCK },
                    (_, index) => field.yearBlockStart + index,
                  ).map((year) => (
                    <GridButton
                      key={year}
                      current={year === field.cursor.getFullYear()}
                      /* Volta direto para os dias, e não para os meses: com o
                         mês tendo seletor próprio ao lado, passar pela grade de
                         meses seria um clique que não decide nada. */
                      onClick={() => {
                        field.setCursor(setYear(field.cursor, year));
                        field.setView('days');
                      }}
                      className="tabular h-11"
                    >
                      {year}
                    </GridButton>
                  ))}
                </div>
              ) : (
                <div
                  role="grid"
                  tabIndex={0}
                  onKeyDown={field.handleGridKeys}
                  aria-label="Calendário"
                  className="focus-visible:ring-primary-strong w-[17.5rem] rounded-md focus-visible:outline-none focus-visible:ring-2"
                >
                  <div className="mb-1 grid grid-cols-7">
                    {WEEKDAYS.map((weekday) => (
                      <abbr
                        key={weekday.label}
                        title={weekday.label}
                        className="text-on-surface-muted text-label-sm grid h-8 place-items-center no-underline"
                      >
                        {weekday.initial}
                      </abbr>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {field.days.map((day) => {
                      const noMes = isSameMonth(day, field.cursor);
                      const escolhido = field.selected ? isSameDay(day, field.selected) : false;
                      const hoje = isSameDay(day, field.today);
                      const noCursor = isSameDay(day, field.cursor);

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          aria-current={escolhido ? 'date' : undefined}
                          onClick={() => {
                            field.commit(day);
                            field.handleOpenChange(false);
                          }}
                          className={cn(
                            'tabular text-body-sm relative grid h-9 place-items-center rounded-md transition-colors',
                            escolhido
                              ? 'bg-primary-strong text-on-primary font-medium'
                              : noMes
                                ? 'text-on-surface hover:bg-on-surface/12'
                                : /* Dia de fora do mês continua clicável, e não
                                     apenas decorativo: quem quer 31/07 vendo
                                     agosto clica nele em vez de voltar o mês. */
                                  'text-on-surface-muted hover:bg-on-surface/10',
                            /*
                             * Hoje é o CONTORNO, e não um ponto embaixo (pedido
                             * do usuário em 27/08/2026). O ponto disputava
                             * espaço com o número dentro de 36px e lia como
                             * sujeira; o anel cerca o dia sem competir.
                             *
                             * O dia escolhido não recebe anel: ele já é o
                             * preenchido, e as duas marcas juntas viravam um
                             * alvo com borda dupla.
                             */
                            hoje && !escolhido && 'ring-on-surface/40 ring-1',
                            /* O cursor do teclado é fundo, e não anel: com anel
                               ele seria indistinguível de hoje ao navegar. */
                            !escolhido && !hoje && noCursor && 'bg-on-surface/8',
                          )}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>

      {error ? (
        <p
          id={`${field.fieldId}-error`}
          role="alert"
          className={cn('text-label-md normal-case', styles.error)}
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${field.fieldId}-hint`} className={cn('text-label-md normal-case', styles.muted)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

const STEP_LABELS: Record<DateFieldView, [string, string]> = {
  days: ['Mês anterior', 'Próximo mês'],
  months: ['Ano anterior', 'Próximo ano'],
  years: ['Anos anteriores', 'Próximos anos'],
};

function StepButton({
  direction,
  view,
  onClick,
}: {
  direction: -1 | 1;
  view: DateFieldView;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={STEP_LABELS[view][direction === -1 ? 0 : 1]}
      className="acao-neutra focus-visible:ring-primary-strong grid size-8 shrink-0 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2"
    >
      {direction === -1 ? (
        <ChevronLeftIcon size={16} aria-hidden="true" />
      ) : (
        <ChevronRightIcon size={16} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Um dos dois seletores do cabeçalho: mês ou ano.
 *
 * ⚠️ Sem seta de abertura (pedido do usuário em 27/08/2026, e a mesma decisão
 * já registrada para o título em 20/08/2026): com as setas de navegação nas
 * pontas, mais duas na mesma linha viravam quatro setas em oito centímetros.
 *
 * O que diz que abre é o fundo: ele acende no hover e FICA aceso enquanto a
 * grade correspondente está na tela. Some junto com ela.
 */
function HeaderPicker({
  open,
  ariaLabel,
  onClick,
  className,
  children,
}: {
  open: boolean;
  ariaLabel: string;
  onClick: () => void;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      className={cn(
        'text-on-surface text-body-md flex h-8 min-w-0 items-center justify-center rounded-md px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong',
        open ? 'bg-on-surface/12' : 'hover:bg-on-surface/12',
        className,
      )}
    >
      {children}
    </button>
  );
}

function GridButton({
  current,
  onClick,
  className,
  children,
}: {
  current: boolean;
  onClick: () => void;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'text-body-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong',
        current
          ? 'bg-primary-strong text-on-primary font-medium'
          : 'text-on-surface hover:bg-on-surface/12',
        className,
      )}
    >
      {children}
    </button>
  );
}
