import {
  addDays,
  addMonths,
  addYears,
  format,
  isValid,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';

/**
 * O miolo do campo de data, sem nenhuma UI.
 *
 * <h2>Por que existe separado</h2>
 *
 * O sistema tem dois conjuntos de primitivos por decisão de projeto: o painel
 * operacional em `components/ui` e o de gestão em `management/ui`. Os dois
 * precisam do mesmo campo de data, e a máquina de estado dele não é trivial:
 * rascunho de digitação, cursor de teclado, três profundidades de calendário e
 * a conversão entre o texto brasileiro e o ISO que o formulário guarda.
 *
 * Duplicar isso em duas peles significaria corrigir todo defeito duas vezes, e
 * a segunda cópia envelheceria em silêncio. Aqui a lógica é uma só; cada painel
 * desenha do jeito dele.
 *
 * <h2>Por que não `<input type="date">`</h2>
 *
 * ⚠️ A caixa do nativo é desenhada pelo sistema operacional: ignora a paleta,
 * muda de idioma junto com o navegador e não deixa saltar para um mês distante.
 * É a mesma razão que tirou o `<select>` nativo do sistema em 19/08/2026.
 */

export const DISPLAY_FORMAT = 'dd/MM/yyyy';
export const ISO_FORMAT = 'yyyy-MM-dd';

/** Quantos anos a grade mostra de uma vez; as setas andam de bloco em bloco. */
export const YEAR_BLOCK = 12;

/** Iniciais da semana na ordem do calendário brasileiro (domingo primeiro). */
export const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const day = addDays(startOfWeek(new Date(2024, 0, 7), { locale: ptBR }), index);
  return {
    initial: format(day, 'EEEEE', { locale: ptBR }).toUpperCase(),
    label: format(day, 'EEEE', { locale: ptBR }),
  };
});

export const MONTHS = Array.from({ length: 12 }, (_, month) =>
  format(new Date(2024, month, 1), 'MMMM', { locale: ptBR }),
);

/** Mantém só os dígitos e devolve o texto no formato dd/mm/aaaa. */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export function parseTyped(text: string): Date | null {
  if (text.length !== DISPLAY_FORMAT.length) return null;
  const parsed = parse(text, DISPLAY_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

export function parseValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function toDisplay(value: string): string {
  const parsed = parseValue(value);
  return parsed ? format(parsed, DISPLAY_FORMAT) : '';
}

/** Título do cabeçalho, conforme a profundidade aberta. */
export function headerLabel(view: DateFieldView, cursor: Date, yearBlockStart: number): string {
  if (view === 'days') return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  if (view === 'months') return format(cursor, 'yyyy');
  return `${yearBlockStart} a ${yearBlockStart + YEAR_BLOCK - 1}`;
}

export type DateFieldView = 'days' | 'months' | 'years';

export interface UseDateFieldOptions {
  /** Data em ISO (`yyyy-MM-dd`), ou string vazia. */
  value: string;
  onChange: (value: string) => void;
  id?: string | undefined;
}

/**
 * Estado e comportamento do campo de data.
 *
 * As duas formas de preencher convivem: digitar dd/mm/aaaa com máscara, ou abrir
 * o calendário e escolher mês, ano e dia.
 *
 * ⚠️ O rascunho existe porque digitar passa por estados inválidos: "01/0" não é
 * data. Ele guarda o texto parcial junto com o valor de onde saiu, e perde a
 * validade sozinho quando o valor de fora muda (envio, limpeza) — sem isso, um
 * formulário limpo continuaria mostrando o que a pessoa digitou antes.
 */
export function useDateField({ value, onChange, id }: UseDateFieldOptions) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ text: string; from: string } | null>(null);
  /* O cursor é o dia percorrido pelo teclado; o mês desenhado sai dele. */
  const [cursor, setCursor] = useState(() => parseValue(value) ?? startOfDay(new Date()));
  /* Um calendário só, em três profundidades: dia, mês do ano, ano do bloco. */
  const [view, setView] = useState<DateFieldView>('days');

  const selected = parseValue(value);
  const text = draft && draft.from === value ? draft.text : toDisplay(value);

  const days = useMemo(() => {
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

  /** Um passo mais fundo no calendário, ou de volta aos meses vindo dos anos. */
  function deepen() {
    setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'months');
  }

  function handleGridKeys(event: KeyboardEvent<HTMLDivElement>) {
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

  return {
    fieldId,
    open,
    view,
    cursor,
    selected,
    text,
    days,
    yearBlockStart,
    today: startOfDay(new Date()),
    header: headerLabel(view, cursor, yearBlockStart),
    setCursor,
    setView,
    setDraft,
    commit,
    deepen,
    step,
    handleType,
    handleOpenChange,
    handleGridKeys,
  };
}
