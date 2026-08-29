import { ClockCountdownIcon, PlayIcon, VideoIcon } from '@/components/icons';
import type { DriverWarning } from '@/management/types';
import { GlassModal, Spinner } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { getWarningMedia } from '../api';

const time = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Reprodução do clipe da advertência.
 *
 * RN-092 — o RookHub **não guarda vídeo**. Ao abrir, pedimos ao backend uma URL
 * assinada que aponta para o fornecedor, válida por no máximo 15 minutos
 * (RNF-022). Por isso a chamada acontece na abertura do diálogo, e não na
 * listagem: URL assinada em lista vaza acesso e expira antes do uso.
 */
export function WarningVideoDialog({
  warning,
  open,
  onOpenChange,
}: {
  warning: DriverWarning | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['warning-media', warning?.id],
    queryFn: () => getWarningMedia(warning!.id),
    enabled: open && Boolean(warning?.media),
  });

  if (!warning) return null;

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={warning.title}
      description={`${time.format(new Date(warning.at))}${warning.location ? ` · ${warning.location}` : ''}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="bg-surface-lowest ring-outline-variant relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg ring-1">
          {isPending ? (
            <span className="text-on-surface-muted flex flex-col items-center gap-3">
              <Spinner className="size-6" label="Solicitando o vídeo" />
              <span className="text-body-md">Solicitando acesso ao vídeo…</span>
            </span>
          ) : isError || !data ? (
            <p className="text-on-surface-variant text-body-md max-w-sm px-6 text-center">
              O fornecedor não disponibilizou a mídia deste evento. Os metadados abaixo continuam
              válidos.
            </p>
          ) : (
            /*
             * Placeholder do player: com o backend real, aqui entra um <video>
             * apontando para `data.signedUrl`. A moldura e os controles ficam
             * como estão.
             */
            <div className="flex flex-col items-center gap-3">
              <PlayIcon size={64} className="text-on-surface/70" aria-hidden="true" />
              <p className="text-on-surface-variant text-body-md">
                Clipe de {data.durationSeconds}s · {data.provider}
              </p>
              <p className="text-on-surface-muted text-label-md normal-case">
                Reprodução indisponível nesta versão de demonstração.
              </p>
            </div>
          )}
        </div>

        {data?.expiresAt ? (
          <p className="text-on-surface-muted text-label-md mt-3 flex items-center gap-1.5 normal-case">
            <ClockCountdownIcon size={14} aria-hidden="true" />
            Acesso ao vídeo expira às {time.format(new Date(data.expiresAt))} — o RookHub não
            armazena a mídia, apenas solicita ao fornecedor.
          </p>
        ) : null}

        <div className="border-outline-variant mt-5 border-t pt-5">
          <p className="text-on-surface text-body-md">{warning.description}</p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-on-surface-muted text-label-md normal-case">Aplicada por</dt>
              <dd className="text-on-surface text-body-md mt-0.5">{warning.issuedBy}</dd>
            </div>
            {warning.vehiclePlate ? (
              <div>
                <dt className="text-on-surface-muted text-label-md normal-case">Veículo</dt>
                <dd className="tabular text-on-surface text-body-md mt-0.5">
                  {warning.vehiclePlate}
                </dd>
              </div>
            ) : null}
            {warning.media ? (
              <div>
                <dt className="text-on-surface-muted text-label-md normal-case">Origem da mídia</dt>
                <dd className="text-on-surface text-body-md mt-0.5 flex items-center gap-1.5">
                  <VideoIcon size={16} aria-hidden="true" />
                  {warning.media.provider}
                </dd>
              </div>
            ) : null}
            {warning.contested ? (
              <div>
                <dt className="text-on-surface-muted text-label-md normal-case">Contestação</dt>
                <dd className="text-warning text-body-md mt-0.5">Em análise pelo gestor</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </GlassModal>
  );
}
