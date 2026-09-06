import type { VehicleStatus } from '@/management/types';

/**
 * A cor de cada situação de veículo no painel de gestão.
 *
 * <h2>Por que um arquivo só para cinco cores</h2>
 *
 * ⚠️ Esta tabela existia COPIADA em três lugares do mapa ao vivo: no
 * `fleet-map`, no `vehicle-icons` e no `fleet-3d-layer`. As três estavam iguais
 * por sorte, e o próprio comentário de uma delas já avisava o risco: a legenda
 * existe para explicar o que está desenhado, e três listas de cor viram três
 * verdades diferentes no dia em que alguém mexer em uma só.
 *
 * O gatilho foi o mapa da visão geral, em 06/09/2026: ele desenhava tudo em
 * indigo, com âmbar para quem estava sem sinal, e o usuário pediu as mesmas
 * cores do mapa ao vivo. Acrescentar uma quarta cópia para atender ao pedido
 * seria piorar exatamente o que o comentário alertava.
 *
 * <h2>⚠️ O painel do OPERADOR não usa esta tabela</h2>
 *
 * `components/shared/operation-map.tsx` tem paleta própria, com tokens do tema
 * (`--color-info`, `--color-success`) e outros nomes de status (`on_trip`,
 * `available`). São dois produtos diferentes na mesma base, e unificar os dois
 * seria decisão de design, não de código.
 *
 * <h2>Por que literal, e não token da paleta</h2>
 *
 * O MapLibre pinta em WebGL e não resolve `var(--color-...)`: a cor precisa
 * chegar como valor. É a mesma razão pela qual o three.js recebe o literal.
 */
export const STATUS_COLOR: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  SEM_SINAL: '#94A3B8',
};
