import { FileIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';

import { QueryState } from '@/management/components/layout/query-state';
import { fetchVehicleDocuments } from '@/management/features/documents/api';
import { DocumentRow } from '@/management/features/documents/components/document-row';
import { copyDigitableLine } from '@/management/features/documents/copy-line';

import { VehicleCard } from './vehicle-telemetry-cards';

/**
 * As guias deste veículo: licenciamento, IPVA e cronotacógrafo.
 *
 * É a mesma linha da fila de Documentos, e de propósito: a pessoa que abre a
 * ficha para pagar a guia de um caminhão reconhece o que já viu na tela cheia,
 * com a mesma marca de pendência e o mesmo botão de copiar.
 *
 * ⚠️ **Nada aqui paga.** A Smartec entrega o PDF e a linha digitável; o
 * pagamento acontece no banco. O bloco não tem, e não deve ganhar, um botão que
 * sugira quitar a guia por dentro do painel.
 */
export function VehicleGuidesCard({
  vehicleId,
  className,
}: {
  /** Ausente no veículo de demonstração, que não consulta a API. */
  vehicleId: string | undefined;
  className?: string | undefined;
}) {
  /*
   * ⚠️ A chave começa com o mesmo prefixo da fila (`vehicle-documents`), e isso
   * é intencional: uma coleta nova invalida o prefixo e derruba as duas telas
   * de uma vez, sem precisar conhecer cada ficha aberta.
   */
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['vehicle-documents', vehicleId],
    queryFn: () => fetchVehicleDocuments(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  const guias = data ?? [];
  const pendentes = guias.filter((guia) => guia.pending).length;

  return (
    <VehicleCard
      title="Guias a pagar"
      icon={FileIcon}
      hint={dica(guias.length, pendentes)}
      className={className}
    >
      {!vehicleId ? (
        <p className="text-on-light-muted text-body-md">
          Guias não são exibidas no veículo de demonstração.
        </p>
      ) : (
        <QueryState
          isPending={isPending}
          isError={isError}
          error={error}
          label="as guias deste veículo"
        >
          {guias.length === 0 ? (
            /*
             * ⚠️ **Vazio NÃO é "está tudo em dia".** A Smartec só devolve guia
             * para quem ela já pesquisou, e 3 veículos da frota nunca foram
             * consultados. O cartão de Documentação, logo ao lado, é quem diz
             * qual dos dois casos é este.
             */
            <p className="text-on-light-muted text-body-md">
              Nenhuma guia coletada para este veículo. Isso não significa que não há nada a pagar:
              veja a Documentação ao lado para saber se ele já foi consultado.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {guias.map((guia) => (
                <li key={guia.id}>
                  <DocumentRow
                    doc={guia}
                    showPlate={false}
                    onCopy={() => void copyDigitableLine(guia)}
                  />
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      )}
    </VehicleCard>
  );
}

/**
 * O cabeçalho já responde "tem algo a resolver aqui?" antes de a lista ser lida.
 *
 * ⚠️ **O sujeito é a GUIA, e nunca o veículo**, e a concordância carrega isso:
 * "nenhuma pendente", e não "nenhuma pendência". Este bloco fica ao lado do
 * cartão de Documentação, que fala do veículo, e os dois podem divergir com
 * razão: o QTM5077 aparece com o licenciamento parado em 2025 na ficha do
 * DETRAN e com a guia de 2026 já emitida aqui, esperando pagamento. As duas
 * coisas juntas contam a história inteira; um texto que dissesse "sem
 * pendência" sobre o veículo contradiria o cartão vizinho.
 */
function dica(total: number, pendentes: number): string {
  if (total === 0) return 'Licenciamento, IPVA e cronotacógrafo';
  const guias = `${total} ${total === 1 ? 'guia' : 'guias'}`;
  if (pendentes === 0) return `${guias}, nenhuma pendente`;
  return `${guias}, ${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;
}
