import {
  BlockedIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  MedalIcon,
  SearchIcon,
  PlayIcon,
  RadarIcon,
  ShieldAlertIcon,
  VideoIcon,
} from '@/components/icons';
import type { ContestStatus, SafetyEvent, SafetySeverity } from '@/management/types';
import {
  GlassInput,
  GlassSelect,
  LightCard,
  Pagination,
  SpectrumButton,
  StatusChip,
  cn,
  type StatusTone,
} from '@/management/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { HeroBand } from '@/management/components/layout/hero-band';
import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { PageTabs } from '@/management/components/layout/page-tabs';
import { QueryState } from '@/management/components/layout/query-state';

import { getSafetySummary } from '../api';
import { EventVideoDialog } from '../components/event-video-dialog';

const TABS = [
  { id: 'EVENTOS', label: 'Eventos' },
  { id: 'CONTESTACOES', label: 'Contestações' },
  { id: 'COPILOTO', label: 'Copiloto' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * A frase de comparação embaixo da nota.
 *
 * Compara taxa por mil quilômetros, e não contagem bruta de eventos: uma frota
 * que rodou o dobro no mês gera o dobro de eventos sem ter piorado nada. Sem a
 * normalização, todo mês de pico viraria alarme falso.
 */
function rateHint(atual: number | undefined, anterior: number | undefined): string {
  if (atual == null) return 'sem quilometragem no período';
  const taxa = atual.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (anterior == null || anterior === 0) return `${taxa} eventos por mil km`;

  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  if (variacao === 0) return `${taxa} por mil km, estável`;
  return `${taxa} por mil km, ${variacao > 0 ? '+' : ''}${variacao}% vs. período anterior`;
}

/**
 * O nome da grandeza vem do fornecedor, em inglês.
 *
 * Traduzido por tabela, e não por serviço: são poucos nomes e eles vêm do
 * catálogo da MiX, não de texto livre do cliente. O que não estiver aqui passa
 * como veio, que é melhor que sumir.
 */
const GRANDEZA: Record<string, string> = {
  deceleration: 'Desaceleração',
  acceleration: 'Aceleração',
  'engine rpm': 'Rotação do motor',
  'road speed': 'Velocidade',
  speed: 'Velocidade',
  duration: 'Duração',
  'engine speed': 'Rotação do motor',
  distance: 'Distância',
  'fuel used': 'Combustível',
};

/**
 * O que foi medido no evento, pronto para ler.
 *
 * Vazio quando o fornecedor não disse o que o número significa. Mostrar "Valor:
 * 2100" sem o nome e a unidade é pior que não mostrar: o usuário completa a
 * lacuna sozinho, e geralmente erra.
 */
function medida(event: SafetyEvent): string | null {
  if (event.value == null || !event.valueName) return null;
  const grandeza = GRANDEZA[event.valueName.toLowerCase()] ?? event.valueName;
  const numero = event.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${grandeza}: ${numero}${event.valueUnit ? ` ${event.valueUnit}` : ''}`;
}

const SEVERITY: Record<SafetySeverity, { label: string; tone: StatusTone; rail: string }> = {
  /* A faixa da esquerda repete o chip, nunca substitui o texto dele: cor
     sozinha não carrega informação. */
  CRITICO: { label: 'Crítico', tone: 'critical', rail: 'bg-error' },
  ATENCAO: { label: 'Atenção', tone: 'attention', rail: 'bg-warning' },
  LEVE: { label: 'Leve', tone: 'neutral', rail: 'bg-on-surface/25' },
};

const CONTEST_STATUS: Record<ContestStatus, { label: string; tone: StatusTone }> = {
  PENDENTE: { label: 'Aguardando decisão', tone: 'attention' },
  ACEITA: { label: 'Aceita — falso positivo', tone: 'positive' },
  RECUSADA: { label: 'Recusada', tone: 'critical' },
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Valor de "sem recorte". Sentinela, e não string vazia: o Radix não aceita. */
const TODOS = 'TODOS';

/**
 * Cinquenta eventos por página, a pedido do usuário em 01/09/2026.
 *
 * O evento ocupa quatro linhas (título, descrição, rodapé de contexto e o botão
 * de vídeo), então cinquenta já é uma tela longa; cem seria rolagem sem fim.
 */
const POR_PAGINA = 50;

const SEVERIDADES = [
  { value: TODOS, label: 'Qualquer severidade' },
  { value: 'CRITICO', label: 'Crítico' },
  { value: 'ATENCAO', label: 'Atenção' },
  { value: 'LEVE', label: 'Leve' },
];

export function SafetyPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['safety'],
    queryFn: getSafetySummary,
  });

  const [tab, setTab] = useState<TabId>('EVENTOS');
  const [openEvent, setOpenEvent] = useState<SafetyEvent | null>(null);

  /* Recortes da fila de eventos, feitos no cliente: o período já veio inteiro na
     resposta, e trocar de severidade não pode custar uma ida ao servidor. */
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState(TODOS);
  const [severidade, setSeveridade] = useState(TODOS);
  const [pagina, setPagina] = useState(1);

  const critical = data?.events.filter((e) => e.severity === 'CRITICO').length ?? 0;
  const pending = data?.contests.filter((c) => c.status === 'PENDENTE').length ?? 0;

  const eventos = data?.events ?? [];

  /* Os tipos saem do próprio resultado: o catálogo da MiX tem dezenas, e a
     frota gera meia dúzia. */
  const opcoesTipo = [
    { value: TODOS, label: 'Todos os tipos' },
    ...[...new Set(eventos.map((event) => event.typeLabel))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((valor) => ({ value: valor, label: valor })),
  ];

  const filtrados = eventos.filter((event) => {
    const termo = busca.trim().toLowerCase();
    if (
      termo &&
      ![event.driverName, event.plate, event.location, event.typeLabel]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    ) {
      return false;
    }
    if (tipo !== TODOS && event.typeLabel !== tipo) return false;
    if (severidade !== TODOS && event.severity !== severidade) return false;
    return true;
  });

  /* A página é presa ao total durante o render: filtrar na página 3 de uma
     lista que passou a ter 20 deixaria a tela vazia. */
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const filtrando = busca !== '' || tipo !== TODOS || severidade !== TODOS;

  const limparFiltros = () => {
    setBusca('');
    setTipo(TODOS);
    setSeveridade(TODOS);
    setPagina(1);
  };

  const stats: HeroStat[] = data
    ? [
        {
          key: 'eventos',
          label: 'Eventos no período',
          value: data.events.length,
          hint: 'condução registrada pela telemetria',
          icon: RadarIcon,
        },
        {
          key: 'criticos',
          label: 'Críticos',
          value: critical,
          /* Zero aqui pode significar "ninguém dormiu ao volante" ou "esta
             frota não tem câmera". São conclusões opostas, e sem a distinção o
             gestor lê a segunda como a primeira. */
          hint:
            data.measuresCritical === false
              ? 'nenhum equipamento desta frota gera este evento'
              : 'sonolência, distração e colisão',
          icon: ShieldAlertIcon,
          tone: critical > 0 ? 'alert' : 'neutral',
        },
        {
          key: 'contestacoes',
          label: 'Contestações abertas',
          value: pending,
          hint: 'aguardando sua decisão',
          icon: InfoIcon,
          tone: pending > 0 ? 'warn' : 'neutral',
        },
        {
          /*
           * A nota é relativa à própria frota, então a comparação útil não é
           * contra um alvo absoluto: é a taxa de eventos por mil quilômetros
           * contra o período anterior. É ela que responde "melhoramos ou
           * pioramos".
           */
          key: 'score',
          label: 'Score médio da frota',
          value: data.fleetScore ?? '–',
          hint: rateHint(data.eventsPer1000Km, data.eventsPer1000KmPrevious),
          icon: MedalIcon,
        },
      ]
    : [];

  return (
    <>
      <HeroBand
        title="Segurança"
        description="Eventos na estrada, contestações dos motoristas e as câmeras que merecem atenção agora."
      />

      <section className="w-full px-4 pb-8 sm:px-6 xl:px-10">
        <h2 className="sr-only">Resumo de segurança</h2>

        <QueryState isPending={isPending} isError={isError} label="os dados de segurança">
          {/* A subida fica nos cards, e não na seção: em volta do `QueryState` ela
              jogaria o carregamento e o erro por cima da faixa colorida. */}
          {data ? <HeroStats items={stats} className="-mt-16 sm:-mt-20" /> : null}
        </QueryState>
      </section>

      <PageContent className="rounded-t-4xl bg-light mt-0 sm:mt-0 sm:rounded-t-[40px]">
        <PageTabs
          tabs={TABS.map((option) => ({
            ...option,
            count:
              option.id === 'EVENTOS'
                ? data?.events.length
                : option.id === 'CONTESTACOES'
                  ? pending
                  : data?.copilot.length,
          }))}
          value={tab}
          onValueChange={setTab}
          label="Seções de segurança"
        >
          <QueryState isPending={isPending} isError={isError} label="os dados de segurança">
            {data ? (
              <div className="pb-4">
                {/* ---------------------------------------------------------
                 * Eventos
                 * ------------------------------------------------------- */}
                {tab === 'EVENTOS' ? (
                  <LightCard title="Eventos na estrada">
                    {/* ⚠️ `surface="light"`: os campos moram dentro do painel
                        branco, e a versão escura deles inverte a hierarquia. */}
                    <div className="mb-4 grid items-end gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
                      <GlassInput
                        surface="light"
                        label="Buscar"
                        placeholder="Motorista, placa ou trecho"
                        value={busca}
                        onChange={(evento) => setBusca(evento.target.value)}
                        leading={<SearchIcon size={16} aria-hidden="true" />}
                      />

                      <GlassSelect
                        surface="light"
                        label="Tipo de evento"
                        options={opcoesTipo}
                        value={tipo}
                        onValueChange={setTipo}
                      />

                      <GlassSelect
                        surface="light"
                        label="Severidade"
                        options={SEVERIDADES}
                        value={severidade}
                        onValueChange={setSeveridade}
                      />
                    </div>

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-on-light-muted text-label-md normal-case">
                        {filtrados.length === eventos.length
                          ? `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`
                          : `${filtrados.length} de ${eventos.length} eventos`}
                      </p>

                      {filtrando ? (
                        <SpectrumButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={limparFiltros}
                        >
                          Limpar filtros
                        </SpectrumButton>
                      ) : null}
                    </div>

                    {filtrados.length === 0 ? (
                      <p className="text-on-light-variant text-body-md py-10 text-center">
                        {eventos.length === 0
                          ? 'Nenhum evento no período.'
                          : 'Nenhum evento com esses filtros.'}
                      </p>
                    ) : null}

                    <ul className="flex flex-col gap-2">
                      {daPagina.map((event) => {
                        const severity = SEVERITY[event.severity];
                        const valor = medida(event);

                        return (
                          <li
                            key={event.id}
                            className="bg-surface-lowest flex items-stretch gap-3.5 rounded-lg p-3.5 sm:gap-4 sm:p-4"
                          >
                            <span
                              className={cn('w-1 shrink-0 rounded-full', severity.rail)}
                              aria-hidden="true"
                            />

                            <span className="bg-on-surface/6 text-on-surface-variant mt-0.5 hidden size-9 shrink-0 items-center justify-center rounded-md sm:flex">
                              <ShieldAlertIcon size={17} aria-hidden="true" />
                            </span>

                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-on-surface text-body-md font-medium">
                                  {event.typeLabel}
                                </span>
                                <StatusChip tone={severity.tone}>{severity.label}</StatusChip>
                                {event.warned ? (
                                  <StatusChip tone="neutral">Advertência aplicada</StatusChip>
                                ) : null}
                              </div>

                              <p className="text-on-surface-variant text-body-md">
                                {event.description}
                                {/* O número medido só entra acompanhado do que ele
                                    mede e da unidade. "2100" sozinho não diz se
                                    são rotações, km/h ou segundos. */}
                                {valor ? (
                                  <span className="text-on-surface tabular"> · {valor}</span>
                                ) : null}
                              </p>

                              {/* Uma linha só de contexto, com quem, onde e
                                  quando separados por ponto: quatro caixas de
                                  texto cinza-claro em fila não dizem qual é qual. */}
                              <p className="text-on-surface-muted text-label-md flex flex-wrap items-center gap-x-2 normal-case">
                                <span>{event.driverName}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular">{event.plate}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular">
                                  {dateTime.format(new Date(event.at))}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="min-w-0 truncate">{event.location}</span>
                              </p>
                            </div>

                            {/* A ação fica na altura do título, e não no rodapé:
                                no rodapé ela disputava a linha com o contexto e
                                empurrava o endereço para a linha seguinte. */}
                            <div className="flex shrink-0 items-center">
                              {event.media ? (
                                <SpectrumButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOpenEvent(event)}
                                >
                                  <PlayIcon size={16} aria-hidden="true" />
                                  Ver vídeo ({event.media.durationSeconds}s)
                                </SpectrumButton>
                              ) : (
                                <span className="text-on-surface-muted text-label-md normal-case">
                                  Sem câmera
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <Pagination
                      className="mt-5"
                      page={paginaAtual}
                      total={filtrados.length}
                      pageSize={POR_PAGINA}
                      onPageChange={setPagina}
                      label="eventos"
                    />
                  </LightCard>
                ) : tab === 'CONTESTACOES' ? (
                  /* -------------------------------------------------------
                   * Contestações (RF-029)
                   * ----------------------------------------------------- */
                  <LightCard
                    title="Contestações"
                    action={
                      pending > 0 ? (
                        <StatusChip tone="attention" surface="light">
                          {pending} aguardando
                        </StatusChip>
                      ) : null
                    }
                  >
                    <p className="text-on-light-variant text-body-md mb-4">
                      Quando o motorista contesta um evento, a decisão é do gestor — e fica no log
                      de auditoria com o motivo. Evento aceito vira falso positivo e sai do score.
                    </p>

                    <ul className="flex flex-col gap-3">
                      {data.contests.map((contest) => {
                        const status = CONTEST_STATUS[contest.status];
                        return (
                          <li key={contest.id} className="bg-surface-lowest rounded-lg p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-on-surface font-medium">{contest.eventLabel}</p>
                                <p className="text-on-surface-muted text-label-md mt-0.5 normal-case">
                                  {contest.driverName} ·{' '}
                                  <span className="tabular">{contest.plate}</span> ·{' '}
                                  {dateTime.format(new Date(contest.at))}
                                </p>
                              </div>
                              <StatusChip tone={status.tone}>{status.label}</StatusChip>
                            </div>

                            <blockquote className="border-outline-variant text-on-surface-variant text-body-md mt-3 border-l-2 pl-3 italic">
                              {contest.reason}
                            </blockquote>

                            {contest.decision ? (
                              <div className="border-outline-variant mt-3 border-t pt-3">
                                <p className="text-on-surface-muted text-label-md normal-case">
                                  {contest.decision.by} ·{' '}
                                  {dateTime.format(new Date(contest.decision.at))}
                                </p>
                                <p className="text-on-surface-variant text-body-md mt-1">
                                  {contest.decision.note}
                                </p>
                              </div>
                            ) : (
                              <div className="border-outline-variant mt-3 flex flex-wrap gap-2 border-t pt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toast.success('Contestação aceita', {
                                      description:
                                        'O evento vira falso positivo e sai do score. A decisão exige motivo e vai para o log de auditoria.',
                                    })
                                  }
                                  className="border-success/40 text-success text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                                >
                                  <CheckCircleIcon size={14} aria-hidden="true" />
                                  Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toast.info('Contestação recusada', {
                                      description:
                                        'A advertência é mantida. O motivo da recusa fica registrado.',
                                    })
                                  }
                                  className="border-error/40 text-error text-label-md focus-visible:ring-secondary inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 normal-case transition-colors hover:bg-on-surface/5 focus-visible:outline-none focus-visible:ring-2"
                                >
                                  <BlockedIcon size={14} aria-hidden="true" />
                                  Recusar
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </LightCard>
                ) : (
                  /* -------------------------------------------------------
                   * Copiloto do operador (RN-080 / DAT-04)
                   * ----------------------------------------------------- */
                  <LightCard title="Copiloto do operador">
                    <p className="text-on-light-variant text-body-md mb-2">
                      As câmeras com maior probabilidade de evento nas próximas horas, para o
                      operador priorizar quem olhar primeiro.
                    </p>
                    <p className="text-on-light-muted text-label-md mb-5 flex items-start gap-1.5 normal-case">
                      <InfoIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A ordem
                      vem de telemetria, jornada, horário e histórico — nunca de análise de imagem.
                      O RookHub não processa vídeo; a decisão continua sendo humana.
                    </p>

                    <ul className="grid gap-3 xl:grid-cols-3">
                      {data.copilot.map((camera) => (
                        <li
                          key={camera.vehicleId}
                          className="bg-surface-lowest flex min-w-0 flex-col rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="tabular text-on-surface font-semibold">
                                {camera.plate}
                              </p>
                              <p className="text-on-surface-muted text-label-md mt-0.5 truncate normal-case">
                                {camera.driverName}
                              </p>
                            </div>
                            <VideoIcon
                              size={20}
                              className="text-on-surface-muted shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          <div className="mt-4">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className="text-on-surface-variant text-label-md normal-case">
                                Prioridade
                              </span>
                              <span className="tabular text-on-surface font-semibold">
                                {camera.riskScore}
                              </span>
                            </div>
                            <div
                              role="img"
                              aria-label={`Prioridade ${camera.riskScore} de 100`}
                              className="bg-surface-high rounded-pill h-1.5 overflow-hidden"
                            >
                              <div
                                className={cn(
                                  'rounded-pill h-full',
                                  camera.riskScore >= 75
                                    ? 'bg-error'
                                    : camera.riskScore >= 50
                                      ? 'bg-warning'
                                      : 'bg-secondary',
                                )}
                                style={{ width: `${camera.riskScore}%` }}
                              />
                            </div>
                          </div>

                          <ul className="mt-4 flex flex-col gap-1.5">
                            {camera.signals.map((signal) => (
                              <li
                                key={signal.label}
                                className="text-on-surface-variant text-label-md flex items-start gap-1.5 normal-case"
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'rounded-pill mt-1.5 size-1.5 shrink-0',
                                    signal.weight === 'ALTO' ? 'bg-error' : 'bg-warning',
                                  )}
                                />
                                {signal.label}
                                <span className="sr-only">
                                  — peso {signal.weight === 'ALTO' ? 'alto' : 'médio'}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <p className="border-outline-variant text-on-surface-muted text-label-md mt-auto flex items-center gap-1.5 border-t pt-3 normal-case">
                            <ClockIcon size={13} aria-hidden="true" />
                            {camera.hoursDriving.toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                            })}
                            h ao volante
                          </p>
                        </li>
                      ))}
                    </ul>
                  </LightCard>
                )}
              </div>
            ) : null}
          </QueryState>
        </PageTabs>
      </PageContent>

      <EventVideoDialog
        event={openEvent}
        open={openEvent !== null}
        onOpenChange={(next) => (next ? undefined : setOpenEvent(null))}
      />
    </>
  );
}
