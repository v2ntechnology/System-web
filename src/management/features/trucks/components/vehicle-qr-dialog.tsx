import { DownloadIcon, QrCodeIcon } from '@/components/icons';
import { generateVehicleQr, fetchVehicleQr } from '@/management/lib/fleet-api';
import { GlassModal, SpectrumButton, Spinner } from '@/management/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface VehicleQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  plate: string;
}

/**
 * QR operacional do caminhão.
 *
 * O adesivo contém um token revogável, nunca a placa. Por isso a rotação é
 * explícita: imprimir outro QR invalida o que já estiver afixado no veículo.
 */
export function VehicleQrDialog({ open, onOpenChange, vehicleId, plate }: VehicleQrDialogProps) {
  const queryClient = useQueryClient();
  const [confirmarRotacao, setConfirmarRotacao] = useState(false);

  const qrQuery = useQuery({
    queryKey: ['vehicle-qr', vehicleId],
    queryFn: () => fetchVehicleQr(vehicleId),
    enabled: open,
  });

  const mudarAbertura = (proximoAberto: boolean) => {
    if (!proximoAberto) setConfirmarRotacao(false);
    onOpenChange(proximoAberto);
  };

  const gerarQr = useMutation({
    mutationFn: () => generateVehicleQr(vehicleId),
    onSuccess: (qr) => {
      queryClient.setQueryData(['vehicle-qr', vehicleId], qr);
      setConfirmarRotacao(false);
      toast.success(
        qrQuery.data ? 'QR anterior invalidado. Imprima o novo adesivo.' : 'QR criado.',
      );
    },
    onError: () => toast.error('Não foi possível gerar o QR deste veículo.'),
  });

  const qr = qrQuery.data;
  const rotacionando = Boolean(qr);

  return (
    <GlassModal
      open={open}
      onOpenChange={mudarAbertura}
      title={`QR do ${plate}`}
      description="Adesivo para identificar o veículo no aplicativo do motorista."
      className="max-w-[480px]"
    >
      {qrQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="text-on-surface-muted size-6" label="Carregando QR do veículo" />
        </div>
      ) : qrQuery.isError ? (
        <p className="text-error text-body-md py-16 text-center">
          Não foi possível carregar o QR deste veículo.
        </p>
      ) : (
        <>
          <div data-print-root className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
            <div className="hidden print:block">
              <h1 className="font-sora text-on-surface text-headline-md">QR do veículo {plate}</h1>
              <p className="text-on-surface-variant text-body-md mt-1">
                Afixe este adesivo em local visível dentro da cabine.
              </p>
            </div>

            {qr ? (
              <div className="flex flex-col items-center py-3 text-center">
                <div className="border-outline-variant rounded-xl border bg-white p-4">
                  <QRCodeSVG value={qr.payload} size={224} level="M" includeMargin />
                </div>
                <p className="text-on-surface text-title-md mt-5 font-semibold">{qr.plate}</p>
                <p className="text-on-surface-muted text-body-sm mt-2 max-w-sm">
                  Se a câmera não ler o adesivo, informe este código no aplicativo.
                </p>
                <code className="text-on-surface text-body-md border-outline-variant mt-2 rounded-md border px-3 py-2 tracking-wider">
                  {qr.qrToken}
                </code>
              </div>
            ) : (
              <div className="text-on-surface-muted flex flex-col items-center py-12 text-center">
                <QrCodeIcon size={42} aria-hidden="true" />
                <p className="text-on-surface text-title-md mt-4 font-semibold">
                  Este veículo ainda não tem QR.
                </p>
                <p className="text-body-sm mt-2 max-w-sm">
                  Gere o adesivo para permitir a identificação pelo aplicativo do motorista.
                </p>
              </div>
            )}

            {confirmarRotacao ? (
              <div className="border-warning bg-warning/10 text-on-surface mt-3 rounded-lg border p-3 text-left">
                <p className="text-body-sm font-semibold">
                  O adesivo atual vai parar de funcionar.
                </p>
                <p className="text-body-sm mt-1">
                  Confirme somente quando puder imprimir e substituir o QR afixado.
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-outline-variant flex shrink-0 flex-wrap justify-end gap-3 border-t px-5 py-4 print:hidden sm:px-6">
            <SpectrumButton variant="danger" size="sm" onClick={() => mudarAbertura(false)}>
              Fechar
            </SpectrumButton>
            {qr ? (
              <SpectrumButton size="sm" variant="neutral" onClick={() => window.print()}>
                <DownloadIcon size={16} aria-hidden="true" />
                Imprimir adesivo
              </SpectrumButton>
            ) : null}
            {confirmarRotacao ? (
              <>
                <SpectrumButton
                  size="sm"
                  variant="neutral"
                  onClick={() => setConfirmarRotacao(false)}
                >
                  Cancelar
                </SpectrumButton>
                <SpectrumButton
                  size="sm"
                  onClick={() => gerarQr.mutate()}
                  disabled={gerarQr.isPending}
                >
                  {gerarQr.isPending ? 'Gerando...' : 'Confirmar rotação'}
                </SpectrumButton>
              </>
            ) : (
              <SpectrumButton
                size="sm"
                onClick={() => (rotacionando ? setConfirmarRotacao(true) : gerarQr.mutate())}
                disabled={gerarQr.isPending}
              >
                <QrCodeIcon size={16} aria-hidden="true" />
                {gerarQr.isPending ? 'Gerando...' : rotacionando ? 'Gerar novo QR' : 'Gerar QR'}
              </SpectrumButton>
            )}
          </div>
        </>
      )}
    </GlassModal>
  );
}
