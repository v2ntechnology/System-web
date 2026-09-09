import { DownloadIcon } from '@/components/icons';
import { GlassModal, SpectrumButton, Spinner, cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { dateOnly, dateTime } from '@/management/lib/format';
import { fetchDriverRegistryEntry, type DriverRegistry } from '@/management/lib/fleet-api';

export interface DriverLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  name: string;
}

/** Traço, e não vazio: a linha some do olho e a ficha impressa fica com buracos. */
const VAZIO = '–';

const texto = (valor: string | null | undefined) => (valor?.trim() ? valor : VAZIO);
const data = (valor: string | null | undefined) =>
  valor ? dateOnly.format(new Date(valor)) : VAZIO;
const sim = (valor: boolean) => (valor ? 'Sim' : 'Não');

interface Campo {
  label: string;
  value: string;
  /** Marca o campo cuja data já passou: vencido não é detalhe, é impedimento. */
  alerta?: boolean | undefined;
}

/** Já venceu? Data ausente não é vencimento, é ausência, e não acende alerta. */
function vencido(iso: string | null): boolean {
  return iso != null && new Date(iso).getTime() < Date.now();
}

/**
 * As seções da ficha, na mesma ordem e com os mesmos rótulos do cadastro.
 *
 * ⚠️ Derivar daqui, e não escrever a ficha na mão em JSX: é o que faz a tela e o
 * arquivo baixado saírem sempre iguais. Campo novo no cadastro entra aqui uma
 * vez e aparece nos dois.
 */
function secoesDo(registro: DriverRegistry): { titulo: string; campos: Campo[] }[] {
  const endereco = [
    [registro.addressStreet, registro.addressNumber].filter(Boolean).join(', '),
    registro.addressComplement,
    registro.addressDistrict,
    [registro.addressCity, registro.addressState].filter(Boolean).join(' - '),
    registro.addressZip,
  ]
    .filter((parte) => parte && parte.trim())
    .join(' · ');

  return [
    {
      titulo: 'Identificação',
      campos: [
        { label: 'Nome', value: registro.name },
        { label: 'CPF', value: texto(registro.document) },
        { label: 'RG', value: texto(registro.rg) },
        { label: 'Órgão emissor', value: texto(registro.rgIssuer) },
        { label: 'Nascimento', value: data(registro.birthDate) },
        { label: 'PIS', value: texto(registro.pis) },
      ],
    },
    {
      titulo: 'Habilitação',
      campos: [
        { label: 'Número da CNH', value: texto(registro.cnhNumber) },
        { label: 'Categoria', value: texto(registro.cnhCategory) },
        {
          label: 'Validade',
          value: data(registro.cnhExpiresAt),
          alerta: vencido(registro.cnhExpiresAt),
        },
        { label: 'Primeira habilitação', value: data(registro.cnhFirstLicensedAt) },
        /* EAR: sem a observação, dirigir profissionalmente é infração grave. */
        { label: 'Exerce atividade remunerada', value: sim(registro.cnhEar) },
        {
          label: 'MOPP vence em',
          value: data(registro.moppExpiresAt),
          alerta: vencido(registro.moppExpiresAt),
        },
        /* ⚠️ `license` é o identificador da telemetria, e não o documento: é por
           ele que a viagem casa com a pessoa. Fica na ficha porque é o que
           explica um motorista aparecer ou sumir dos trechos. */
        { label: 'Identificador no rastreador', value: texto(registro.license) },
      ],
    },
    {
      titulo: 'Aptidão',
      campos: [
        { label: 'Exame toxicológico', value: data(registro.toxicologyExamAt) },
        {
          /* ⚠️ Vencido impede dirigir C, D e E, e a empresa responde junto. */
          label: 'Toxicológico vence em',
          value: data(registro.toxicologyExpiresAt),
          alerta: vencido(registro.toxicologyExpiresAt),
        },
        {
          label: 'ASO vence em',
          value: data(registro.asoExpiresAt),
          alerta: vencido(registro.asoExpiresAt),
        },
      ],
    },
    {
      titulo: 'Contato e endereço',
      campos: [
        { label: 'Telefone', value: texto(registro.phone) },
        { label: 'E-mail', value: texto(registro.email) },
        { label: 'Contato de emergência', value: texto(registro.emergencyContactName) },
        { label: 'Telefone de emergência', value: texto(registro.emergencyContactPhone) },
        { label: 'Endereço', value: endereco || VAZIO },
      ],
    },
    {
      titulo: 'Vínculo',
      campos: [
        { label: 'Empresa', value: texto(registro.companyName) },
        { label: 'Matrícula', value: texto(registro.employeeNumber) },
        { label: 'Regime', value: texto(registro.employmentType) },
        { label: 'Admissão', value: data(registro.hiredAt) },
        { label: 'Desligamento', value: data(registro.dismissedAt) },
        { label: 'No quadro', value: sim(registro.active) },
        { label: 'Observação da operação', value: texto(registro.manualNotes) },
      ],
    },
  ];
}

