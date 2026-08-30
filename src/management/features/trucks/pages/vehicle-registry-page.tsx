import { CheckIcon, DeleteIcon, EditIcon, SearchIcon } from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import {
  deleteVehicle,
  fetchVehicleRegistryList,
  type VehicleListEntry,
} from '@/management/lib/fleet-api';
import {
  Alert,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  PAGE_SIZE,
  Pagination,
  SpectrumButton,
  StatusChip,
  cn,
} from '@/management/ui';

import { VehicleRegistryModal } from '../components/vehicle-registry-modal';

/**
 * Cadastro de frota: a lista que a plataforma mantém, e o trabalho de arrumá-la.
 *
 * Irmã da tela de cadastro de motoristas, de propósito: mesmo desenho, mesmo
 * gesto, mesmo tipo de conserto. Quem aprendeu a arrumar as pessoas já sabe
 * arrumar os caminhões.
 *
 * <h2>Por que a frota também precisa de uma tela assim</h2>
 *
 * O levantamento contra a API real da MiX, em 30/08/2026, achou 54 registros de
 * ativo para 40 caminhões de verdade:
 *
 *   * 13 placas existem em DUAS empresas ao mesmo tempo, sempre com o registro
 *     novo disponível e o velho indisponível, resto de transferência que ninguém
 *     limpou;
 *   * 2 ativos tinham o número de frota gravado no campo da placa, com a placa
 *     de verdade no campo de texto livre;
 *   * 1 caminhão foi recadastrado com duas letras da placa trocadas e virou dois
 *     caminhões, o que o odômetro contínuo desmentiu.
 *
 * <h2>Não há botão de cadastrar, e não é esquecimento</h2>
 *
 * ⚠️ Um caminhão só existe para a plataforma porque tem rastreador. Placa criada
 * à mão nunca reportaria posição e ficaria para sempre como "sem sinal" no mapa,
 * ao lado de caminhões de verdade que perderam sinal, sem ninguém conseguir
 * separar os dois casos. Esta tela corrige e confere o que chegou; ela não
 * inventa frota.
 *
 * <h2>Estado do fornecedor não é status daqui</h2>
 *
 * ⚠️ O estado do fornecedor e "fora de serviço" são colunas diferentes porque
 * são coisas diferentes. `Unavailable` na MiX quase sempre quer dizer "este é o
 * registro velho de uma transferência"; fora de serviço é decisão de quem opera.
 * Juntar os dois apagaria a distinção entre caminhão parado por decisão e
 * caminhão parado por cadastro.
 */

const ALL = 'TODAS';
const PENDING = 'PENDENTE';

/**
 * O estado do fornecedor, com o nome que a operação usa.
 *
 * A MiX escreve em inglês e o painel é em pt-BR. A tradução mora aqui, e não na
 * linha, para o filtro e a tabela dizerem a mesma palavra.
 */
const SUPPLIER_STATES: Record<string, string> = {
  Available: 'Disponível',
  Unavailable: 'Indisponível',
  'De-Installed': 'Rastreador removido',
};

const supplierLabel = (state: string): string => SUPPLIER_STATES[state] ?? state;

const SITUATION_OPTIONS = [
  { value: ALL, label: 'Todas as situações' },
  { value: 'OPERANDO', label: 'Em operação' },
  { value: 'FORA', label: 'Fora de serviço' },
  { value: 'SEM_SINAL', label: 'Sem sinal' },
];

const REVIEW_OPTIONS = [
  { value: ALL, label: 'Todos' },
  { value: PENDING, label: 'Falta conferir' },
  { value: 'CONFERIDOS', label: 'Já conferidos' },
];

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Acento e caixa fora do caminho: quem busca "volvo" precisa achar "VOLVO".
 *
 * O intervalo vai escrito como escape, e não com os caracteres literais:
 * sinais combinantes são invisíveis no editor, e um deles perdido numa cópia
 * deixaria a regex silenciosamente errada.
 */
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Sem sinal na janela coletada.
 *
 * ⚠️ Sete dias, e não trinta. A MiX só devolve histórico retroativo de sete dias
 * por token de sincronização, então uma janela maior classificaria de "sem
 * sinal" caminhão que a plataforma simplesmente ainda não teve tempo de ver.
 */
