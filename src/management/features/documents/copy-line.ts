import { toast } from 'sonner';

import type { VehicleDocument } from './types';

/**
 * Leva a linha digitável de uma guia para a área de transferência.
 *
 * Mora aqui, e não dentro da tela, porque as guias aparecem em dois lugares: a
 * fila de Documentos e a ficha do veículo. Duas cópias desta função divergiriam
 * justamente na mensagem de erro, que é a parte que importa.
 *
 * ⚠️ **A falha precisa ser dita.** A área de transferência exige contexto
 * seguro e permissão, e recusa em alguns navegadores sem avisar ninguém. Em
 * silêncio, a pessoa cola o que já estava lá e paga a conta errada.
 */
export async function copyDigitableLine(doc: VehicleDocument): Promise<void> {
  if (!doc.digitableLine) return;

  try {
    await navigator.clipboard.writeText(doc.digitableLine);
    toast.success(`Linha digitável de ${doc.plate} copiada.`);
  } catch {
    toast.error('Não foi possível copiar. Selecione a linha e copie à mão.');
  }
}