/**
 * CNH e ficha do motorista: o cadastro inteiro em LEITURA, e baixável.
 *
 * Irmã do manual do veículo (`vehicle-manual-dialog`), e pelo mesmo motivo: o
 * produto tinha porta para EDITAR a ficha (a rota de cadastro) e nenhuma para
 * simplesmente lê-la ou levá-la para fora da tela. Quem abre a ficha de um
 * motorista quer conferir validade de CNH, toxicológico e ASO, e isso é leitura.
 *
 * <h2>O download é a impressão do navegador</h2>
 *
 * "Baixar" chama `window.print()`, e o `@media print` do `globals.css` isola o
 * que tem `data-print-root`. O navegador oferece "Salvar como PDF", que é o
 * formato que a ficha pede: ela vai para a fiscalização, para o RH e para o
 * embarcador.
 *
 * <h2>⚠️ O que a telemetria não sabe</h2>
 *
 * CPF, CNH, exames e admissão vêm do cadastro, e não do rastreador. Numa frota
 * que ainda não preencheu, esta ficha abre quase toda com traço, e é assim mesmo
 * que ela tem de abrir: traço é "ninguém preencheu", e inventar seria pior.
 */
export function DriverLicenseDialog({
  open,
  onOpenChange,
  driverId,
  name,
}: DriverLicenseDialogProps) {
  /* Mesma chave do formulário de cadastro: os dois dividem o cache, e abrir a
     ficha depois de editar não vai ao servidor de novo. */
  const registro = useQuery({
    queryKey: ['driver-registry', driverId],
    queryFn: () => fetchDriverRegistryEntry(driverId),
    enabled: open,
  });

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title={`CNH e ficha de ${name}`}
      description="O cadastro completo do motorista, como ele está no sistema."
      /* Só a largura: o `GlassModal` já é coluna flex, sem padding e com
         `w-[calc(100vw-2rem)]`. */
      className="max-w-[760px]"
    >
      {registro.isPending ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="text-on-surface-muted size-6" label="Carregando a ficha" />
        </div>
      ) : registro.isError || !registro.data ? (
        <p className="text-error text-body-md py-16 text-center">
          Não foi possível carregar a ficha deste motorista.
        </p>
      ) : (
        <>
          {/* ⚠️ `data-print-root` é o que o `@media print` deixa visível. Sem
              ele a impressão sai com a tela inteira atrás do diálogo. */}
          <div data-print-root className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
            {/* Só no papel: na tela o título do diálogo já diz isto. */}
            <div className="hidden print:mb-6 print:block">
              <h1 className="font-sora text-on-surface text-headline-md">
                Ficha do motorista {registro.data.name}
              </h1>
              <p className="text-on-surface-variant text-body-md mt-1">
                Emitida em {dateTime.format(new Date())}
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
                      <dd
                        className={cn(
                          'text-body-md mt-0.5 break-words',
                          /* Vencido em vermelho, com a palavra junto: cor
                             sozinha não é informação para quem não a enxerga. */
                          campo.alerta ? 'text-error font-medium' : 'text-on-surface',
                        )}
                      >
                        {campo.value}
                        {campo.alerta ? ' · vencido' : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            {registro.data.createdByOperation ? (
              <p className="text-on-surface-muted text-label-md mt-6 normal-case">
                Cadastro criado pela operação, e não pela telemetria.
              </p>
            ) : null}
          </div>

          {/* Barra colada embaixo, como no manual do veículo. `print:hidden`
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
