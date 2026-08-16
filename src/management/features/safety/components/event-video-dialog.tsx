import { ClockCountdownIcon, PlayCircleIcon } from '@phosphor-icons/react';
import type { SafetyEvent } from '@/management/types';
import { GlassModal, Spinner } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { getEventMedia } from '../api';

const time = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Clipe do evento.
 *
 * RN-092 — o RookHub não guarda mídia; pede ao fornecedor uma URL assinada com
 * validade de no máximo 15 min (RNF-022), e só na hora de assistir.
 */
export function EventVideoDialog({
  event,
  open,
  onOpenChange,
}: {
  event: SafetyEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /* O mock de mídia é indexado pelas advertências; nem todo evento tem clipe. */
  const mediaId =
    event?.id === 'evt-5512' ? 'warn-001' : event?.id === 'evt-5509' ? 'warn-002' : '';

  const { data, isPending, isError } = useQuery({
    queryKey: ['event-media', mediaId],
    queryFn: () => getEventMedia(mediaId),
    enabled: open && Boolean(mediaId),
  });

  if (!event) return null;

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={event.typeLabel}
      description={`${time.format(new Date(event.at))} · ${event.location}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="bg-surface-lowest ring-outline-variant flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg ring-1">
          {!mediaId ? (
            <p className="text-on-surface-variant text-body-md max-w-sm px-6 text-center">
              Este evento não tem câmera associada. Os dados de telemetria abaixo continuam válidos.
            </p>
          ) : isPending ? (
            <span className="text-on-surface-muted flex flex-col items-center gap-3">
              <Spinner className="size-6" label="Solicitando o vídeo" />
              <span className="text-body-md">Solicitando acesso ao vídeo…</span>
            </span>
          ) : isError || !data ? (
            <p className="text-on-surface-variant text-body-md max-w-sm px-6 text-center">
              O fornecedor não disponibilizou a mídia deste evento.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <PlayCircleIcon
                size={64}
                weight="fill"
                className="text-on-surface/70"
                aria-hidden="true"
              />
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
            Acesso expira às {time.format(new Date(data.expiresAt))} — o RookHub não armazena a
            mídia.
          </p>
        ) : null}

        <div className="border-outline-variant mt-5 border-t pt-5">
          <p className="text-on-surface text-body-md">{event.description}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-on-surface-muted text-label-md normal-case">Motorista</dt>
              <dd className="text-on-surface text-body-md mt-0.5">{event.driverName}</dd>
            </div>
            <div>
              <dt className="text-on-surface-muted text-label-md normal-case">Veículo</dt>
              <dd className="tabular text-on-surface text-body-md mt-0.5">{event.plate}</dd>
            </div>
          </dl>
        </div>
      </div>
    </GlassModal>
  );
}
