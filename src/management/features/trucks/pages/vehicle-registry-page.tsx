import {
  BadgeCheckIcon,
  BlockedIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  PlusIcon,
  PowerIcon,
  RadarIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
} from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { HERO_PILL, HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import {
  deleteVehicle,
  fetchVehicleRegistryList,
  setVehicleActive,
  type VehicleListEntry,
} from '@/management/lib/fleet-api';
import {
  GlassInput,
  GlassSelect,
  PAGE_SIZE,
  Pagination,
  SpectrumButton,
  StatusChip,
  cn,
} from '@/management/ui';

import { ConfirmDelete, ConfirmToggle } from '../components/vehicle-confirm-dialogs';
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

/**
 * ⚠️ Ativo e fora de serviço são eixos DIFERENTES, e o filtro precisa refletir
 * isso. Fora de serviço é o caminhão parado agora, com motivo, e ele volta.
 * Inativo é o que saiu da frota: vendido, devolvido, fim de contrato. Um
 * seletor só juntaria um caminhão vendido em 2024 com outro que entrou na
 * oficina ontem.
 */
const SITUATION_OPTIONS = [
  { value: ALL, label: 'Todas as situações' },
  { value: 'OPERANDO', label: 'Em operação' },
  { value: 'FORA', label: 'Fora de serviço' },
  { value: 'SEM_SINAL', label: 'Sem sinal' },
  { value: 'SEM_RASTREADOR', label: 'Sem rastreador' },
  { value: 'INATIVOS', label: 'Inativos' },
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

/**
 * Cadastrado a mão, e portanto sem rastreador.
 *
 * ⚠️ Precisa vir ANTES de "sem sinal" em toda classificação. Sem rastreador é
 * uma escolha de cadastro e não pede nada de ninguém; sem sinal é um problema
 * que leva alguém a ligar para a filial. Misturar os dois enche a lista de
 * problemas com caminhões que estão exatamente como deveriam estar.
 */
const semRastreador = (vehicle: VehicleListEntry): boolean => vehicle.origin === 'ROOKHUB';

const semSinal = (vehicle: VehicleListEntry): boolean => {
  if (semRastreador(vehicle)) return false;
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

export function VehicleRegistryPage() {
  const queryClient = useQueryClient();

  /* Um estado só para o diálogo, como na tela de motoristas: com dois estados
     separados, fechar e reabrir deixava o identificador antigo de pé por um
     render e a ficha abria com o caminhão anterior. */
  const [dialog, setDialog] = useState<{ open: boolean; vehicle: VehicleListEntry | null }>({
    open: false,
    vehicle: null,
  });

  /** O veículo que espera confirmação para ligar ou desligar. */
  const [confirming, setConfirming] = useState<VehicleListEntry | null>(null);

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

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setVehicleActive(id, active),
    onSuccess: (veiculo) => {
      toast.success(`${veiculo.plate} foi ${veiculo.active ? 'ativado' : 'inativado'}.`);
      void queryClient.invalidateQueries({ queryKey: ['vehicle-registry-list'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setConfirming(null);
    },
    onError: (erro) => {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível alterar o status.');
      setConfirming(null);
    },
  });

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
      /* Os números do topo falam da frota ATIVA: caminhão inativo saiu da
         frota, e contá-lo como "sem sinal" encheria o cartão vermelho de
         veículos que ninguém precisa procurar. */
      ativos: vehicles.filter((v) => v.active).length,
      inativos: vehicles.filter((v) => !v.active).length,
      operando: vehicles.filter((v) => v.active && !v.outOfService && !semSinal(v)).length,
      fora: vehicles.filter((v) => v.active && v.outOfService).length,
      semSinal: vehicles.filter((v) => v.active && !v.outOfService && semSinal(v)).length,
      conferidos: vehicles.filter((v) => v.reviewed).length,
    }),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return vehicles.filter((vehicle) => {
      if (situation === 'INATIVOS' && vehicle.active) return false;
      if (situation === 'FORA' && (!vehicle.active || !vehicle.outOfService)) return false;
      if (situation === 'SEM_RASTREADOR' && !semRastreador(vehicle)) return false;
      if (
        situation === 'SEM_SINAL' &&
        (!vehicle.active || vehicle.outOfService || !semSinal(vehicle))
      ) {
        return false;
      }
      if (
        situation === 'OPERANDO' &&
        (!vehicle.active || vehicle.outOfService || semSinal(vehicle))
      ) {
        return false;
      }

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

  /* Os filtros não podem virar um estado escondido. Além de mostrar por que a
     lista encolheu, cada atalho desfaz só a escolha correspondente — sem fazer
     a pessoa reconstruir uma busca que já estava boa. */
  const filtrosAtivos = [
    search.trim()
      ? { key: 'busca', label: `Busca: ${search.trim()}`, onRemove: () => setSearch('') }
      : null,
    company !== ALL ? { key: 'empresa', label: company, onRemove: () => setCompany(ALL) } : null,
    situation !== ALL
      ? {
          key: 'situacao',
          label: SITUATION_OPTIONS.find((option) => option.value === situation)?.label ?? situation,
          onRemove: () => setSituation(ALL),
        }
      : null,
    review !== ALL
      ? {
          key: 'conferencia',
          label: REVIEW_OPTIONS.find((option) => option.value === review)?.label ?? review,
          onRemove: () => setReview(ALL),
        }
      : null,
  ].filter(
    (filter): filter is { key: string; label: string; onRemove: () => void } => filter != null,
  );

  const stats: HeroStat[] = [
    {
      key: 'frota',
      label: 'Na frota',
      value: counts.ativos,
      hint:
        counts.inativos === 0
          ? 'veículos ativos'
          : counts.inativos === 1
            ? 'ativos, mais 1 inativo'
            : `ativos, mais ${counts.inativos} inativos`,
      icon: TruckIcon,
    },
    {
      key: 'operando',
      label: 'Em operação',
      value: counts.operando,
      hint: 'reportaram posição na semana',
      icon: RouteIcon,
    },
    {
      key: 'fora',
      label: 'Fora de serviço',
      value: counts.fora,
      hint: 'parados por decisão da operação',
      icon: BlockedIcon,
      tone: counts.fora > 0 ? 'warn' : 'neutral',
    },
    {
      key: 'sem-sinal',
      label: 'Sem sinal',
      value: counts.semSinal,
      hint: 'nenhuma posição há mais de 7 dias',
      icon: RadarIcon,
      tone: counts.semSinal > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'conferidos',
      label: 'Conferidos',
      value: counts.conferidos,
      hint: 'ficha salva por uma pessoa',
      icon: BadgeCheckIcon,
    },
  ];

  return (
    <>
      <HeroBand
        title="Cadastro de frota"
        description="Cada caminhão que a plataforma conhece, em que empresa está e quem já foi conferido por uma pessoa."
      >
        <button
          type="button"
          onClick={() => setDialog({ open: true, vehicle: null })}
          className={`${HERO_PILL} text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2`}
        >
          <PlusIcon size={16} aria-hidden="true" />
          Cadastrar caminhão
        </button>
      </HeroBand>

      {/*
       * ⚠️ Painel branco, como nas demais rotas do painel (08/09/2026). A tela
       * abria dois `GlassCard` empilhados sobre o papel, filtros num e lista
       * noutro: duas molduras para um assunto só, e nenhuma das outras telas se
       * parecia com isso.
       *
       * Os dois viraram um bloco só aqui dentro, separados por espaço e por uma
       * divisória, que é o que o painel já usa para separar sem empilhar caixa.
       */}
      <PageContent className="rounded-t-4xl bg-light -mt-16 pt-8 sm:-mt-20 sm:rounded-t-[40px]">
        <h2 className="sr-only">O tamanho do cadastro</h2>

        <QueryState isPending={isPending} isError={isError} label="a frota">
          <HeroStats items={stats} className="mb-6" />
        </QueryState>

        <QueryState isPending={isPending} isError={isError} label="a frota">
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <h2 className="text-on-light text-body-md font-semibold">Localize um veículo</h2>
                  <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                    Consulte a ficha ou encontre pendências antes de editar.
                  </p>
                </div>
                <p className="text-on-light-muted text-label-md normal-case" aria-live="polite">
                  {filtered.length === vehicles.length
                    ? `${vehicles.length} veículos no cadastro`
                    : `${filtered.length} de ${vehicles.length} veículos`}
                </p>
              </div>

              <div className="bg-on-light/[0.025] grid gap-3 rounded-xl p-3 sm:p-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
                <GlassInput
                  surface="light"
                  label="Buscar"
                  placeholder="Placa, número de frota ou modelo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  leading={<SearchIcon size={16} aria-hidden="true" />}
                />

                <GlassSelect
                  surface="light"
                  label="Empresa"
                  options={companyOptions}
                  value={company}
                  onValueChange={setCompany}
                />

                <GlassSelect
                  surface="light"
                  label="Situação"
                  options={SITUATION_OPTIONS}
                  value={situation}
                  onValueChange={setSituation}
                />

                <GlassSelect
                  surface="light"
                  label="Conferência"
                  options={REVIEW_OPTIONS}
                  value={review}
                  onValueChange={setReview}
                />
              </div>

              {filtering ? (
                <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
                  <span className="text-on-light-muted text-label-md mr-1 normal-case">
                    Filtros ativos:
                  </span>
                  {filtrosAtivos.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={filter.onRemove}
                      className="bg-on-light/8 text-on-light-variant hover:bg-on-light/12 hover:text-on-light focus-visible:ring-primary rounded-full px-3 py-1.5 text-xs font-medium normal-case transition-colors focus-visible:outline-none focus-visible:ring-2"
                      title={`Remover filtro: ${filter.label}`}
                    >
                      {filter.label} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <SpectrumButton type="button" variant="ghost" size="sm" onClick={limparFiltros}>
                    Limpar tudo
                  </SpectrumButton>
                </div>
              ) : null}
            </div>

            {/* ---------------------------------------------------------- */}
            {/* A lista                                                     */}
            {/* ---------------------------------------------------------- */}
            <div className="border-light-outline mt-6 border-t pt-6">
              {filtered.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-on-light text-body-md font-medium">
                    {vehicles.length === 0
                      ? 'Nenhum veículo na frota.'
                      : 'Nenhum veículo com esses filtros.'}
                  </p>
                  <p className="text-on-light-muted text-label-md mt-1 normal-case">
                    {vehicles.length === 0
                      ? 'Use "Cadastrar caminhão" para começar, ou sincronize a telemetria para trazer quem já tem rastreador.'
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
                      <tr className="border-light-outline border-b">
                        {/* Largura em porcentagem somando 100: o navegador
                            distribui a sobra proporcionalmente e o espaçamento
                            fica regular em qualquer largura de tela. Deixar o
                            conteúdo mandar fazia o modelo mais longo engolir a
                            folga das vizinhas. */}
                        <Th className="w-[16%]" nowrap>
                          Placa
                        </Th>
                        <Th className="w-[24%]">Veículo</Th>
                        <Th className="w-[28%]">Empresa</Th>
                        {/* ⚠️ Não há coluna de motorista, e não é esquecimento. A
                            lotação que a MiX entrega é uma conta de sistema em
                            100% dos ativos desta frota, e as contas de sistema
                            foram apagadas: a coluna viria vazia nas 40 linhas. */}
                        <Th className="w-[14%]" hideOnMobile align="right">
                          Odômetro
                        </Th>
                        <Th className="w-[12%]">Situação</Th>
                        <Th className="w-[6%]" align="right">
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
                          onToggle={() => setConfirming(vehicle)}
                          onDelete={() => setDeleting(vehicle)}
                          busy={
                            (toggle.isPending && confirming?.id === vehicle.id) ||
                            (remove.isPending && deleting?.id === vehicle.id)
                          }
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
                  className="border-light-outline mt-5 border-t pt-5"
                />
              ) : null}
            </div>
          </>
        </QueryState>
      </PageContent>

      <VehicleRegistryModal
        open={dialog.open}
        onOpenChange={(open) => setDialog((atual) => ({ ...atual, open }))}
        vehicleId={dialog.vehicle?.id ?? null}
        plate={dialog.vehicle?.plate ?? null}
      />

      <ConfirmToggle
        vehicle={confirming}
        pending={toggle.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          confirming ? toggle.mutate({ id: confirming.id, active: !confirming.active }) : undefined
        }
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
        'text-on-light-variant text-label-md py-2.5 pr-4 font-medium normal-case',
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
  onToggle,
  onDelete,
  busy,
}: {
  vehicle: VehicleListEntry;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const mudo = semSinal(vehicle);
  const semRastro = semRastreador(vehicle);
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
      className={cn(
        'border-light-outline/60 hover:bg-on-light/[0.04] cursor-pointer border-b transition-colors last:border-0',
        /* Inativo sai da frota, e a linha precisa dizer isso antes de qualquer
           chip: numa lista longa, a cor cheia dá o mesmo peso a um caminhão
           vendido e a um que está rodando agora. */
        !vehicle.active && 'opacity-55',
      )}
    >
      <td className="py-3 pr-4 whitespace-nowrap">
        <p className="text-on-light text-body-md tabular font-medium">{vehicle.plate}</p>
        {/* A segunda linha só existe quando tem o que dizer: uma linha em branco
            por baixo de 40 placas desalinha a lista inteira. */}
        {numero ? (
          <p className="text-on-light-muted text-label-sm normal-case">frota {numero}</p>
        ) : null}
      </td>

      {/* `max-w-0` zera a largura mínima que célula de tabela herda do conteúdo:
          sem ele a coluna não respeita a porcentagem e incha com o texto mais
          longo da página. A rolagem no hover mantém o texto inteiro alcançável,
          ao contrário da reticência. */}
      <td className="max-w-0 py-3 pr-4">
        {modelo ? (
          <p className="text-on-light text-body-sm overflow-x-auto overscroll-x-contain whitespace-nowrap">
            {modelo}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
          </p>
        ) : (
          <span className="text-on-light-muted text-body-sm">–</span>
        )}
      </td>

      <td className="max-w-0 py-3 pr-4">
        {vehicle.companyName ? (
          <p className="text-on-light text-body-sm overflow-x-auto overscroll-x-contain whitespace-nowrap">
            {vehicle.companyName}
          </p>
        ) : (
          <span className="text-on-light-muted text-body-sm">–</span>
        )}
      </td>

      {/* `whitespace-nowrap`: "sem sinal" quebrava em duas linhas e esticava a
          altura da linha sozinho. */}
      <td className="hidden py-3 pr-4 text-right whitespace-nowrap lg:table-cell">
        <p className="text-on-light text-body-sm tabular">{km(vehicle.odometerKm)}</p>
        <p className="text-on-light-muted text-label-sm normal-case">
          {vehicle.lastSeenAt ? dataCurta.format(new Date(vehicle.lastSeenAt)) : 'sem sinal'}
        </p>
      </td>

      <td className="py-3 pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* ⚠️ Inativo vem PRIMEIRO e cala o resto. Um caminhão que saiu da
              frota não está "sem sinal": ele está fora, e dizer as duas coisas
              manda alguém procurar um rastreador que não deveria reportar. */}
          {!vehicle.active ? (
            <StatusChip tone="neutral">Inativo</StatusChip>
          ) : vehicle.outOfService ? (
            <StatusChip tone="attention">Fora de serviço</StatusChip>
          ) : semRastro ? (
            <StatusChip tone="info">Sem rastreador</StatusChip>
          ) : mudo ? (
            <StatusChip tone="critical">Sem sinal</StatusChip>
          ) : (
            <StatusChip tone="positive">Em operação</StatusChip>
          )}

          {/* Só aparece quando contradiz a coluna: o estado do fornecedor
              repetido em 40 linhas verdes seria ruído. `Unavailable` aqui quase
              sempre é resto de transferência, e é o que vale olhar. */}
          {vehicle.active &&
          !semRastro &&
          vehicle.supplierState &&
          vehicle.supplierState !== 'Available' ? (
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
          {/*
           * Alternar antes de editar, como na lista de motoristas.
           *
           * ⚠️ O botão já NASCE na cor do que vai fazer: vermelho quando vai
           * tirar da frota, verde quando vai devolver. A cor é o rótulo, porque
           * o botão não tem texto, e numa lista longa descobrir pelo hover é
           * descobrir tarde.
           */}
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title={vehicle.active ? 'Inativar veículo' : 'Ativar veículo'}
            aria-label={vehicle.active ? `Inativar ${vehicle.plate}` : `Ativar ${vehicle.plate}`}
            className={cn('rounded-lg p-1.5', vehicle.active ? 'acao-excluir' : 'acao-ativar')}
          >
            <PowerIcon size={16} aria-hidden="true" />
          </button>

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
