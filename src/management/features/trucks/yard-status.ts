import {
  BlockedIcon,
  CheckCircleIcon,
  MaintenanceIcon,
  RadarIcon,
  RouteIcon,
  type IconType,
} from '@/components/icons';
import type { VehicleStatus } from '@/management/types';

/** Sem sinal não confirma avaria; bloqueio mantém o significado do contrato da API. */
export const YARD_STATUS: Record<
  VehicleStatus,
  {
    label: string;
    plural: string;
    tone: string;
    icon: IconType;
  }
> = {
  DISPONIVEL: {
    /*
     * ⚠️ VERDE desde 18/09/2026, a pedido do usuário, e isto REVERTE a decisão
     * de 16/09 que deixava disponível sem cor ("livre é neutro"). O motivo de
     * antes continua valendo como risco: são 27 dos 40, então o verde é o fundo
     * da grade, e é o azul de quem está na rua que precisa saltar dele.
     */
    label: 'Disponível',
    plural: 'Disponíveis',
    tone: 'success',
    icon: CheckCircleIcon,
  },
  EM_VIAGEM: { label: 'Em viagem', plural: 'Em viagem', tone: 'info', icon: RouteIcon },
  MANUTENCAO: {
    label: 'Manutenção',
    plural: 'Em manutenção',
    tone: 'warning',
    icon: MaintenanceIcon,
  },
  BLOQUEADO: { label: 'Bloqueado', plural: 'Bloqueados', tone: 'error', icon: BlockedIcon },
  /*
   * ⚠️ CINZA, e não laranja, desde 18/09/2026 (pedido do usuário). O cinza diz
   * melhor o que o estado é: **ausência de notícia, e não defeito**. Laranja
   * divide o alerta com Manutenção, que é avaria de verdade, e caminhão sem
   * sinal na maioria das vezes está só com o rastreador dormindo.
   */
  SEM_SINAL: { label: 'Sem sinal', plural: 'Sem sinal', tone: 'muted', icon: RadarIcon },
};
