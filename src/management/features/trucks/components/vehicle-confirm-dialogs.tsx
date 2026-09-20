import type { VehicleListEntry } from '@/management/lib/fleet-api';
import { Alert, GlassModal, SpectrumButton } from '@/management/ui';

/**
 * As duas perguntas que antecedem escrita no cadastro do veículo.
 *
 * Moram aqui, e não na tela, porque desde 18/09/2026 são feitas de dois lugares:
 * do Pátio, no rodapé do cartão, e do Cadastro de frota, na linha da tabela. Uma
 * cópia em cada tela faria o texto que explica a diferença entre inativar e
 * tirar de operação divergir na primeira correção, e é justamente esse texto que
 * evita o erro caro.
 */

/**
 * A pergunta antes de tirar da frota ou devolver.
 *
 * ⚠️ Existe porque o atalho fica a um clique de distância: sem a confirmação, um
 * clique torto já grava no banco, e numa grade com o cursor passando por cima o
 * clique torto acontece.
 *
 * O texto diz o que inativar NÃO é. A confusão com "fora de serviço" é o erro
 * provável aqui, e ele custa caro: quem inativa um caminhão que só está na
 * oficina tira da escala um veículo que volta na semana que vem.
 */
export function ConfirmToggle({
  vehicle,
  pending,
  onCancel,
  onConfirm,
}: {
  vehicle: VehicleListEntry | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ativando = vehicle != null && !vehicle.active;

  return (
    <GlassModal
      open={vehicle != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={ativando ? 'Ativar veículo' : 'Inativar veículo'}
      className="w-[calc(100vw-2rem)] max-w-[480px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-light text-body-md">
          {ativando ? 'Devolver ' : 'Tirar '}
          <strong>{vehicle?.plate}</strong>
          {ativando
            ? ' para a frota? Ele volta a aparecer nas listas e nos seletores.'
            : ' da frota? Ele deixa de aparecer nas listas e nos seletores. Nada é apagado, e o histórico continua respondendo por ele.'}
        </p>

        {!ativando ? (
          <Alert severity="info">
            Inativar é para o caminhão que <strong>saiu da frota</strong>: vendido, devolvido, fim
            de contrato. Se ele só está parado agora, na oficina ou esperando peça, o certo é marcar{' '}
            <strong>fora de operação</strong> na ficha, que pede o motivo e mantém o caminhão na
            conta da frota.
          </Alert>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <SpectrumButton type="button" variant="danger" onClick={onCancel} disabled={pending}>
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="button" onClick={onConfirm} disabled={pending}>
            {pending ? (ativando ? 'Ativando…' : 'Inativando…') : ativando ? 'Ativar' : 'Inativar'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}

/**
 * A pergunta antes de apagar.
 *
 * A confirmação não promete o resultado: veículo com viagem, evento ou posição é
 * recusado pelo backend, e a tela não tem como saber disso antes de tentar. O
 * texto diz que a exclusão só vale para quem não tem vínculo, e o erro que volta
 * explica qual vínculo apareceu.
 */
export function ConfirmDelete({
  vehicle,
  pending,
  onCancel,
  onConfirm,
}: {
  vehicle: VehicleListEntry | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <GlassModal
      open={vehicle != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="Excluir veículo"
      className="w-[calc(100vw-2rem)] max-w-[480px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-light text-body-md">
          Excluir <strong>{vehicle?.plate}</strong>? O cadastro é apagado e não tem como voltar.
        </p>

        <Alert severity="warning">
          Só dá para excluir o caminhão que não tem vínculo nenhum no sistema. Se este já tem
          viagem, evento de segurança ou posição registrada, o certo é marcar como{' '}
          <strong>fora de serviço</strong> na ficha: assim o histórico da frota continua respondendo
          por ele.
        </Alert>

        <div className="flex items-center justify-end gap-2">
          <SpectrumButton type="button" variant="danger" onClick={onCancel} disabled={pending}>
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Excluindo…' : 'Excluir'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}
