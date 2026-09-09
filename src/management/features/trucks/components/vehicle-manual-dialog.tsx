import { DownloadIcon } from '@/components/icons';
import { GlassModal, SpectrumButton, Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { dateOnly, dateTime, km } from '@/management/lib/format';
import { fetchVehicleRegistry, type VehicleRegistry } from '@/management/lib/fleet-api';

export interface VehicleManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  plate: string;
}

/** Traço, e não vazio: a linha some do olho e a ficha impressa fica com buracos. */
const VAZIO = '–';

const texto = (valor: string | undefined) => (valor?.trim() ? valor : VAZIO);
const numeroCom = (valor: number | undefined, sufixo: string) =>
  valor == null ? VAZIO : `${km.format(valor)} ${sufixo}`;
const data = (valor: string | undefined) => (valor ? dateOnly.format(new Date(valor)) : VAZIO);

const ORIGEM: Record<VehicleRegistry['origin'], string> = {
  TELEMETRIA: 'Telemetria (com rastreador)',
  ROOKHUB: 'Cadastro manual (sem rastreador)',
};

interface Campo {
  label: string;
  value: string;
}

/**
 * As cinco seções do manual, na mesma ordem e com os mesmos rótulos do cadastro.
 *
 * ⚠️ Derivar daqui, e não escrever a ficha na mão em JSX: é o que faz o manual e
 * o arquivo baixado saírem sempre iguais. Campo novo no cadastro entra aqui uma
 * vez e aparece nos dois.
 */
function secoesDo(registro: VehicleRegistry): { titulo: string; campos: Campo[] }[] {
  return [
    {
      titulo: 'Identificação',
      campos: [
        { label: 'Placa', value: registro.plate },
        { label: 'Renavam', value: texto(registro.renavam) },
        { label: 'Chassi', value: texto(registro.vin) },
        { label: 'Número de frota', value: texto(registro.fleetNumber) },
        { label: 'Código interno', value: texto(registro.internalCode) },
        { label: 'Marca', value: texto(registro.manufacturer) },
        { label: 'Modelo', value: texto(registro.model) },
        { label: 'Ano de fabricação', value: registro.year ? String(registro.year) : VAZIO },
        { label: 'Ano do modelo', value: registro.modelYear ? String(registro.modelYear) : VAZIO },
        { label: 'Cor', value: texto(registro.color) },
        { label: 'Origem do cadastro', value: ORIGEM[registro.origin] },
      ],
    },
    {
      titulo: 'Especificação técnica',
      campos: [
        { label: 'Classificação', value: texto(registro.bodyClass) },
        { label: 'Carroceria', value: texto(registro.bodyType) },
        { label: 'Eixos', value: registro.axles == null ? VAZIO : String(registro.axles) },
        { label: 'Combustível', value: texto(registro.fuelType) },
        { label: 'Tara', value: numeroCom(registro.tareWeightKg, 'kg') },
        { label: 'Capacidade de carga', value: numeroCom(registro.payloadKg, 'kg') },
        { label: 'Volume de carga', value: numeroCom(registro.cargoVolumeM3, 'm³') },
        { label: 'Tanque', value: numeroCom(registro.tankCapacityL, 'litros') },
        { label: 'Consumo de referência', value: numeroCom(registro.referenceKmpl, 'km/l') },
      ],
    },
    {
      titulo: 'Documentação',
      campos: [
        { label: 'Licenciamento vence em', value: data(registro.licensingDueDate) },
        { label: 'Tacógrafo aferido até', value: data(registro.tachographDueDate) },
        { label: 'RNTRC', value: texto(registro.rntrc) },
      ],
    },
    {
      titulo: 'Propriedade',
      campos: [
        { label: 'Vínculo', value: texto(registro.ownership) },
        { label: 'Proprietário', value: texto(registro.ownerName) },
        { label: 'CPF ou CNPJ', value: texto(registro.ownerDocument) },
        { label: 'Forma de aquisição', value: texto(registro.acquisitionKind) },
        { label: 'Adquirido em', value: data(registro.acquiredAt) },
      ],
    },
    {
      titulo: 'Operação',
      campos: [
        { label: 'Na frota', value: registro.active ? 'Sim' : 'Não' },
        {
          label: 'Fora de operação',
          value: registro.outOfService
            ? [texto(registro.outOfServiceReason), data(registro.outOfServiceSince)]
                .filter((parte) => parte !== VAZIO)
                .join(' · ') || 'Sim'
            : 'Não',
        },
        { label: 'Próxima revisão (km)', value: numeroCom(registro.nextMaintenanceKm, 'km') },
        { label: 'Próxima revisão (data)', value: data(registro.nextMaintenanceDate) },
        { label: 'Observação da operação', value: texto(registro.manualNotes) },
      ],
    },
  ];
}

