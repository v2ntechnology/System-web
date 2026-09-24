import { env } from '@/app/environment';
import { httpRequest } from '@/services/http';

/**
 * O editor de checklist da frota.
 *
 * ⚠️ **Por TIPO de veículo, e não por veículo.** Publicar aqui muda o que todos os
 * caminhões da empresa passam a conferir na saída. A tela precisa dizer isso antes,
 * e é para isso que `veiculos` vem na resposta.
 */

/** Os cinco tipos, com os rótulos que o gestor lê. */
export const TIPOS_DE_VEICULO = [
  { id: 'truck', label: 'Caminhão' },
  { id: 'tractor_unit', label: 'Cavalo mecânico' },
  { id: 'trailer', label: 'Carreta' },
  { id: 'van', label: 'Utilitário' },
  { id: 'light', label: 'Veículo leve' },
] as const;

export type VehicleType = (typeof TIPOS_DE_VEICULO)[number]['id'];

export function rotuloDoTipo(id: string): string {
  return TIPOS_DE_VEICULO.find((t) => t.id === id)?.label ?? id;
}

export interface ResumoDoModelo {
  vehicleType: string;
  /** Nulo quando a empresa não tem modelo ativo para o tipo. */
  name: string | null;
  version: number;
  itens: number;
  /** Quantos veículos ativos daquele tipo. É o alcance da edição. */
  veiculos: number;
  atualizadoEm: string | null;
}

export interface ItemDoModelo {
  id?: string;
  section: string;
  label: string;
  hint?: string | null;
  blocking: boolean;
  requiresPhotoOnFail: boolean;
}

export interface ModeloCompleto {
  id: string;
  vehicleType: string;
  name: string;
  version: number;
  itens: ItemDoModelo[];
}

export function getResumoDosModelos(): Promise<ResumoDoModelo[]> {
  return httpRequest<ResumoDoModelo[]>('/v1/checklist-templates');
}

export function getModelo(vehicleType: string): Promise<ModeloCompleto> {
  return httpRequest<ModeloCompleto>(`/v1/checklist-templates/${vehicleType}`);
}

/**
 * Publica uma versão nova.
 *
 * ⚠️ **Não edita a atual.** A anterior fica guardada e inativa, porque cada
 * checklist preenchido aponta para a versão dele: editar no lugar faria um
 * preenchimento de março passar a exibir as perguntas de setembro.
 *
 * ⚠️ O motorista que estiver com a tela aberta recebe 409 ao enviar e recarrega.
 * É o desenho, não um defeito.
 */
export function publicarModelo(
  vehicleType: string,
  modelo: { name: string; items: ItemDoModelo[] },
): Promise<ResumoDoModelo> {
  return httpRequest<ResumoDoModelo>(`/v1/checklist-templates/${vehicleType}`, {
    method: 'PUT',
    body: JSON.stringify(modelo),
  });
}

/**
 * ⚠️ O editor **não tem modo de demonstração**.
 *
 * O resto do painel cai em mock com `VITE_ENABLE_MOCKS`, e aqui isso seria pior que
 * inútil: o gestor montaria a lista inteira, clicaria em publicar, veria "publicado"
 * e nada teria saído da tela dele. O motorista continuaria com o checklist antigo, e
 * ninguém teria como saber.
 */
export const editorDisponivel = !env.enableMocks;
