import { PlusIcon, SearchIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { PageBanner } from '@/management/components/layout/page-banner';
import { QueryState } from '@/management/components/layout/query-state';
import { fetchDriverRegistry, type DriverListEntry } from '@/management/lib/fleet-api';
import {
  GlassCard,
  GlassInput,
  GlassSelect,
  SpectrumButton,
  StatusChip,
  cn,
  type StatusTone,
} from '@/management/ui';

import { DriverAvatar } from '../components/driver-avatar';
import { DriverRegistrationModal } from '../components/driver-registration-modal';
import { formatCpf } from '../registration-schema';

/**
 * Cadastro de motoristas: a lista suja que veio da telemetria, e o que fazer com ela.
 *
 * <h2>Por que a tela mostra tudo, inclusive o lixo</h2>
 *
 * ⚠️ Esta é a única tela que consome `/v1/drivers/registry`, que não filtra
 * nada. Todas as outras usam `/v1/drivers`, que esconde conta de sistema e
 * inativo de propósito, para não sujar ranking e operação.
 *
 * Aqui é o contrário: a tela existe porque o cadastro do fornecedor está
 * poluído, e esconder seria esconder o trabalho a fazer. Na frota real, dos 149
 * motoristas que a MiX entrega, 17 não são pessoas, 73 estão em filiais que o
 * cliente batizou de DESLIGADOS, e 10 rodaram no último mês.
 *
 * <h2>DESLIGADO é rótulo, não regra</h2>
 *
 * A marca sai do nome da filial, que é texto que o cliente digitou. Ela serve
 * para filtrar e enxergar, e não muda comportamento em lugar nenhum: o próximo
 * cliente vai escrever diferente, e uma regra de negócio apoiada nisso quebraria
 * em silêncio.
 */

const SITUATIONS: Record<DriverListEntry['situation'], { label: string; tone: StatusTone }> = {
  ATIVO: { label: 'Ativo', tone: 'positive' },
  PARADO: { label: 'Parado', tone: 'attention' },
  NAO_E_PESSOA: { label: 'Não é pessoa', tone: 'neutral' },
};

/**
 * O conflito tem filtro próprio.
 *
 * ⚠️ "Marcado como inativo" não é uma situação, é uma marca que convive com
 * qualquer uma delas. Quem está marcado assim e mesmo assim rodou é o caso que
 * precisa de alguém olhando: na frota real são três pessoas, uma delas com a
 * data de desligamento escrita dentro do próprio nome, e mesmo assim com 376 km
 * no último mês.
 */
const CONFLICT = 'CONFLITO';
const MARKED = 'MARCADO';

const SITUATION_OPTIONS = [
  { value: 'TODAS', label: 'Todas as situações' },
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'PARADO', label: 'Parado' },
  { value: 'NAO_E_PESSOA', label: 'Não é pessoa' },
  { value: MARKED, label: 'Marcado como inativo' },
  { value: CONFLICT, label: 'Marcado como inativo, mas rodando' },
];

const ORIGIN_OPTIONS = [
  { value: 'TODAS', label: 'Todas as origens' },
  { value: 'ROOKHUB', label: 'Cadastrado no RookHub' },
  { value: 'TELEMETRIA', label: 'Veio da telemetria' },
];

const ALL_SITES = 'TODAS';

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
    <div className="bg-surface-lowest min-w-0 rounded-lg p-4">
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

function DriverRow({ driver }: { driver: DriverListEntry }) {
  const situation = SITUATIONS[driver.situation];
  const registered = driver.origin === 'ROOKHUB';

  return (
    <li className="border-outline-variant flex items-center gap-3 border-b px-1 py-3 last:border-b-0">
      <DriverAvatar
        driverId={driver.id}
        name={driver.name}
        hasPhoto={driver.hasPhoto}
        className="size-10"
      />

      <div className="min-w-0 flex-1">
        <p className="text-on-surface text-body-md truncate font-medium">{driver.name}</p>
        <p className="text-on-surface-muted text-label-md truncate normal-case">
          {driver.document ? (
            <span className="tabular">{formatCpf(driver.document)}</span>
          ) : (
            'sem CPF'
          )}
          {driver.siteName ? ` · ${driver.siteName}` : ''}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 text-right sm:block">
        <p className="text-on-surface text-body-sm tabular">
          {driver.distance30d ? `${Math.round(driver.distance30d)} km` : '–'}
        </p>
        <p className="text-on-surface-muted text-label-sm normal-case">
          {driver.lastJourneyAt ? dataCurta.format(new Date(driver.lastJourneyAt)) : 'sem viagem'}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {registered ? <StatusChip tone="info">RookHub</StatusChip> : null}
        {driver.cnhCategory ? (
          <StatusChip tone="neutral">CNH {driver.cnhCategory}</StatusChip>
        ) : null}
        {/* As duas marcas convivem: é a combinação "marcado como inativo" com
            "ativo" que denuncia o cadastro errado. */}
        {driver.markedInactive ? (
          <StatusChip tone={driver.situation === 'ATIVO' ? 'critical' : 'neutral'}>
            marcado inativo
          </StatusChip>
        ) : null}
        <StatusChip tone={situation.tone}>{situation.label}</StatusChip>
      </div>
    </li>
  );
}

