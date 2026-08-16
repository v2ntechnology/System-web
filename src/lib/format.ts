import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Recebe uma fração (0.98) e retorna "98%". */
export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

export function formatKm(value: number): string {
  return `${numberFormatter.format(value)} km`;
}

export function formatLiters(value: number): string {
  return `${numberFormatter.format(value)} L`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (parts.length <= 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTime(value: string | Date): string {
  return format(toDate(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTime(value: string | Date): string {
  return format(toDate(value), 'HH:mm', { locale: ptBR });
}

export function formatRelative(value: string | Date): string {
  return formatDistanceToNow(toDate(value), { locale: ptBR, addSuffix: true });
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