/**
 * Manual do veículo: a ficha inteira em LEITURA, e baixável.
 *
 * ⚠️ Substituiu o botão "Cadastro da operação" (decisão do usuário em
 * 08/09/2026). Aquele botão abria o formulário editável, que é o mesmo da rota
 * `/gestao/caminhoes/cadastro`: duas portas para a mesma edição, e nenhuma para
 * simplesmente **ler** ou levar a ficha para fora da tela.
 *
 * <h2>O download é a impressão do navegador</h2>
 *
 * "Baixar" chama `window.print()`, e o `@media print` do `globals.css` isola o
 * que tem `data-print-root`. O navegador oferece "Salvar como PDF", que é o
 * formato que a ficha pede: ela vai para o pátio, para a oficina e para o
 * seguro.
 *
 * A alternativa seria uma biblioteca de PDF, e ela custaria centenas de
 * kilobytes no bundle para produzir um documento pior do que o que o navegador
 * já compõe a partir do HTML.
 */
export function VehicleManualDialog({
  open,
  onOpenChange,
  vehicleId,
  plate,
}: VehicleManualDialogProps) {
  /* Mesma chave do formulário de cadastro: os dois dividem o cache, e abrir o
     manual depois de editar não vai ao servidor de novo. */
  const registro = useQuery({
    queryKey: ['vehicle-registry', vehicleId],
    queryFn: () => fetchVehicleRegistry(vehicleId),
    enabled: open,
  });

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Manual do ${plate}`}
      description="A ficha completa do veículo, como ela está no cadastro."
      /* Só a largura: o `GlassModal` já é coluna flex, sem padding e com
         `w-[calc(100vw-2rem)]`. */
      className="max-w-[760px]"
    >
      {registro.isPending ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="text-on-surface-muted size-6" label="Carregando o manual" />
        </div>
      ) : registro.isError || !registro.data ? (
        <p className="text-error text-body-md py-16 text-center">
          Não foi possível carregar o manual deste veículo.
        </p>
      ) : (
        <>
          {/* ⚠️ `data-print-root` é o que o `@media print` deixa visível. Sem
              ele a impressão sai com a tela inteira atrás do diálogo. */}
          <div data-print-root className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
            {/* Só no papel: na tela o título do diálogo já diz isto. */}
            <div className="hidden print:mb-6 print:block">
              <h1 className="font-sora text-on-surface text-headline-md">
                Manual do veículo {registro.data.plate}
              </h1>
              <p className="text-on-surface-variant text-body-md mt-1">
                Emitido em {dateTime.format(new Date())}
              </p>
            </div>

            {secoesDo(registro.data).map((secao, indice) => (
              <section key={secao.titulo} className={cn(indice > 0 && 'mt-6')}>
                <h3 className="text-on-surface text-body-md border-outline-variant border-b pb-2 font-semibold">
                  {secao.titulo}
                </h3>

                <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {secao.campos.map((campo) => (
                    <div key={campo.label} className="min-w-0">
                      <dt className="text-on-surface-muted text-label-md normal-case">
                        {campo.label}
                      </dt>
                      <dd className="text-on-surface text-body-md mt-0.5 break-words">
                        {campo.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            {registro.data.updatedAt ? (
              <p className="text-on-surface-muted text-label-md mt-6 normal-case">
                Cadastro atualizado em {dateTime.format(new Date(registro.data.updatedAt))}
                {registro.data.updatedByName ? ` por ${registro.data.updatedByName}` : ''}.
              </p>
            ) : null}
          </div>

          {/* Barra colada embaixo, como no diálogo de cadastro. `print:hidden`
              porque um botão impresso é tinta gasta. */}
          <div className="border-outline-variant flex shrink-0 justify-end gap-3 border-t px-5 py-4 print:hidden sm:px-6">
            <SpectrumButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </SpectrumButton>
            <SpectrumButton type="button" size="sm" onClick={() => window.print()}>
              <DownloadIcon size={16} aria-hidden="true" />
              Baixar
            </SpectrumButton>
          </div>
        </>
      )}
    </GlassModal>
  );
}
