import {
  CheckIcon,
  DeleteIcon,
  EditIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
} from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import {
  deleteDriver,
  fetchDriverRegistry,
  setDriverActive,
  type DriverListEntry,
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
  type StatusTone,
} from '@/management/ui';

import { DriverAvatar } from '../components/driver-avatar';
import { DriverRegistrationModal } from '../components/driver-registration-modal';
import { formatCpf } from '../registration-schema';

/**
 * Cadastro de motoristas: a lista que a plataforma mantém, e o trabalho de
 * arrumá-la.
 *
 * <h2>Quem é dono do cadastro</h2>
 *
 * Decisão do usuário em 30/08/2026, e é o ponto do produto. O RookHub é
 * integrador: várias fontes externas desaguam aqui, e nenhuma delas é fonte de
 * verdade sozinha. O cadastro do fornecedor de telemetria é o ponto de partida,
 * porque foi o levantamento contra a API real que mostrou o tamanho do estrago:
 *
 *   * 54 registros de veículo para 40 caminhões, com 13 placas em duas empresas
 *     ao mesmo tempo por transferência que ninguém limpou;
 *   * 150 motoristas, 18 dos quais não são pessoas;
 *   * 47 arquivados em filiais que o cliente batizou de DESLIGADOS / INATIVOS,
 *     alguns deles rodando.
 *
 * A partir daqui, quem responde quem é motorista e se ele está ativo é esta
 * tela. Salvar uma ficha congela aquele motorista para a sincronização, e é o
 * que faz a correção durar mais que uma hora.
 *
 * <h2>Empresa, e não filial</h2>
 *
 * A MiX organiza a SERVIOESTE em 5 empresas e 15 subgrupos, e os subgrupos não
 * descrevem operação nenhuma: são o nome da cidade, o "Default Site" onde a MiX
 * joga o que ninguém classificou, e o arquivo morto do cliente. Quatro se
 * chamam "Default Site" e cinco se chamam "DESLIGADOS / INATIVOS". A tela
 * mostra a empresa, e quem está em qualquer subgrupo dela conta como sendo
 * dela.
 */

const SITUATIONS: Record<DriverListEntry['situation'], { label: string; tone: StatusTone }> = {
  ATIVO: { label: 'Rodando', tone: 'positive' },
  PARADO: { label: 'Parado', tone: 'attention' },
  NAO_E_PESSOA: { label: 'Não é pessoa', tone: 'neutral' },
};

const ALL = 'TODAS';
const CONFLICT = 'CONFLITO';
const PENDING = 'PENDENTE';

/**
 * O conflito tem filtro próprio.
 *
 * ⚠️ "Inativo" e "rodou nos últimos 30 dias" não se excluem, e quem está nos
 * dois é o caso que precisa de alguém olhando: a importação desligou a pessoa
 * porque o fornecedor a guardou no arquivo morto, e mesmo assim ela apareceu
 * dirigindo. Uma classificação única esconderia exatamente esse caso.
 */
const STATUS_OPTIONS = [
  { value: ALL, label: 'Todos os status' },
  { value: 'ATIVOS', label: 'Ativos' },
  { value: 'INATIVOS', label: 'Inativos' },
  { value: CONFLICT, label: 'Inativos, mas rodando' },
];

/* Rótulos curtos de propósito: o seletor divide a linha com outros três e o
   botão de cadastrar. "Conferidos e não conferidos" truncava no meio e passava
   por baixo do botão. */
const REVIEW_OPTIONS = [
  { value: ALL, label: 'Todos' },
  { value: PENDING, label: 'Falta conferir' },
  { value: 'CONFERIDOS', label: 'Já conferidos' },
];

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Acento e caixa fora do caminho: quem busca "jose" precisa achar "JOSÉ".
 *
 * O intervalo vai escrito como escape, e não com os caracteres literais: sinais
 * combinantes são invisíveis no editor, e um deles perdido numa cópia deixaria
 * a regex silenciosamente errada.
 */
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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

