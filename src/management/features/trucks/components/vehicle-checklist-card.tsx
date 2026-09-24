import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryState } from '@/management/components/layout/query-state';
import {
  getBloqueio,
  getChecklistFill,
  getChecklistFills,
  getAnexoUrl,
  liberarBloqueio,
  type RespostaLida,
} from '@/management/features/checklists/fills-api';
import { ChecklistIcon } from '@/components/icons';
import { StatusChip, cn } from '@/management/ui';

import { VehicleCard } from './vehicle-telemetry-cards';

const ROTULO_DO_STATUS: Record<RespostaLida['status'], string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplica: 'Não aplica',
};

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Os checklists que os motoristas preencheram neste caminhão.
 *
 * ⚠️ Fica na ficha do veículo, ao contrário do EDITOR de modelo, que mora em
 * `/gestao/checklists` e é por tipo. A diferença não é de gosto: ler o que foi
 * preenchido **neste** caminhão é naturalmente deste caminhão, enquanto editar o
 * modelo aqui faria o gestor achar que muda só este veículo quando estaria mudando
 * o que a frota inteira daquele tipo confere.
 */
export function VehicleChecklistCard({
  vehicleId,
  plate,
  className,
}: {
  vehicleId: string;
  plate: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  const fills = useQuery({
    queryKey: ['checklist-fills', plate],
    queryFn: () => getChecklistFills(plate),
  });

  return (
    <VehicleCard
      title="Checklists de saída"
      icon={ChecklistIcon}
      hint="O que o motorista conferiu antes de sair"
      className={className}
    >
      <BloqueioDoCaminhao vehicleId={vehicleId} />

      <QueryState
        isPending={fills.isPending}
        isError={fills.isError}
        error={fills.error}
        label="os checklists deste caminhão"
      >
        {fills.data && fills.data.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {fills.data.map((fill) => (
              <li key={fill.id} className="bg-surface-lowest rounded-lg">
                <button
                  type="button"
                  onClick={() => setAberto(aberto === fill.id ? null : fill.id)}
                  aria-expanded={aberto === fill.id}
                  className="flex w-full flex-wrap items-center gap-2 p-3 text-left"
                >
                  <span className="text-on-surface font-semibold">{fill.motorista}</span>
                  <span className="tabular text-on-surface-muted text-label-md normal-case">
                    {dataHora.format(new Date(fill.enviadoEm))}
                    {fill.odometroKm ? ` · ${fill.odometroKm.toLocaleString('pt-BR')} km` : ''}
                  </span>

                  {/* ⚠️ O número que o gestor procura, e não a lista inteira. */}
                  <StatusChip
                    tone={fill.naoConformes > 0 ? 'attention' : 'positive'}
                    className="ml-auto"
                  >
                    {fill.naoConformes > 0
                      ? `${fill.naoConformes} de ${fill.total} reprovados`
                      : 'Tudo conforme'}
                  </StatusChip>

                  {fill.travou ? <StatusChip tone="critical">Parou o caminhão</StatusChip> : null}
                </button>

                {aberto === fill.id ? <DetalheDoChecklist submissionId={fill.id} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-surface-muted text-body-md py-6 text-center normal-case">
            Nenhum checklist enviado para este caminhão ainda.
          </p>
        )}
      </QueryState>
    </VehicleCard>
  );
}

/**
 * A trava, quando existe, e o caminho para soltá-la.
 *
 * ⚠️ Liberar põe na rua um veículo que reprovou em item crítico, então o motivo é
 * obrigatório e o nome de quem liberou fica gravado. É o que faltava na folha de
 * papel: ela saía assinada com doze não conformidades e ninguém respondia por
 * aquela saída.
 */
function BloqueioDoCaminhao({ vehicleId }: { vehicleId: string }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');

  const bloqueio = useQuery({
    queryKey: ['vehicle-block', vehicleId],
    queryFn: () => getBloqueio(vehicleId),
  });

  const liberar = useMutation({
    mutationFn: () => liberarBloqueio(vehicleId, motivo),
    onSuccess: () => {
      toast.success('Caminhão liberado. A liberação ficou registrada no seu nome.');
      setMotivo('');
      void queryClient.invalidateQueries({ queryKey: ['vehicle-block', vehicleId] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  if (!bloqueio.data) return null;

  return (
    <div className="border-error bg-error-soft mb-3 grid gap-2 rounded-lg border p-3">
      <p className="text-error font-semibold">Caminhão parado pelo checklist</p>
      <p className="text-on-surface text-body-md normal-case">
        Reprovou em: {bloqueio.data.itens.join(', ')}.
      </p>

      <label className="grid gap-1">
        <span className="text-on-surface-muted text-label-md">
          Por que ele pode sair mesmo assim?
        </span>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: guincho a caminho, sai rebocado"
          className="border-outline-variant bg-surface text-on-surface rounded border px-2 py-1"
        />
      </label>

      <button
        type="button"
        disabled={!motivo.trim() || liberar.isPending}
        onClick={() => liberar.mutate()}
        className="bg-accent-solid text-on-accent justify-self-start rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
      >
        {liberar.isPending ? 'Liberando…' : 'Liberar o caminhão'}
      </button>
    </div>
  );
}

function DetalheDoChecklist({ submissionId }: { submissionId: string }) {
  const detalhe = useQuery({
    queryKey: ['checklist-fill', submissionId],
    queryFn: () => getChecklistFill(submissionId),
  });

  /**
   * ⚠️ O endereço do anexo é pedido no clique, e nunca guardado.
   *
   * Ele vence em minutos, e é assim de propósito: uma URL permanente exigiria abrir
   * o bucket, o que deixaria foto de avaria e voz de funcionário acessíveis a quem
   * tivesse o link.
   */
  async function abrirAnexo(attachmentId: string) {
    try {
      const { url } = await getAnexoUrl(submissionId, attachmentId);
      window.open(url, '_blank', 'noopener');
    } catch (erro) {
      toast.error((erro as Error).message);
    }
  }

  return (
    <div className="border-outline-variant border-t p-3">
      <QueryState
        isPending={detalhe.isPending}
        isError={detalhe.isError}
        error={detalhe.error}
        label="o checklist"
      >
        {detalhe.data ? (
          <div className="grid gap-3">
            <p className="text-on-surface-muted text-label-md normal-case">
              {detalhe.data.modelo} · v{detalhe.data.versaoDoModelo}
            </p>

            <ul className="grid gap-1">
              {detalhe.data.respostas.map((r) => {
                const anexos = detalhe.data.anexos.filter((a) => a.itemId === r.itemId);
                const reprovado = r.status === 'nao_conforme';

                return (
                  <li
                    key={r.itemId}
                    className={cn(
                      'rounded px-2 py-1.5',
                      reprovado ? 'bg-error-soft' : 'bg-surface',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-on-surface">{r.label}</span>
                      {r.blocking ? <StatusChip tone="neutral">crítico</StatusChip> : null}
                      <StatusChip
                        tone={
                          r.status === 'conforme' ? 'positive' : reprovado ? 'critical' : 'neutral'
                        }
                        className="ml-auto"
                      >
                        {ROTULO_DO_STATUS[r.status]}
                      </StatusChip>
                    </div>

                    {r.note ? (
                      <p className="text-on-surface-variant text-body-md mt-1 normal-case">
                        {r.note}
                        {/*
                          ⚠️ Dizer que foi ditado não é enfeite: transcrição erra, e
                          erra mais no vocabulário de oficina. Quem lê precisa saber
                          se aquelas palavras foram escolhidas ou adivinhadas.
                        */}
                        {r.noteSource === 'dictated' ? (
                          <span className="text-on-surface-muted text-label-md"> (ditado)</span>
                        ) : null}
                      </p>
                    ) : null}

                    {anexos.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {anexos.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => void abrirAnexo(a.id)}
                            className="text-accent text-label-md underline normal-case"
                          >
                            {a.kind === 'photo' ? 'Ver foto' : 'Ouvir áudio'}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {detalhe.data.observacoes ? (
              <p className="text-on-surface-variant text-body-md normal-case">
                <strong>Observações gerais:</strong> {detalhe.data.observacoes}
              </p>
            ) : null}
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}