export function DriverRegistryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [situation, setSituation] = useState('TODAS');
  const [origin, setOrigin] = useState('TODAS');
  const [site, setSite] = useState(ALL_SITES);

  const { data, isPending, isError } = useQuery({
    queryKey: ['driver-registry'],
    queryFn: fetchDriverRegistry,
  });

  const drivers = useMemo(() => data ?? [], [data]);

  /**
   * As filiais que aparecem no filtro saem da própria lista, e não do endpoint
   * de filiais.
   *
   * ⚠️ Duas razões. A primeira é que o cadastro do fornecedor tem filiais com
   * **nome repetido**: a SERVIOESTE tem duas "DESLIGADOS / INATIVOS" e várias
   * "Default Site". Como o filtro casa por nome, montar as opções a partir do
   * endpoint gerava chaves duplicadas no React.
   *
   * A segunda é que só interessa a filial que tem alguém: oferecer filial vazia
   * no filtro é oferecer um caminho que sempre devolve lista vazia.
   */
  const siteNames = useMemo(
    () =>
      [...new Set(drivers.map((d) => d.siteName).filter((n): n is string => Boolean(n)))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [drivers],
  );

  const counts = useMemo(
    () => ({
      total: drivers.length,
      ativo: drivers.filter((d) => d.situation === 'ATIVO').length,
      parado: drivers.filter((d) => d.situation === 'PARADO').length,
      marcado: drivers.filter((d) => d.markedInactive).length,
      conflito: drivers.filter((d) => d.markedInactive && d.situation === 'ATIVO').length,
      naoEhPessoa: drivers.filter((d) => d.situation === 'NAO_E_PESSOA').length,
      rookhub: drivers.filter((d) => d.origin === 'ROOKHUB').length,
    }),
    [drivers],
  );

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return drivers.filter((driver) => {
      if (situation === CONFLICT) {
        if (!driver.markedInactive || driver.situation !== 'ATIVO') return false;
      } else if (situation === MARKED) {
        if (!driver.markedInactive) return false;
      } else if (situation !== 'TODAS' && driver.situation !== situation) {
        return false;
      }
      if (origin !== 'TODAS' && driver.origin !== origin) return false;
      if (site !== ALL_SITES && (driver.siteName ?? '') !== site) return false;
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
  }, [drivers, search, situation, origin, site]);

  const siteOptions = [
    { value: ALL_SITES, label: 'Todas as filiais' },
    ...siteNames.map((name) => ({ value: name, label: name })),
  ];

  const filtering =
    search.trim() !== '' || situation !== 'TODAS' || origin !== 'TODAS' || site !== ALL_SITES;

  return (
    <>
      <PageBanner
        size="inline"
        title="Cadastro de motoristas"
        description="Quem a telemetria entrega, em que situação cada um está, e quem já foi conferido por uma pessoa."
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-24 sm:px-6">
        <QueryState isPending={isPending} isError={isError} label="os motoristas">
          <div className="flex flex-col gap-5">
            {/* ---------------------------------------------------------- */}
            {/* O tamanho do problema                                       */}
            {/* ---------------------------------------------------------- */}
            <GlassCard className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-5">
              <Tile
                label="Vindos da telemetria"
                value={counts.total}
                hint="tudo que a MiX entrega como motorista"
              />
              <Tile
                label="Ativos"
                value={counts.ativo}
                hint="rodaram nos últimos 30 dias"
                tone="positive"
              />
              <Tile
                label="Parados"
                value={counts.parado}
                hint="sem viagem há mais de 30 dias"
                tone="attention"
              />
              <Tile
                label="Marcados como inativos"
                value={counts.marcado}
                hint={`${counts.conflito} deles rodaram mesmo assim`}
                tone={counts.conflito > 0 ? 'critical' : undefined}
              />
              <Tile
                label="Cadastrados aqui"
                value={counts.rookhub}
                hint={`e ${counts.naoEhPessoa} contas que não são pessoas`}
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
                  label="Situação"
                  options={SITUATION_OPTIONS}
                  value={situation}
                  onValueChange={setSituation}
                />

                <GlassSelect
                  label="Origem"
                  options={ORIGIN_OPTIONS}
                  value={origin}
                  onValueChange={setOrigin}
                />

                <GlassSelect
                  label="Filial"
                  options={siteOptions}
                  value={site}
                  onValueChange={setSite}
                />

                <SpectrumButton type="button" onClick={() => setModalOpen(true)}>
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
                  <SpectrumButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setSituation('TODAS');
                      setOrigin('TODAS');
                      setSite(ALL_SITES);
                    }}
                  >
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
                <p className="text-on-surface-muted text-body-md py-10 text-center">
                  Nenhum motorista com esses filtros.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {filtered.map((driver) => (
                    <DriverRow key={driver.id} driver={driver} />
                  ))}
                </ul>
              )}
            </GlassCard>

            <p className="text-on-surface-muted text-label-md normal-case">
              <strong>Marcado inativo</strong> vem do nome da filial no fornecedor conter
              &quot;desligados&quot; ou &quot;inativos&quot;. É texto digitado pelo cliente: serve
              para enxergar e filtrar, e não muda o comportamento de nenhuma outra tela. Filial com
              nome de cidade, como Queimados, não entra na conta.
            </p>
          </div>
        </QueryState>
      </section>

      <DriverRegistrationModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
