import { DeleteIcon, EditIcon, HistoryIcon } from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { usePermissions } from '@/hooks/use-session';
import { QueryState } from '@/management/components/layout/query-state';
import {
  deleteMaintenanceEvent,
  type MaintenanceEvent,
  type MaintenanceItemId,
} from '@/management/lib/fleet-api';
import { brl, dateOnly, km } from '@/management/lib/format';
import { MAINTENANCE_ITEMS } from '@/management/mocks/maintenance-partners';
import { Alert, GlassModal, SpectrumButton } from '@/management/ui';

import { detalhesEmTexto } from '../maintenance-item-fields';
import { getVehicleMaintenanceEvents } from '../api';
import { MaintenanceEventDialog } from './maintenance-event-dialog';
import { VehicleCard } from './vehicle-telemetry-cards';

const rotuloDe = (item: MaintenanceItemId) =>
  MAINTENANCE_ITEMS.find((candidato) => candidato.id === item)?.label ?? item;

/** `done_at` é DATE: meio-dia evita que o fuso puxe a data para o dia anterior. */
const dataDa = (iso: string) => dateOnly.format(new Date(`${iso}T12:00:00`));

/**
 * O custo dos últimos 12 meses e o custo por km no mesmo recorte.
 *
 * ⚠️ O custo por km só aparece com dois odômetros diferentes no período: com um
 * só, a distância é zero e a divisão inventaria um número. Lançamento sem custo
 * entra na distância e não no total, porque "sem valor" não é "de graça" e a tela
 * avisa quantos ficaram de fora.
 */
function resumoDoAno(eventos: MaintenanceEvent[], agora: number) {
  const corte = new Date(agora);
  corte.setFullYear(corte.getFullYear() - 1);
  const noAno = eventos.filter((evento) => new Date(`${evento.doneAt}T12:00:00`) >= corte);

  const total = noAno.reduce((soma, evento) => soma + (evento.cost ?? 0), 0);
  const semCusto = noAno.filter((evento) => evento.cost == null).length;
  const odometros = noAno
    .map((evento) => evento.odometerKm)
    .filter((valor): valor is number => valor != null);
  const distancia =
    odometros.length > 1 ? Math.max(...odometros) - Math.min(...odometros) : undefined;

  return {
    total,
    semCusto,
    quantidade: noAno.length,
    porKm: distancia && distancia > 0 && total > 0 ? total / distancia : undefined,
  };
}

/**
 * O histórico de trocas do veículo, na seção Histórico da ficha (decisão do
 * usuário em 22/09/2026). `item` recorta a lista para um item só.
 *
 * ⚠️ **Editar e excluir só aparecem com `maintenance.manage`**, a mesma permissão
 * que o servidor exige. Esconder é conforto: quem decide é a API.
 */