const SEM_SINAL_DIAS = 7;

const semSinal = (vehicle: VehicleListEntry): boolean => {
  if (!vehicle.lastSeenAt) return true;
  const dias = (Date.now() - new Date(vehicle.lastSeenAt).getTime()) / 86_400_000;
  return dias > SEM_SINAL_DIAS;
};

/**
 * "Não informado" não entra na composição do nome do veículo.
 *
 * ⚠️ O texto vem gravado assim NO BANCO, e não é nulo: a sincronização escreve
 * esse literal quando a MiX manda o campo vazio, o que acontece em 16 dos 40
 * ativos desta frota. Concatenar dava "Volkswagen Não informado", que lê como
 * defeito da tela quando o defeito é do cadastro. Sem o modelo, a marca sozinha
 * já diz mais.
 */
const AUSENTE = /^n[aã]o informad[oa]$/i;

const semRuido = (valor: string | null): string | null =>
  valor == null || AUSENTE.test(valor.trim()) ? null : valor;

const km = (valor: number | null): string =>
  valor == null ? '–' : `${Math.round(valor).toLocaleString('pt-BR')} km`;

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: 'critical' | 'attention' | 'positive' | undefined;
}) {
  return (
    <div className="metric-tile">
      <p className="text-on-surface-variant text-label-md normal-case">{label}</p>
      <p
        className={cn(
          'tabular font-sora mt-2 text-[28px] font-bold leading-none',
          tone === 'critical'
            ? 'text-error'
            : tone === 'attention'
              ? 'text-warning'
              : tone === 'positive'
                ? 'text-success'
                : 'text-on-surface',
        )}
      >
        {value}
      </p>
      <p className="text-on-surface-muted text-label-sm mt-1.5 normal-case">{hint}</p>
    </div>
  );
}

