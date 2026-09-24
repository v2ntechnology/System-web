import { httpRequest } from '@/services/http';

/**
 * Os checklists que o motorista preencheu.
 *
 * ⚠️ Era o lado que faltava: o aplicativo gravava e ninguém lia. Existia rota para
 * os anexos **de uma** submissão e nenhuma para descobrir quais submissões
 * existiam, então o motorista registrava a avaria e o gestor não chegava nela.
 */

export interface ResumoDaSubmissao {
  id: string;
  enviadoEm: string;
  placa: string;
  vehicleId: string;
  motorista: string;
  odometroKm: number | null;
  total: number;
  naoConformes: number;
  /** Se ESTE checklist parou o caminhão. */
  travou: boolean;
}

/** ⚠️ `typed` ou `dictated`: transcrição erra, e quem lê precisa saber a origem. */
export type OrigemDaObservacao = 'typed' | 'dictated';

export interface RespostaLida {
  itemId: string;
  section: string;
  label: string;
  blocking: boolean;
  status: 'conforme' | 'nao_conforme' | 'nao_aplica';
  note: string | null;
  noteSource: OrigemDaObservacao | null;
}

export interface AnexoLido {
  id: string;
  itemId: string;
  kind: 'photo' | 'audio';
  contentType: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface DetalheDaSubmissao {
  resumo: ResumoDaSubmissao;
  modelo: string;
  versaoDoModelo: number;
  observacoes: string | null;
  latitude: number | null;
  longitude: number | null;
  respostas: RespostaLida[];
  anexos: AnexoLido[];
}

/** Sem placa, os da frota inteira. A placa é como a ficha do caminhão se endereça. */
export function getChecklistFills(plate?: string): Promise<ResumoDaSubmissao[]> {
  const query = plate ? `?plate=${encodeURIComponent(plate)}` : '';
  return httpRequest<ResumoDaSubmissao[]>(`/v1/checklists${query}`);
}

export function getChecklistFill(submissionId: string): Promise<DetalheDaSubmissao> {
  return httpRequest<DetalheDaSubmissao>(`/v1/checklists/${submissionId}`);
}

/**
 * O endereço para abrir uma foto ou ouvir um áudio.
 *
 * ⚠️ Pedido na hora, a cada abertura, e vence em minutos. **Não guarde este
 * endereço**: o bucket é privado, e uma URL permanente exigiria abri-lo, o que
 * deixaria foto de avaria e voz de funcionário acessíveis a quem tivesse o link.
 */
export function getAnexoUrl(
  submissionId: string,
  attachmentId: string,
): Promise<{ url: string; expiresAt: string }> {
  return httpRequest<{ url: string; expiresAt: string }>(
    `/v1/checklists/${submissionId}/attachments/${attachmentId}/url`,
  );
}

/** A trava que um checklist reprovado pôs no caminhão, e quem pode soltá-la. */
export interface BloqueioDoVeiculo {
  id: string;
  vehicleId: string;
  placa: string;
  submissionId: string;
  itens: string[];
  bloqueadoEm: string;
  liberadoEm: string | null;
  liberadoPor: string | null;
  motivoDaLiberacao: string | null;
}

export async function getBloqueio(vehicleId: string): Promise<BloqueioDoVeiculo | null> {
  return (
    (await httpRequest<BloqueioDoVeiculo | undefined>(
      `/v1/vehicles/${vehicleId}/checklist-block`,
    )) ?? null
  );
}

/**
 * ⚠️ Põe na rua um veículo que reprovou em item crítico.
 *
 * O motivo é obrigatório, e o nome de quem liberou fica gravado. É o que faltava na
 * folha de papel: ela saía assinada com doze não conformidades e ninguém respondia
 * por aquela saída.
 */
export function liberarBloqueio(vehicleId: string, reason: string): Promise<BloqueioDoVeiculo> {
  return httpRequest<BloqueioDoVeiculo>(`/v1/vehicles/${vehicleId}/checklist-block/release`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