export function MaintenanceHistory({
  vehicleId,
  item,
  odometroAtual,
}: {
  vehicleId: string;
  /** O item aberto na grade. Ausente, o histórico mostra todos. */
  item?: MaintenanceItemId | undefined;
  odometroAtual?: number | undefined;
}) {
  const { hasPermission } = usePermissions();
  const podeGerenciar = hasPermission('maintenance.manage');
  const [agora] = useState(() => Date.now());
  const [editando, setEditando] = useState<MaintenanceEvent | null>(null);
  const [excluindo, setExcluindo] = useState<MaintenanceEvent | null>(null);

  const historico = useQuery({
    queryKey: ['vehicle-maintenance-events', vehicleId, item ?? 'todos'],
    queryFn: () => getVehicleMaintenanceEvents(vehicleId, item),
  });

  const eventos = historico.data ?? [];
  const resumo = resumoDoAno(eventos, agora);

  return (
    <VehicleCard
      title={item ? `Histórico: ${rotuloDe(item).toLowerCase()}` : 'Histórico de manutenção'}
      icon={HistoryIcon}
      hint={
        resumo.quantidade > 0
          ? [
              `${brl.format(resumo.total)} em 12 meses`,
              resumo.porKm != null ? `${brl.format(resumo.porKm)}/km` : null,
              resumo.semCusto > 0
                ? `${resumo.semCusto} ${resumo.semCusto === 1 ? 'lançamento' : 'lançamentos'} sem valor`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Do mais recente para o mais antigo'
      }
    >
      <QueryState
        isPending={historico.isPending}
        isError={historico.isError}
        label="o histórico de manutenção"
      >
        {eventos.length === 0 ? (
          <p className="text-on-light-muted text-body-md">
            {item
              ? 'Nenhuma troca registrada para este item.'
              : 'Nenhuma troca registrada ainda. As trocas são lançadas em Manutenção.'}
          </p>
        ) : (
          <ol className="divide-light-outline flex flex-col divide-y">
            {eventos.map((evento) => (
              <li key={evento.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-on-light text-body-md font-semibold">
                    {rotuloDe(evento.item)}
                    <span className="text-on-light-muted font-normal">
                      {' '}
                      · {dataDa(evento.doneAt)}
                    </span>
                  </p>
                  <p className="text-on-light-variant text-label-md normal-case">
                    {[
                      evento.odometerKm != null ? `${km.format(evento.odometerKm)} km` : null,
                      evento.partnerName,
                      evento.cost != null ? brl.format(evento.cost) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem odômetro, oficina ou valor'}
                  </p>
                  {detalhesEmTexto(evento.item, evento.details) ? (
                    <p className="text-on-light-variant text-label-md mt-1 normal-case">
                      {detalhesEmTexto(evento.item, evento.details)}
                    </p>
                  ) : null}
                  {evento.notes ? (
                    <p className="text-on-light-variant text-label-md mt-1 normal-case">
                      {evento.notes}
                    </p>
                  ) : null}
                  {evento.createdByName ? (
                    <p className="text-on-light-muted text-label-sm mt-1 normal-case">
                      Lançado por {evento.createdByName}
                    </p>
                  ) : null}
                </div>

                {podeGerenciar ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditando(evento)}
                      aria-label={`Corrigir a troca de ${dataDa(evento.doneAt)}`}
                      title="Corrigir"
                      className="text-on-light-muted hover:text-on-light hover:bg-light-container focus-visible:ring-primary-on-light rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <EditIcon size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindo(evento)}
                      aria-label={`Excluir a troca de ${dataDa(evento.doneAt)}`}
                      title="Excluir"
                      className="text-on-light-muted hover:text-error-on-light hover:bg-light-container focus-visible:ring-primary-on-light rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <DeleteIcon size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </QueryState>

      {editando ? (
        <MaintenanceEventDialog
          open
          onOpenChange={(aberto) => !aberto && setEditando(null)}
          vehicleId={vehicleId}
          item={editando.item}
          itemLabel={rotuloDe(editando.item)}
          odometroAtual={odometroAtual}
          evento={editando}
        />
      ) : null}

      <ConfirmarExclusao
        vehicleId={vehicleId}
        evento={excluindo}
        onClose={() => setExcluindo(null)}
      />
    </VehicleCard>
  );
}

/**
 * A pergunta antes de apagar uma troca.
 *
 * O texto avisa o efeito que não se vê: apagar a troca mais recente faz o
 * vencimento voltar a contar da anterior, e o item pode aparecer vencido.
 */
function ConfirmarExclusao({
  vehicleId,
  evento,
  onClose,
}: {
  vehicleId: string;
  evento: MaintenanceEvent | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const apagar = useMutation({
    mutationFn: (alvo: MaintenanceEvent) => deleteMaintenanceEvent(vehicleId, alvo.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicle-maintenance', vehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-maintenance-events', vehicleId] }),
      ]);
      fechar();
    },
  });

  /* O erro da tentativa anterior não pode reaparecer na próxima pergunta. */
  const fechar = () => {
    apagar.reset();
    onClose();
  };

  return (
    <GlassModal
      open={evento != null}
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
      title="Excluir troca"
      className="w-[calc(100vw-2rem)] max-w-[480px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-light text-body-md">
          Excluir a troca de <strong>{evento ? rotuloDe(evento.item).toLowerCase() : ''}</strong> de{' '}
          <strong>{evento ? dataDa(evento.doneAt) : ''}</strong>? Não tem como voltar.
        </p>

        <Alert severity="info">
          Se esta for a troca mais recente do item, o vencimento volta a contar da anterior. Para
          consertar um valor digitado errado, use <strong>corrigir</strong>.
        </Alert>

        {apagar.isError ? (
          <p className="text-error text-body-md">
            {apagar.error instanceof Error
              ? apagar.error.message
              : 'Não foi possível excluir a troca.'}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <SpectrumButton
            type="button"
            variant="danger"
            onClick={fechar}
            disabled={apagar.isPending}
          >
            Cancelar
          </SpectrumButton>
          <SpectrumButton
            type="button"
            onClick={() => evento && apagar.mutate(evento)}
            disabled={apagar.isPending}
          >
            {apagar.isPending ? 'Excluindo…' : 'Excluir'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}