export function DriverRegistryPage() {
  const queryClient = useQueryClient();

  /**
   * Um estado só para o diálogo, em vez de um booleano mais um identificador.
   *
   * ⚠️ Com dois estados separados, fechar o diálogo de edição e abrir o de
   * cadastro em seguida deixava o identificador antigo de pé por um render, e o
   * formulário de "novo motorista" abria preenchido com a pessoa anterior.
   * Aqui os dois valores mudam juntos, e o estado impossível não existe.
   */
  const [dialog, setDialog] = useState<{ open: boolean; driverId: string | null }>({
    open: false,
    driverId: null,
  });

  /** O motorista que espera confirmação para ligar ou desligar. */
  const [confirming, setConfirming] = useState<DriverListEntry | null>(null);

  /** O motorista que espera confirmação para ser apagado. */
  const [deleting, setDeleting] = useState<DriverListEntry | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [review, setReview] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ['driver-registry'],
    queryFn: fetchDriverRegistry,
  });

  const drivers = useMemo(() => data ?? [], [data]);

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setDriverActive(id, active),
    onSuccess: (driver) => {
      toast.success(`${driver.name} foi ${driver.active ? 'ativado' : 'inativado'}.`);
      void queryClient.invalidateQueries({ queryKey: ['driver-registry'] });
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      setConfirming(null);
    },
    onError: (erro) => {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível alterar o status.');
      setConfirming(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDriver(id),
    onSuccess: () => {
      toast.success(`${deleting?.name ?? 'O motorista'} foi excluído.`);
      void queryClient.invalidateQueries({ queryKey: ['driver-registry'] });
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      setDeleting(null);
    },
    onError: (erro) => {
      /* ⚠️ A mensagem do backend vai inteira para a tela, e não é trocada por um
         texto genérico: é ela que diz **o que** prende o cadastro (viagem,
         evento, caminhão) e sugere inativar. "Não foi possível excluir" deixaria
         a pessoa tentando de novo sem entender. */
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível excluir o motorista.');
      setDeleting(null);
    },
  });

  /**
   * As empresas do filtro saem da própria lista, e não do endpoint de empresas.
   *
   * Só interessa a empresa que tem alguém: oferecer empresa vazia no filtro é
   * oferecer um caminho que sempre devolve lista vazia.
   */
  const companyNames = useMemo(
    () =>
      [...new Set(drivers.map((d) => d.companyName).filter((n): n is string => Boolean(n)))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [drivers],
  );

  const counts = useMemo(
    () => ({
      total: drivers.length,
      ativos: drivers.filter((d) => d.active).length,
      inativos: drivers.filter((d) => !d.active).length,
      conflito: drivers.filter((d) => !d.active && d.situation === 'ATIVO').length,
      conferidos: drivers.filter((d) => d.reviewed).length,
      semCpf: drivers.filter((d) => !d.document && d.situation !== 'NAO_E_PESSOA').length,
    }),
    [drivers],
  );

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return drivers.filter((driver) => {
      if (status === CONFLICT) {
        if (driver.active || driver.situation !== 'ATIVO') return false;
      } else if (status === 'ATIVOS') {
        if (!driver.active) return false;
      } else if (status === 'INATIVOS') {
        if (driver.active) return false;
      }

      if (review === PENDING && driver.reviewed) return false;
      if (review === 'CONFERIDOS' && !driver.reviewed) return false;
      if (company !== ALL && (driver.companyName ?? '') !== company) return false;
      if (!term) return true;

      /* Busca por nome, CPF e matrícula ao mesmo tempo: quem procura alguém tem
         um dos três na mão, e não sabe qual a tela espera.

         ⚠️ O trecho de CPF só entra quando o termo tem dígito. Sem essa guarda,
         buscar "sebastiao" reduz a string de dígitos a vazio, e `includes('')`
         é verdadeiro para qualquer texto: o filtro devolvia a lista inteira e
         parecia não funcionar. */
      const digits = term.replace(/\D/g, '');

      return (
        normalize(driver.name).includes(term) ||
        (digits !== '' && (driver.document ?? '').includes(digits)) ||
        normalize(driver.employeeNumber ?? '').includes(term)
      );
    });
  }, [drivers, search, status, review, company]);

  /**
   * A fatia que aparece na tela.
   *
   * ⚠️ A página é fixada dentro do total, e não guardada crua. Filtrar de 132
   * para 3 registros estando na página 5 deixaria a tela vazia com a barra
   * dizendo "121 a 132 de 3": em vez de zerar a página a cada filtro, o que
   * perderia o lugar de quem só mudou de aba, o valor é preso ao último válido.
   */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const companyOptions = [
    { value: ALL, label: 'Todas as empresas' },
    ...companyNames.map((name) => ({ value: name, label: name })),
  ];

  const filtering = search.trim() !== '' || status !== ALL || review !== ALL || company !== ALL;

  const limparFiltros = () => {
    setSearch('');
    setStatus(ALL);
    setReview(ALL);
    setCompany(ALL);
    setPage(1);
  };

  return (
    <>
      <PageBanner
        size="inline"
        title="Cadastro de motoristas"
        description="Quem a plataforma conhece como motorista, em que empresa está e quem já foi conferido por uma pessoa."
      />

      <section className="w-full px-4 pb-24 sm:px-6 xl:px-10">
        <QueryState isPending={isPending} isError={isError} label="os motoristas">
          <div className="flex flex-col gap-5">
            {/* ---------------------------------------------------------- */}
            {/* O tamanho do trabalho                                       */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-5">
              <Tile
                label="No cadastro"
                value={counts.total}
                hint="motoristas que a plataforma tem"
              />
              <Tile
                label="Ativos"
                value={counts.ativos}
                hint="disponíveis para escala"
                tone="positive"
              />
              <Tile
                label="Inativos"
                value={counts.inativos}
                hint={
                  counts.conflito === 0
                    ? 'nenhum deles rodou'
                    : counts.conflito === 1
                      ? '1 deles rodou mesmo assim'
                      : `${counts.conflito} deles rodaram mesmo assim`
                }
                tone={counts.conflito > 0 ? 'critical' : undefined}
              />
              <Tile
                label="Conferidos"
                value={counts.conferidos}
                hint="ficha salva por uma pessoa"
              />
              <Tile
                label="Sem CPF"
                value={counts.semCpf}
                hint="não dá para cruzar com outro sistema"
                tone={counts.semCpf > 0 ? 'attention' : undefined}
              />
            </GlassCard>

            {/* ---------------------------------------------------------- */}
            {/* Filtros e ação                                              */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="flex flex-col gap-4 p-5">
              <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
                <GlassInput
                  label="Buscar"
                  placeholder="Nome, CPF ou matrícula"
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
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onValueChange={setStatus}
                />

                <GlassSelect
                  label="Conferência"
                  options={REVIEW_OPTIONS}
                  value={review}
                  onValueChange={setReview}
                />

                <SpectrumButton
                  type="button"
                  onClick={() => setDialog({ open: true, driverId: null })}
                >
                  <PlusIcon size={16} aria-hidden="true" />
                  Cadastrar motorista
                </SpectrumButton>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-on-surface-muted text-label-md normal-case">
                  {filtered.length === drivers.length
                    ? `${drivers.length} motoristas`
                    : `${filtered.length} de ${drivers.length} motoristas`}
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
                    {drivers.length === 0
                      ? 'Nenhum motorista cadastrado.'
                      : 'Nenhum motorista com esses filtros.'}
                  </p>
                  <p className="text-on-surface-muted text-label-md mt-1 normal-case">
                    {drivers.length === 0
                      ? 'Use "Cadastrar motorista" para começar, ou sincronize a telemetria para trazer quem já existe no fornecedor.'
                      : 'Limpe os filtros para ver a lista inteira.'}
                  </p>
                </div>
              ) : (
                /* Rola dentro do cartão, e não na página: a barra de rolagem é
                   invisível no sistema inteiro (19/08/2026), e uma tabela larga
                   que empurrasse a página inteira para o lado não daria pista
                   nenhuma de que voltou para a esquerda. */
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="min-w-180 w-full border-collapse text-left">
                    <caption className="sr-only">Motoristas cadastrados</caption>
                    <thead>
                      <tr className="border-outline-variant border-b">
                        {/*
                         * ⚠️ Largura em porcentagem, e não conteúdo mandando.
                         *
                         * Antes só o nome tinha largura declarada (`w-full`) e
                         * ele engolia toda a folga: os cinco campos do meio
                         * espremiam-se à direita, com um vazio de uns 400px
                         * entre o nome e o CPF. Como as porcentagens somam 100,
                         * o navegador distribui a sobra proporcionalmente e o
                         * espaçamento entre colunas fica regular em qualquer
                         * largura de tela, que é o que o usuário pediu em
                         * 30/08/2026.
                         *
                         * Motorista e Ações continuam ancorados nas pontas: o
                         * primeiro leva a foto, o último leva os botões.
                         */}
                        <Th className="w-[30%]">Motorista</Th>
                        <Th className="w-[12%]" nowrap>
                          CPF
                        </Th>
                        <Th className="w-[24%]">Empresa</Th>
                        <Th className="w-[8%]" hideOnMobile>
                          CNH
                        </Th>
                        <Th className="w-[12%]" hideOnMobile align="right">
                          Atividade
                        </Th>
                        <Th className="w-[10%]">Status</Th>
                        <Th className="w-[4%]" align="right">
                          Ações
                        </Th>
                      </tr>
                    </thead>

                    <tbody>
                      {visible.map((driver) => (
                        <DriverRow
                          key={driver.id}
                          driver={driver}
                          onEdit={() => setDialog({ open: true, driverId: driver.id })}
                          onToggle={() => setConfirming(driver)}
                          onDelete={() => setDeleting(driver)}
                          busy={
                            (toggle.isPending && confirming?.id === driver.id) ||
                            (remove.isPending && deleting?.id === driver.id)
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
                  label="motoristas"
                  className="border-outline-variant mt-5 border-t pt-5"
                />
              ) : null}
            </GlassCard>
          </div>
        </QueryState>
      </section>

      <DriverRegistrationModal
        open={dialog.open}
        onOpenChange={(open) => setDialog((atual) => ({ ...atual, open }))}
        driverId={dialog.driverId}
      />

      <ConfirmToggle
        driver={confirming}
        pending={toggle.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          confirming ? toggle.mutate({ id: confirming.id, active: !confirming.active }) : undefined
        }
      />

      <ConfirmDelete
        driver={deleting}
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
  /** Coluna que não quebra: a largura dela manda, e o nome absorve a sobra. */
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

function DriverRow({
  driver,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  driver: DriverListEntry;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const situation = SITUATIONS[driver.situation];
  /* Inativo que rodou nos últimos 30 dias é contradição, e a linha precisa
     gritar: ou a pessoa voltou e ninguém avisou o cadastro, ou alguém está
     dirigindo sem estar na escala. */
  const conflict = !driver.active && driver.situation === 'ATIVO';

  return (
    <tr
      /* A linha inteira abre a edição, como nas listas de cadastro do outro
         sistema do usuário. A guarda do `closest('button')` existe porque os
         botões da coluna de ações são filhos da linha: sem ela, inativar
         alguém abria o formulário por cima da confirmação. */
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) onEdit();
      }}
      className="border-outline-variant/60 hover:bg-on-surface/[0.04] cursor-pointer border-b transition-colors last:border-0"
    >
      {/* `max-w-0` zera a largura mínima que item de tabela herda do conteúdo:
          sem ele a coluna não respeita os 30% e volta a inchar com o nome mais
          longo da página. */}
      <td className="max-w-0 py-3 pr-4">
        <div className="flex min-w-0 items-center gap-3">
          <DriverAvatar
            driverId={driver.id}
            name={driver.name}
            hasPhoto={driver.hasPhoto}
            className="size-9 shrink-0"
          />
          <div className="min-w-0">
            {/*
             * ⚠️ Nome longo ROLA, e não é cortado com reticências.
             *
             * Técnica trazida do outro sistema do usuário a pedido dele em
             * 30/08/2026: uma linha só (`whitespace-nowrap`) e a célula rola no
             * eixo x (`overflow-x-auto`). Com o mouse em cima, a roda e o
             * trackpad andam com o texto.
             *
             * Lá a classe vem com um `scrollbar-hidden` junto; aqui ela seria
             * redundante, porque o `@layer base` do `globals.css` já esconde
             * toda barra de rolagem do sistema (19/08/2026).
             *
             * A diferença para `truncate` é que o nome inteiro continua
             * alcançável. Nesta frota isso importa: o cliente escreve instrução
             * dentro do próprio nome ("(REMOVER DA LISTA É DA BASE DE SAO
             * CRISTOVAO) WALLACE..."), e a reticência cortava justamente a parte
             * que explica por que aquele cadastro está ali.
             *
             * `overscroll-x-contain` impede que a rolagem que chega ao fim do
             * nome continue e leve a página junto.
             */}
            <p className="text-on-surface text-body-md overflow-x-auto overscroll-x-contain whitespace-nowrap font-medium">
              {driver.name}
            </p>
            {/* A segunda linha só existe quando tem o que dizer: uma linha em
                branco por baixo de 150 nomes desalinha a lista inteira. */}
            {driver.employeeNumber ? (
              <p className="text-on-surface-muted text-label-sm truncate normal-case">
                matrícula {driver.employeeNumber}
              </p>
            ) : null}
          </div>
        </div>
      </td>

      <td className="text-on-surface text-body-sm py-3 pr-4">
        {driver.document ? (
          <span className="tabular">{formatCpf(driver.document)}</span>
        ) : (
          <span className="text-on-surface-muted">–</span>
        )}
      </td>

      {/*
       * Mesma rolagem do nome, pelo mesmo motivo: uma linha só, e o texto anda
       * com a roda quando o mouse está em cima.
       *
       * ⚠️ Antes esta célula era `whitespace-nowrap` sem rolagem, e o
       * `nowrap` brigava com a largura declarada: "SERVIOESTE - RJ CAMPOS DOS
       * GOYTACAZES" forçava a coluna a 375px e comia a folga das vizinhas, que
       * é justamente o espaçamento irregular que o usuário apontou. Com a
       * rolagem, a porcentagem manda e o nome inteiro continua alcançável.
       */}
      <td className="max-w-0 py-3 pr-4">
        {driver.companyName ? (
          <p className="text-on-surface text-body-sm overflow-x-auto overscroll-x-contain whitespace-nowrap">
            {driver.companyName}
          </p>
        ) : (
          <span className="text-on-surface-muted text-body-sm">–</span>
        )}
      </td>

      <td className="text-on-surface text-body-sm hidden py-3 pr-4 lg:table-cell">
        {driver.cnhCategory ?? <span className="text-on-surface-muted">–</span>}
      </td>

      {/* `whitespace-nowrap`: "sem viagem" quebrava em duas linhas e sozinho
          esticava a linha da tabela em 16px. Com 150 pessoas, são duas telas e
          meia de rolagem a mais para ver a mesma coisa. */}
      <td className="hidden py-3 pr-4 text-right whitespace-nowrap lg:table-cell">
        <p className="text-on-surface text-body-sm tabular">
          {driver.distance30d ? `${Math.round(driver.distance30d)} km` : '–'}
        </p>
        <p className="text-on-surface-muted text-label-sm normal-case">
          {driver.lastJourneyAt ? dataCurta.format(new Date(driver.lastJourneyAt)) : 'sem viagem'}
        </p>
      </td>

      <td className="py-3 pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip tone={driver.active ? 'positive' : 'neutral'}>
            {driver.active ? 'Ativo' : 'Inativo'}
          </StatusChip>

          {/* Só aparece quando contradiz o status: chip que repete a coluna ao
              lado é ruído numa lista de 150 linhas. */}
          {conflict ? <StatusChip tone="critical">{situation.label}</StatusChip> : null}

          {driver.situation === 'NAO_E_PESSOA' ? (
            <StatusChip tone="neutral">Não é pessoa</StatusChip>
          ) : null}

          {driver.reviewed ? (
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
           * Alternar antes de editar, e não depois.
           *
           * É a ação mais repetida desta tela: a importação deixa 47 pessoas
           * já desligadas pelo fornecedor para alguém confirmar.
           *
           * ⚠️ O botão já NASCE na cor do que vai fazer: vermelho quando vai
           * desligar, verde quando vai devolver à escala. Antes os dois eram
           * cinza no repouso e só o hover revelava qual era destrutivo, o que
           * numa lista de 150 linhas significa descobrir tarde demais. A cor é
           * o rótulo, porque o botão não tem texto.
           */}
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            title={driver.active ? 'Inativar motorista' : 'Ativar motorista'}
            aria-label={driver.active ? 'Inativar motorista' : 'Ativar motorista'}
            className={cn('rounded-lg p-1.5', driver.active ? 'acao-excluir' : 'acao-ativar')}
          >
            <PowerIcon size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onEdit}
            title="Editar cadastro"
            aria-label={`Editar cadastro de ${driver.name}`}
            className="acao-editar rounded-lg p-1.5"
          >
            <EditIcon size={16} aria-hidden="true" />
          </button>

          {/*
           * Excluir é o último da linha, e é o único vermelho ao lado de um
           * power que também pode estar vermelho. Não é redundância: inativar
           * guarda o histórico de quem saiu da empresa, excluir remove o cadastro
           * que nunca deveria ter existido. Quem tenta apagar alguém com viagem
           * registrada recebe a recusa do backend explicando qual é o caso.
           */}
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Excluir cadastro"
            aria-label={`Excluir cadastro de ${driver.name}`}
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
 * A pergunta antes de ligar ou desligar.
 *
 * ⚠️ Mora aqui e não em cada chamada porque o atalho fica a um clique de
 * distância na linha: sem a confirmação, um clique torto já gravava no banco,
 * e numa lista de 150 linhas com o cursor passando por cima o clique torto
 * acontece.
 */
function ConfirmToggle({
  driver,
  pending,
  onCancel,
  onConfirm,
}: {
  driver: DriverListEntry | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const activating = driver != null && !driver.active;

  return (
    <GlassModal
      open={driver != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={activating ? 'Ativar motorista' : 'Inativar motorista'}
      className="w-[calc(100vw-2rem)] max-w-[460px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-surface text-body-md">
          {activating ? 'Ativar ' : 'Inativar '}
          <strong>{driver?.name}</strong>?{' '}
          {activating
            ? 'A pessoa volta a aparecer nas listas e nos seletores que só mostram motorista ativo.'
            : 'A pessoa deixa de aparecer nas listas e nos seletores que só mostram motorista ativo. Nada é apagado.'}
        </p>

        {/* Sem esta explicação, quem reativa alguém que a importação desligou
            fica sem saber por que a pessoa estava assim. */}
        {activating && driver?.inactiveSource === 'TELEMETRIA' ? (
          <p className="text-on-surface-muted text-label-md normal-case">
            Este motorista chegou inativo porque a filial dele no fornecedor tem nome de desligados.
            Não foi decisão de ninguém aqui.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <SpectrumButton type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </SpectrumButton>
          <SpectrumButton type="button" onClick={onConfirm} disabled={pending}>
            {pending
              ? activating
                ? 'Ativando…'
                : 'Inativando…'
              : activating
                ? 'Ativar'
                : 'Inativar'}
          </SpectrumButton>
        </div>
      </div>
    </GlassModal>
  );
}

/**
 * A pergunta antes de apagar.
 *
 * ⚠️ Diálogo próprio, e não o mesmo do ativar/inativar com outro texto. As duas
 * ações têm consequências de ordens diferentes: inativar se desfaz com um
 * clique, excluir não se desfaz. Um diálogo só, parametrizado, acabaria com o
 * mesmo peso visual para as duas e treinaria a pessoa a confirmar no automático.
 *
 * A confirmação também não promete o resultado. Quem tem viagem registrada é
 * recusado pelo backend, e a tela não tem como saber disso antes de tentar: o
 * texto diz que a exclusão só vale para quem não tem vínculo, e o erro que volta
 * explica qual vínculo apareceu.
 */
function ConfirmDelete({
  driver,
  pending,
  onCancel,
  onConfirm,
}: {
  driver: DriverListEntry | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <GlassModal
      open={driver != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="Excluir motorista"
      className="w-[calc(100vw-2rem)] max-w-[480px]"
    >
      <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6">
        <p className="text-on-surface text-body-md">
          Excluir <strong>{driver?.name}</strong>? O cadastro é apagado e não tem como voltar.
        </p>

        <Alert severity="warning">
          Só dá para excluir quem não tem vínculo nenhum no sistema. Se esta pessoa já tem viagem,
          evento de segurança ou caminhão ligado a ela, o certo é <strong>inativar</strong>: assim o
          histórico da frota continua respondendo por ela.
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
