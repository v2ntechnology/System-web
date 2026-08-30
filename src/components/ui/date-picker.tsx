import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import {
  addDays,
  addMonths,
  addYears,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  parseISO,
  setMonth,
  setYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const DISPLAY_FORMAT = 'dd/MM/yyyy';
const ISO_FORMAT = 'yyyy-MM-dd';

/** Iniciais da semana na ordem do calendário brasileiro (domingo primeiro). */
const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const day = addDays(startOfWeek(new Date(2024, 0, 7), { locale: ptBR }), index);
  return {
    initial: format(day, 'EEEEE', { locale: ptBR }).toUpperCase(),
    label: format(day, 'EEEE', { locale: ptBR }),
  };
});

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  format(new Date(2024, month, 1), 'MMMM', { locale: ptBR }),
);

/** Quantos anos a grade mostra de uma vez; as setas andam de bloco em bloco. */
const YEAR_BLOCK = 12;

/** Mantém só os dígitos e devolve o texto no formato dd/mm/aaaa. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

function parseTyped(text: string): Date | null {
  if (text.length !== DISPLAY_FORMAT.length) return null;
  const parsed = parse(text, DISPLAY_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function toDisplay(value: string): string {
  const parsed = parseValue(value);
  return parsed ? format(parsed, DISPLAY_FORMAT) : '';
}

export interface DatePickerProps {
  /** Data no formato ISO (`yyyy-MM-dd`), ou string vazia. */
  value: string;
  onChange: (value: string) => void;
  id?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Campo de data com calendário próprio.
 *
 * O `<input type="date">` é desenhado pelo sistema operacional: a caixa que abre
 * ignora a paleta, muda de idioma junto com o navegador e não tem como levar o
 * usuário direto a um mês distante. Mesma decisão do `Select` (19/08/2026). O
 * painel de gestão ainda não tem campo de data; quando tiver, o gêmeo nasce em
 * `management/ui` no contrato do `GlassInput`.
 *
 * As duas formas de preencher convivem: digitar dd/mm/aaaa no campo, com máscara,
 * ou abrir o calendário e escolher mês, ano e dia. Enquanto se digita, o texto
 * parcial fica num rascunho local; quando o valor de fora muda (envio, limpeza),
 * o rascunho perde a validade sozinho e o campo volta a espelhar o valor.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  invalid = false,
  className,
}: DatePickerProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ text: string; from: string } | null>(null);
  /* O cursor é o dia percorrido pelo teclado; o mês desenhado sai dele. */
  const [cursor, setCursor] = React.useState(() => parseValue(value) ?? startOfDay(new Date()));
  /* Um calendário só, em três profundidades: dia, mês do ano, ano do bloco. */
  const [view, setView] = React.useState<'days' | 'months' | 'years'>('days');

  const selected = parseValue(value);
  const text = draft && draft.from === value ? draft.text : toDisplay(value);

  const days = React.useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { locale: ptBR });
    /* Seis semanas fixas: com 4 ou 5 o calendário mudaria de altura a cada mês. */
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [cursor]);

  const yearBlockStart = Math.floor(cursor.getFullYear() / YEAR_BLOCK) * YEAR_BLOCK;

  function commit(date: Date) {
    setDraft(null);
    onChange(format(date, ISO_FORMAT));
    setCursor(date);
  }

  function handleType(raw: string) {
    const masked = maskDate(raw);
    const typed = parseTyped(masked);

    if (masked === '') {
      setDraft(null);
      onChange('');
      return;
    }

    if (typed) {
      setDraft({ text: masked, from: format(typed, ISO_FORMAT) });
      onChange(format(typed, ISO_FORMAT));
      setCursor(typed);
      return;
    }

    setDraft({ text: masked, from: value });
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setCursor(selected ?? startOfDay(new Date()));
      setView('days');
    }
    setOpen(next);
  }

  /** Passo das setas: um mês na visão de dias, um ano na de meses, um bloco na de anos. */
  function step(direction: -1 | 1) {
    if (view === 'days') setCursor(addMonths(cursor, direction));
    else if (view === 'months') setCursor(addYears(cursor, direction));
    else setCursor(addYears(cursor, direction * YEAR_BLOCK));
  }

  function handleGridKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in moves) {
      event.preventDefault();
      setCursor(addDays(cursor, moves[event.key] as number));
      return;
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setCursor(addMonths(cursor, event.key === 'PageUp' ? -1 : 1));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(cursor);
      setOpen(false);
    }
  }

  const today = startOfDay(new Date());

  return (
    <div className={cn('relative', className)}>
      <Input
        id={fieldId}
        value={text}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => setDraft(null)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="pr-10"
      />

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Abrir calendário"
            className="acao-neutra absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <CalendarIcon className="size-4" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-auto p-3">
          {/*
           * Cabeçalho de uma linha só: as setas andam no passo da visão atual e o
           * título é o botão que muda de profundidade. Clicar em "agosto de 2026"
           * abre os meses, clicar em "2026" abre os anos. São dois cliques para
           * chegar a qualquer data, sem lista suspensa dentro do calendário. O
           * título não leva seta de abertura (decisão do usuário em 20/08/2026):
           * com as setas laterais ao lado, três setas na mesma linha poluíam.
           */}
          <div className="mb-3 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={
                view === 'days'
                  ? 'Mês anterior'
                  : view === 'months'
                    ? 'Ano anterior'
                    : 'Anos anteriores'
              }
              onClick={() => step(-1)}
            >
              <ChevronLeftIcon />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 flex-1 px-2 text-sm font-medium"
              aria-label={view === 'years' ? 'Voltar aos meses' : 'Mudar mês e ano'}
              onClick={() =>
                setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'months')
              }
            >
              {/* `first-letter` num bloco, e não `capitalize` no botão: o segundo
                  escreve "Agosto De 2026", e o pseudo-elemento não pega em flex. */}
              <span className="block first-letter:uppercase">
                {view === 'days'
                  ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
                  : view === 'months'
                    ? format(cursor, 'yyyy')
                    : `${yearBlockStart} – ${yearBlockStart + YEAR_BLOCK - 1}`}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={
                view === 'days'
                  ? 'Próximo mês'
                  : view === 'months'
                    ? 'Próximo ano'
                    : 'Próximos anos'
              }
              onClick={() => step(1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>

          {view === 'months' && (
            <div className="grid w-[17.5rem] grid-cols-3 gap-1">
              {MONTHS.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  aria-current={index === cursor.getMonth() ? 'true' : undefined}
                  onClick={() => {
                    setCursor(setMonth(cursor, index));
                    setView('days');
                  }}
                  className={cn(
                    'h-11 rounded-md text-sm capitalize transition-colors',
                    index === cursor.getMonth()
                      ? 'bg-primary-strong font-medium text-on-primary'
                      : 'text-foreground hover:bg-secondary',
                  )}
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          {view === 'years' && (
            <div className="grid w-[17.5rem] grid-cols-3 gap-1">
              {Array.from({ length: YEAR_BLOCK }, (_, index) => yearBlockStart + index).map(
                (year) => (
                  <button
                    key={year}
                    type="button"
                    aria-current={year === cursor.getFullYear() ? 'true' : undefined}
                    onClick={() => {
                      setCursor(setYear(cursor, year));
                      setView('months');
                    }}
                    className={cn(
                      'h-11 rounded-md text-sm tabular-nums transition-colors',
                      year === cursor.getFullYear()
                        ? 'bg-primary-strong font-medium text-on-primary'
                        : 'text-foreground hover:bg-secondary',
                    )}
                  >
                    {year}
                  </button>
                ),
              )}
            </div>
          )}

          {view === 'days' && (
            <>
              {/*
               * O foco fica na grade, e o dia percorrido pelas setas é apontado por
               * `aria-activedescendant`. Assim o teclado anda pelo mês inteiro sem
               * que 42 botões entrem na ordem de tabulação da página.
               */}
              <div
                role="grid"
                aria-label="Calendário"
                tabIndex={0}
                aria-activedescendant={`${fieldId}-day-${format(cursor, ISO_FORMAT)}`}
                onKeyDown={handleGridKeys}
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div role="row" className="mb-1 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((weekday) => (
                    <abbr
                      key={weekday.label}
                      role="columnheader"
                      title={weekday.label}
                      className="flex size-9 items-center justify-center text-xs font-medium uppercase text-muted-foreground no-underline"
                    >
                      {weekday.initial}
                    </abbr>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const isSelected = selected ? isSameDay(day, selected) : false;
                    const isCursor = isSameDay(day, cursor);
                    const outside = !isSameMonth(day, cursor);

                    return (
                      <button
                        key={day.toISOString()}
                        id={`${fieldId}-day-${format(day, ISO_FORMAT)}`}
                        type="button"
                        role="gridcell"
                        tabIndex={-1}
                        aria-selected={isSelected}
                        aria-label={format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        onClick={() => {
                          commit(day);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex size-9 items-center justify-center rounded-md text-sm transition-colors',
                          outside ? 'text-muted-foreground/50' : 'text-foreground',
                          !isSelected && 'hover:bg-secondary',
                          isSameDay(day, today) &&
                            !isSelected &&
                            'ring-1 ring-inset ring-primary/60',
                          isCursor && !isSelected && 'bg-secondary',
                          isSelected && 'bg-primary-strong font-medium text-on-primary',
                        )}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(null);
                onChange('');
                setOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                commit(today);
                setOpen(false);
              }}
            >
              Hoje
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
