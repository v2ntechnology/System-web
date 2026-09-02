import {
  EyeOffIcon,
  GaugeIcon,
  PhoneIcon,
  RouteIcon,
  WarningIcon,
  type IconType,
} from '@/components/icons';

import type { SafetyEventType } from './types';

/** Mesmo princípio dos impedimentos: cada assunto tem um desenho só. */
export const SAFETY_TYPE_META: Record<SafetyEventType, { label: string; icon: IconType }> = {
  EXCESSO_VELOCIDADE: { label: 'Excesso de velocidade', icon: GaugeIcon },
  SONOLENCIA: { label: 'Sonolência', icon: EyeOffIcon },
  FRENAGEM_BRUSCA: { label: 'Frenagem brusca', icon: WarningIcon },
  CURVA_AGRESSIVA: { label: 'Curva agressiva', icon: RouteIcon },
  CELULAR_AO_VOLANTE: { label: 'Celular ao volante', icon: PhoneIcon },
};

/**
 * A frase de comparação da taxa.
 *
 * Compara eventos por mil quilômetros, e não contagem bruta: sem a
 * normalização, todo mês de pico viraria alarme falso.
 */
export function rateHint(current: number, previous: number): string {
  const rate = current.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (previous === 0) return `${rate} eventos por mil km`;

  const variation = Math.round(((current - previous) / previous) * 100);
  if (variation === 0) return `${rate} eventos por mil km, estável`;
  return `${rate} eventos por mil km, ${variation > 0 ? '+' : ''}${variation}% vs. período anterior`;
}