export function VehicleRegistryPage() {
  const queryClient = useQueryClient();

  /* Um estado só para o diálogo, como na tela de motoristas: com dois estados
     separados, fechar e reabrir deixava o identificador antigo de pé por um
     render e a ficha abria com o caminhão anterior. */
  const [dialog, setDialog] = useState<{ open: boolean; vehicle: VehicleListEntry | null }>({
    open: false,
    vehicle: null,
  });

  /** O veículo que espera confirmação para ser apagado. */
  const [deleting, setDeleting] = useState<VehicleListEntry | null>(null);

  const [search, setSearch] = useState('');
  const [situation, setSituation] = useState(ALL);
  const [review, setReview] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ['vehicle-registry-list'],
    queryFn: fetchVehicleRegistryList,
  });

  const vehicles = useMemo(() => data ?? [], [data]);

  const remove = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      toast.success(`${deleting?.plate ?? 'O veículo'} foi excluído.`);
      void queryClient.invalidateQueries({ queryKey: ['vehicle-registry-list'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDeleting(null);
    },
    onError: (erro) => {
      /* ⚠️ A mensagem do backend vai inteira para a tela. É ela que diz o que
         prende o registro (viagem, evento, posição) e sugere tirar de serviço em
         vez de excluir. "Não foi possível excluir" deixaria a pessoa tentando de
         novo sem entender. */
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível excluir o veículo.');
      setDeleting(null);
    },
  });

  /* Só empresa que tem caminhão: oferecer empresa vazia no filtro é oferecer um
     caminho que sempre devolve lista vazia. */
  const companyNames = useMemo(
    () =>
      [...new Set(vehicles.map((v) => v.companyName).filter((n): n is string => Boolean(n)))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [vehicles],
  );

  const counts = useMemo(
    () => ({
      total: vehicles.length,
      operando: vehicles.filter((v) => !v.outOfService && !semSinal(v)).length,
      fora: vehicles.filter((v) => v.outOfService).length,
      semSinal: vehicles.filter((v) => !v.outOfService && semSinal(v)).length,
      conferidos: vehicles.filter((v) => v.reviewed).length,
    }),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return vehicles.filter((vehicle) => {
      if (situation === 'FORA' && !vehicle.outOfService) return false;
      if (situation === 'SEM_SINAL' && (vehicle.outOfService || !semSinal(vehicle))) return false;
      if (situation === 'OPERANDO' && (vehicle.outOfService || semSinal(vehicle))) return false;

      if (review === PENDING && vehicle.reviewed) return false;
      if (review === 'CONFERIDOS' && !vehicle.reviewed) return false;
      if (company !== ALL && (vehicle.companyName ?? '') !== company) return false;
      if (!term) return true;

      /* Placa, número de frota e modelo ao mesmo tempo: o pátio chama o caminhão
         pelo número pintado na porta, a papelada chama pela placa, e quem está
         no painel muitas vezes só sabe o modelo. */
      return (
        normalize(vehicle.plate).includes(term) ||
        normalize(vehicle.internalCode ?? vehicle.fleetNumber ?? '').includes(term) ||
        normalize(
          `${semRuido(vehicle.manufacturer) ?? ''} ${semRuido(vehicle.model) ?? ''}`,
        ).includes(term)
      );
    });
  }, [vehicles, search, situation, review, company]);

  /* A página é presa ao total, e não guardada crua: filtrar de 40 para 3 estando
     na página 2 deixaria a tela vazia com a barra dizendo "31 a 40 de 3". */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const companyOptions = [
    { value: ALL, label: 'Todas as empresas' },
    ...companyNames.map((name) => ({ value: name, label: name })),
  ];

  const filtering = search.trim() !== '' || situation !== ALL || review !== ALL || company !== ALL;

  const limparFiltros = () => {
    setSearch('');
    setSituation(ALL);
    setReview(ALL);
    setCompany(ALL);
    setPage(1);
  };

  return (
    <>
      <PageBanner
        size="inline"
        title="Cadastro de frota"
        description="Cada caminhão que a plataforma conhece, em que empresa está e quem já foi conferido por uma pessoa."
      />

      <section className="w-full px-4 pb-24 sm:px-6 xl:px-10">
        <QueryState isPending={isPending} isError={isError} label="a frota">
          <div className="flex flex-col gap-5">
            {/* ---------------------------------------------------------- */}
            {/* O tamanho do trabalho                                       */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-5">
              <Tile label="Na frota" value={counts.total} hint="veículos que a plataforma tem" />
              <Tile
                label="Em operação"
                value={counts.operando}
                hint="reportaram posição na semana"
                tone="positive"
              />
              <Tile
                label="Fora de serviço"
                value={counts.fora}
                hint="parados por decisão da operação"
                tone={counts.fora > 0 ? 'attention' : undefined}
              />
              <Tile
                label="Sem sinal"
                value={counts.semSinal}
                hint="nenhuma posição há mais de 7 dias"
                tone={counts.semSinal > 0 ? 'critical' : undefined}
              />
              <Tile
                label="Conferidos"
                value={counts.conferidos}
                hint="ficha salva por uma pessoa"
              />
            </GlassCard>

            {/* ---------------------------------------------------------- */}
            {/* Filtros                                                     */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="flex flex-col gap-4 p-5">
              <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
                <GlassInput
                  label="Buscar"
                  placeholder="Placa, número de frota ou modelo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                />

                <GlassSelect
                  label="Empresa"
                  options={companyOptions}
                  value={company}
                  onValueChange={setCompany}
                />

                <GlassSelect
                  label="Situação"
                  options={SITUATION_OPTIONS}
                  value={situation}
                  onValueChange={setSituation}
                />

                <GlassSelect
                  label="Conferência"
                  options={REVIEW_OPTIONS}
                  value={review}
                  onValueChange={setReview}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-on-surface-muted text-label-md normal-case">
                  {filtered.length === vehicles.length
                    ? `${vehicles.length} veículos`
                    : `${filtered.length} de ${vehicles.length} veículos`}
                </p>

                {filtering ? (
                  <SpectrumButton type="button" variant="ghost" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </SpectrumButton>
                ) : null}
              </div>
            </GlassCard>

            {/* ---------------------------------------------------------- */}
            {/* A lista                                                     */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="p-5">
              {filtered.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-on-surface text-body-md font-medium">
                    {vehicles.length === 0
                      ? 'Nenhum veículo na frota.'
                      : 'Nenhum veículo com esses filtros.'}
                  </p>
                  <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                    {vehicles.length === 0
                      ? 'A frota chega pela telemetria: sincronize a integração para trazer os caminhões que já têm rastreador.'
                      : 'Limpe os filtros para ver a lista inteira.'}
                  </p>
                </div>
              ) : (
                /* Rola dentro do cartão, e não na página: a barra de rolagem é
                   invisível no sistema inteiro (19/08/2026), e uma tabela larga
                   que empurrasse a página não daria pista de que voltou. */
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="min-w-180 w-full border-collapse text-left">
                    <caption className="sr-only">Veículos cadastrados</caption>
                    <thead>
                      <tr className="border-outline-variant border-b">
                        {/* Largura em porcentagem somando 100: o navegador
                            distribui a sobra proporcionalmente e o espaçamento
                            fica regular em qualquer largura de tela. Deixar o
                            conteúdo mandar fazia o modelo mais longo engolir a
                            folga das vizinhas. */}
                        <Th className="w-[16%]" nowrap>
                          Placa
                        </Th>
                        <Th className="w-[26%]">Veículo</Th>
                        <Th className="w-[28%]">Empresa</Th>
                        {/* ⚠️ Não há coluna de motorista, e não é esquecimento. A
                            lotação que a MiX entrega é uma conta de sistema em
                            100% dos ativos desta frota, e as contas de sistema
                            foram apagadas: a coluna viria vazia nas 40 linhas. */}
                        <Th className="w-[14%]" hideOnMobile align="right">
                          Odômetro
                        </Th>
                        <Th className="w-[12%]">Situação</Th>
                        <Th className="w-[4%]" align="right">
                          Ações
                        </Th>
                      </tr>
                    </thead>

                    <tbody>
                      {visible.map((vehicle) => (
                        <VehicleRow
                          key={vehicle.id}
                          vehicle={vehicle}
                          onEdit={() => setDialog({ open: true, vehicle })}
                          onDelete={() => setDeleting(vehicle)}
                          busy={remove.isPending && deleting?.id === vehicle.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filtered.length > 0 ? (
                <Pagination
                  page={currentPage}
                  total={filtered.length}
                  onPageChange={setPage}
                  label="veículos"
                  className="border-outline-variant mt-5 border-t pt-5"
                />
              ) : null}
            </GlassCard>
          </div>
        </QueryState>
      </section>

      <VehicleRegistryModal
        open={dialog.open}
        onOpenChange={(open) => setDialog((atual) => ({ ...atual, open }))}
        vehicleId={dialog.vehicle?.id ?? null}
        plate={dialog.vehicle?.plate ?? null}
      />

      <ConfirmDelete
        vehicle={deleting}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => (deleting ? remove.mutate(deleting.id) : undefined)}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

function Th({
  children,
  align,
  hideOnMobile,
  nowrap,
  className,
}: {
  children: React.ReactNode;
  align?: 'right' | undefined;
  hideOnMobile?: boolean | undefined;
  /** Coluna que não quebra: a largura dela manda, e as outras absorvem a sobra. */
  nowrap?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'text-on-surface-variant text-label-md py-2.5 pr-4 font-medium normal-case',
        align === 'right' && 'text-right',
        hideOnMobile && 'hidden lg:table-cell',
        nowrap && 'whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  );
}

function VehicleRow({
  vehicle,
  onEdit,
  onDelete,
  busy,
}: {
  vehicle: VehicleListEntry;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const mudo = semSinal(vehicle);
  const numero = vehicle.internalCode ?? vehicle.fleetNumber;
  const modelo = [semRuido(vehicle.manufacturer), semRuido(vehicle.model)]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <tr
      /* A linha inteira abre a ficha. A guarda do `closest('button')` existe
         porque os botões de ação são filhos da linha: sem ela, clicar na lixeira
         abria o formulário por cima da confirmação. */
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) onEdit();
      }}
      className="border-outline-variant/60 hover:bg-on-surface/[0.04] cursor-pointer border-b transition-colors last:border-0"
    >
      <td className="py-3 pr-4 whitespace-nowrap">
        <p className="text-on-surface text-body-md tabular font-medium">{vehicle.plate}</p>
        {/* A segunda linha só existe quando tem o que dizer: uma linha em branco
            por baixo de 40 placas desalinha a lista inteira. */}
        {numero ? (
          <p className="text-on-surface-muted text-label-sm normal-case">frota {numero}</p>
        ) : null}
      </td>

      {/* `max-w-0` zera a largura mínima que célula de tabela herda do conteúdo:
          sem ele a coluna não respeita a porcentagem e incha com o texto mais
          longo da página. A rolagem no hover mantém o texto inteiro alcançável,
          ao contrário da reticência. */}
      <td className="max-w-0 py-3 pr-4">
        {modelo ? (
          <p className="text-on-surface text-body-sm overflow-x-auto overscroll-x-contain whitespace-nowrap">
            {modelo}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
          </p>
        ) : (
          <span className="text-on-surface-muted text-body-sm">–</span>
        )}
      </td>

      <td className="max-w-0 py-3 pr-4">
        {vehicle.companyName ? (
          <p className="text-on-surface text-body-sm overflow-x-auto overscroll-x-contain whitespace-nowrap">
            {vehicle.companyName}
          </p>
        ) : (
          <span className="text-on-surface-muted text-body-sm">–</span>
        )}
      </td>

      {/* `whitespace-nowrap`: "sem sinal" quebrava em duas linhas e esticava a
          altura da linha sozinho. */}
      <td className="hidden py-3 pr-4 text-right whitespace-nowrap lg:table-cell">
        <p className="text-on-surface text-body-sm tabular">{km(vehicle.odometerKm)}</p>
        <p className="text-on-surface-muted text-label-sm normal-case">
          {vehicle.lastSeenAt ? dataCurta.format(new Date(vehicle.lastSeenAt)) : 'sem sinal'}
        </p>
      </td>

      <td className="py-3 pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {vehicle.outOfService ? (
            <StatusChip tone="attention">Fora de serviço</StatusChip>
          ) : mudo ? (
            <StatusChip tone="critical">Sem sinal</StatusChip>
          ) : (
            <StatusChip tone="positive">Em operação</StatusChip>
          )}

          {/* Só aparece quando contradiz a coluna: o estado do fornecedor
              repetido em 40 linhas verdes seria ruído. `Unavailable` aqui quase
              sempre é resto de transferência, e é o que vale olhar. */}
          {vehicle.supplierState && vehicle.supplierState !== 'Available' ? (
            <StatusChip tone="neutral">{supplierLabel(vehicle.supplierState)}</StatusChip>
          ) : null}

          {vehicle.reviewed ? (
            <StatusChip tone="info">
              <CheckIcon size={11} aria-hidden="true" />
              Conferido
            </StatusChip>
          ) : null}
        </div>
      </td>

      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Editar cadastro"
            aria-label={`Editar cadastro do ${vehicle.plate}`}
            className="acao-editar rounded-lg p-1.5"
          >
            <EditIcon size={16} aria-hidden="true" />
          </button>

          {/*
           * Não há botão de ligar/desligar como na lista de motoristas: tirar de
           * serviço pede o motivo, e motivo se escreve no formulário. Um atalho
           * de um clique gravaria caminhão parado sem explicação, que é
           * exatamente o que a ficha existe para evitar.
           */}
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Excluir cadastro"
            aria-label={`Excluir cadastro do ${vehicle.plate}`}
            className="acao-excluir rounded-lg p-1.5"
          >
            <DeleteIcon size={16} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
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
function ConfirmDelete({
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
        <p className="text-on-surface text-body-md">
          Excluir <strong>{vehicle?.plate}</strong>? O cadastro é apagado e não tem como voltar.
        </p>

        <Alert severity="warning">
          Só dá para excluir o caminhão que não tem vínculo nenhum no sistema. Se este já tem
          viagem, evento de segurança ou posição registrada, o certo é marcar como{' '}
          <strong>fora de serviço</strong> na ficha: assim o histórico da frota continua respondendo
          por ele.
        </Alert>

        <div className="flex items-center justify-end gap-2">
          <SpectrumButton type="button" variant="ghost" onClick={onCancel} disabled={pending}>
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
