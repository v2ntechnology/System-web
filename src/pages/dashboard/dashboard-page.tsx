import {
  ApprovalIcon,
  ArrowRightIcon,
  CalendarIcon,
  ArrowUpRightIcon,
  BellIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  EntryIcon,
  FuelIcon,
  InfoIcon,
  MaintenanceIcon,
  RadarIcon,
  RouteIcon,
  WarehouseIcon,
  WarningIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { ROLE_LABELS } from '@/app/permissions';
import { ChartCard, SimpleBarChart, TrendAreaChart } from '@/components/shared/charts';
import { MetricCard } from '@/components/shared/cards';
import { OperationMap } from '@/components/shared/operation-map';
import { ErrorState } from '@/components/shared/states';
import { DateRangeSelector, type DateRangePreset } from '@/components/shared/filters';
import { YardMetric } from '@/components/shared/operator-cards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlerts, useDashboard, useOperatorOverview, useYard } from '@/hooks/use-queries';
import { usePermissions, useSession } from '@/hooks/use-session';
import { greetingForNow, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFinancialVisibility } from '@/management/features/drivers/use-financial-visibility';
import type { LaunchEntry, YardVehicle } from '@/services/operator';
import { type MapVehicleMarker } from '@/types';

/**
 * Dashboard do operador.
 *
 * ⚠️ A tela mostra **só número, gráfico e mapa** (decisão do usuário em
 * 09/09/2026, no arranjo da visão geral do gestor). Nenhuma lista, nenhuma
 * busca, nenhuma linha de registro: quem quer a lista clica no botão do painel
 * e vai para a tela do assunto. O dashboard responde "quanto", e não "qual
 * placa".
 *
 * O que saiu daqui por causa disso: o quadro do pátio com busca, a lista de
 * lançamentos recentes, o feed de atividade e a lista de alertas. Cada um virou
 * um painel de contagem com o botão para a tela onde ele mora inteiro.
 */

/* -------------------------------------------------------------------------- */
/* Peças de arranjo                                                            */
/* -------------------------------------------------------------------------- */

/* Por extenso porque é cabeçalho: "09/09" é formato de tabela. */
const TODAY_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
});

const HOUR_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Pastilha da faixa de abertura, gêmea do `HeroPill` do painel de gestão. */
const HERO_PILL =
  'text-label-md inline-flex items-center gap-2 rounded-md border border-on-primary px-3.5 py-2 normal-case';

/**
 * Painel do dashboard, no desenho do `LightCard` da visão geral do gestor:
 * título grande à esquerda, ações no canto oposto, contagens abaixo.
 *
 * Mora aqui, e não em `components/shared`, porque é arranjo desta tela. Se uma
 * segunda tela do painel operacional pedir o mesmo bloco, ele sobe.
 */
function Panel({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-6 sm:p-7', className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-headline-md tracking-[-0.02em]">{title}</h2>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </Card>
  );
}

/** Linha de contexto do painel, acima das contagens. */
function PanelLead({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <p className="text-body-md -mt-2 mb-5 flex items-start gap-2 text-on-light-variant">
      <Icon className="mt-1 h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

type CountTone = 'critical' | 'attention' | 'neutral' | 'positive';

interface CountItem {
  key: string;
  label: string;
  value: string | number;
  tone: CountTone;
  /** Uma linha do que aquele número quer dizer para quem trabalha no pátio. */
  hint: string;
  locked?: boolean;
}

/*
 * ⚠️ Família `on-light`, e NÃO os semânticos da marca.
 *
 * Estas placas moram dentro de um painel branco, e os semânticos são claros
 * demais para o papel: o `destructive` (#E11D48) sai rosa berrante onde a visão
 * geral do gestor escreve o #9F1239, e o `warning` (#B45309) sai laranja contra
 * o marrom #6B3F0A de lá. É exatamente o par de tokens do `SummaryCounts` do
 * painel de gestão.
 */
const TONE_TEXT: Record<CountTone, string> = {
  critical: 'text-error-on-light',
  attention: 'text-warning-on-light',
  neutral: 'text-on-light',
  positive: 'text-success-on-light',
};

const TONE_SURFACE: Record<CountTone, string> = {
  critical: 'bg-error-on-light/[0.07]',
  attention: 'bg-warning-on-light/[0.07]',
  neutral: 'bg-on-light/[0.04]',
  positive: 'bg-success-on-light/[0.07]',
};

/**
 * Placas de contagem dentro de um painel, gêmeas do `SummaryCounts` da visão
 * geral do gestor: o painel é só o número, e a lista mora na tela do assunto.
 */
function CountTiles({
  items,
  stacked = false,
}: {
  items: CountItem[];
  /** Empilhado na coluna estreita, onde três colunas não cabem. */
  stacked?: boolean;
}) {
  return (
    <dl className={cn('grid gap-3', stacked ? 'grid-cols-1' : 'sm:grid-cols-3')}>
      {items.map((item) => (
        <div key={item.key} className={cn('min-w-0 rounded-lg px-4 py-3', TONE_SURFACE[item.tone])}>
          <dt className="text-label-sm text-on-light-variant normal-case">{item.label}</dt>
          <dd
            className={cn(
              'font-display mt-2 text-[30px] font-bold leading-none tabular-nums',
              item.locked ? 'text-on-light-muted' : TONE_TEXT[item.tone],
            )}
          >
            {item.value}
          </dd>
          <p className="text-label-sm mt-1.5 text-on-light-muted normal-case">{item.hint}</p>
        </div>
      ))}
    </dl>
  );
}

/** Pastilha de contagem por categoria, no rodapé de um painel. */
function KindChip({ icon: Icon, label, value }: { icon: IconType; label: string; value: number }) {
  return (
    <span className="text-label-md inline-flex items-center gap-2 rounded-lg bg-on-light/[0.05] px-3 py-2 text-on-light-variant normal-case">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
      <span className="font-display font-bold tabular-nums text-on-light">{value}</span>
    </span>
  );
}

/** Título de seção com o ícone no quadrado de marca. */
function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: IconType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-on-light/10 text-primary-on-light"
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-display text-body-lg font-semibold leading-tight tracking-[-0.02em]">
          {title}
        </h2>
        <p className="text-label-sm text-muted-foreground normal-case">{description}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rotina de pátio                                                             */
/* -------------------------------------------------------------------------- */

const ENTRY_KIND_CHIPS: { kind: LaunchEntry['kind']; label: string; icon: IconType }[] = [
  { kind: 'ABASTECIMENTO', label: 'Abastecimento', icon: FuelIcon },
  { kind: 'MULTA', label: 'Multa', icon: ApprovalIcon },
  { kind: 'ORDEM_MANUTENCAO', label: 'Ordem de manutenção', icon: MaintenanceIcon },
  { kind: 'DESPESA', label: 'Despesa', icon: EntryIcon },
];

function countByStatus(vehicles: YardVehicle[], status: YardVehicle['status']) {
  return vehicles.filter((vehicle) => vehicle.status === status).length;
}

/**
 * Rotina de pátio: os números que respondem "o que chegou para eu tratar e qual
 * caminhão pode sair", antes de qualquer gráfico.
 *
 * O arranjo é o da visão geral do gestor: a fileira de estado sobe por cima da
 * faixa de abertura, a faixa de apoio abre o dia em partes, a procedência fecha
 * o bloco em letra pequena, e os painéis abaixo carregam só a contagem.
 */
function YardOverview() {
  const canSeeFinancials = useFinancialVisibility();
  const overview = useOperatorOverview(canSeeFinancials);
  const yard = useYard();

  const data = overview.data;
  if (overview.isError) return null;

  if (!data) {
    return (
      <div className="relative z-10 -mt-16 grid grid-cols-2 gap-4 sm:-mt-20 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const vehicles = yard.data ?? [];
  const total = vehicles.length;
  const noSignal = countByStatus(vehicles, 'SEM_SINAL');

  return (
    <>
      {/*
       * ⚠️ A fileira SOBE por cima da faixa (`-mt-14` com `z-10`), como na visão
       * geral do gestor. Quem paga o espaço é o `pb-24` da faixa: mexeu num,
       * mexa no outro, senão os blocos cobrem a saudação.
       *
       * Os seis estados são exclusivos e cada um traz o denominador ao lado, que
       * é o que permite conferir a conta a olho sem somar os cards.
       */}
      <div className="relative z-10 -mt-16 grid grid-cols-2 gap-4 sm:-mt-20 sm:grid-cols-3 xl:grid-cols-6">
        <YardMetric
          label="No pátio"
          value={data.vehiclesInYard}
          icon={WarehouseIcon}
          accent="brand"
        />
        <YardMetric
          label="Disponíveis"
          value={countByStatus(vehicles, 'DISPONIVEL')}
          outOf={total}
          icon={CheckCircleIcon}
          accent="success"
        />
        <YardMetric
          label="Em viagem"
          value={countByStatus(vehicles, 'EM_VIAGEM')}
          outOf={total}
          icon={RouteIcon}
          accent="info"
        />
        <YardMetric
          label="Em manutenção"
          value={countByStatus(vehicles, 'MANUTENCAO')}
          outOf={total}
          icon={MaintenanceIcon}
          accent="brand"
        />
        <YardMetric
          label="Com impedimento"
          value={data.vehiclesBlocked}
          outOf={total}
          icon={WarningIcon}
          accent="warning"
          tone="warn"
        />
        {/* Rastreador mudo não é "parado": é a parte da frota sobre a qual não
            se sabe nada, e por isso é a única que ganha contorno. */}
        <YardMetric
          label="Sem sinal"
          value={noSignal}
          outOf={total}
          icon={RadarIcon}
          accent="warning"
          tone="alert"
        />
      </div>

      {/* Faixa de apoio: o dia do operador aberto em partes. É o gêmeo da faixa
          de motoristas da visão geral do gestor. */}
      <Card className="mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-md bg-primary-on-light/10 text-primary-on-light"
            aria-hidden
          >
            <ChecklistIcon className="h-[17px] w-[17px]" />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm text-on-light-variant normal-case">Triagem</p>
            <p className="font-display mt-1 text-[22px] font-bold leading-none tabular-nums">
              {data.triagePending}
            </p>
          </div>
        </div>

        {/* Divisa só no monitor: empilhada, ela vira um traço solto no meio. */}
        <div className="hidden h-10 w-px shrink-0 bg-border sm:block" aria-hidden />

        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dd
              className={cn(
                'font-display text-[22px] font-bold leading-none tabular-nums',
                data.triageBlocking > 0 ? 'text-warning-on-light' : 'text-on-light',
              )}
            >
              {data.triageBlocking}
            </dd>
            <dt className="text-label-sm mt-1.5 text-on-light-variant normal-case">
              impedem a saída do veículo
            </dt>
          </div>
          <div>
            <dd className="font-display text-[22px] font-bold leading-none tabular-nums">
              {data.entriesToday}
            </dd>
            <dt className="text-label-sm mt-1.5 text-on-light-variant normal-case">
              lançamentos hoje
            </dt>
          </div>
          {/* RF-007: sem visibilidade financeira o campo aparece bloqueado, e
              não some. Digitar a nota continua sendo trabalho dele; ler o
              acumulado, não. */}
          <div>
            <dd
              className={cn(
                'font-display text-[22px] font-bold leading-none tabular-nums',
                data.amountToday === undefined && 'text-on-light-muted',
              )}
            >
              {data.amountToday !== undefined ? formatCurrency(data.amountToday) : 'Restrito'}
            </dd>
            <dt className="text-label-sm mt-1.5 text-on-light-variant normal-case">
              {data.amountToday !== undefined ? 'valor lançado hoje' : 'valor do dia, restrito'}
            </dt>
          </div>
        </dl>
      </Card>

      {/* O número vem com a procedência colada nele. */}
      <p className="text-label-sm mt-3 flex items-start gap-1.5 px-1 text-muted-foreground normal-case">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {data.source}
      </p>
    </>
  );
}

/**
 * Os painéis da rotina de pátio, na coluna larga. Só contagem: a lista de cada
 * assunto mora na tela dele, alcançada pelo botão do cabeçalho.
 *
 * Componente próprio porque o topo é de largura cheia e os painéis dividem a
 * linha com o mapa. O `useOperatorOverview` daqui não é uma segunda requisição:
 * a chave é a mesma do topo, e o React Query devolve o cache.
 */
function YardPanels() {
  const canSeeFinancials = useFinancialVisibility();
  const overview = useOperatorOverview(canSeeFinancials);
  const yard = useYard();

  const data = overview.data;
  if (!data) return <Skeleton className="h-[560px] w-full rounded-xl" />;

  const vehicles = yard.data ?? [];
  const total = vehicles.length;
  const overdueMaintenance = vehicles.filter((vehicle) => vehicle.kmToMaintenance < 0).length;
  const noSignal = countByStatus(vehicles, 'SEM_SINAL');
  const fines = data.recentEntries.filter((entry) => entry.kind === 'MULTA').length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel
        title="Triagem"
        actions={
          <>
            <Button asChild variant="brand">
              <Link to="/app/triagem">
                Abrir triagem
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/checklists">
                <ChecklistIcon className="h-4 w-4" />
                Checklists
              </Link>
            </Button>
          </>
        }
      >
        <PanelLead icon={ClockIcon}>
          {data.triagePending === 0
            ? 'Fila de triagem vazia.'
            : data.triagePending === 1
              ? '1 checklist espera sua tratativa.'
              : `${data.triagePending} checklists esperam sua tratativa.`}
        </PanelLead>

        <CountTiles
          items={[
            {
              key: 'fila',
              label: 'Na fila',
              value: data.triagePending,
              tone: data.triagePending > 0 ? 'attention' : 'neutral',
              hint: 'checklist aguardando você',
            },
            {
              key: 'bloqueio',
              label: 'Impedem a saída',
              value: data.triageBlocking,
              tone: data.triageBlocking > 0 ? 'critical' : 'neutral',
              hint: 'o caminhão não pode sair',
            },
            {
              key: 'veiculos',
              label: 'Veículos travados',
              value: data.vehiclesBlocked,
              tone: data.vehiclesBlocked > 0 ? 'attention' : 'neutral',
              hint: 'esperando a tratativa da fila',
            },
          ]}
        />
      </Panel>

      <Panel
        title="Impedimentos no pátio"
        actions={
          <>
            <Button asChild variant="brand">
              <Link to="/app/frota">
                Ver frota
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/manutencoes">
                <MaintenanceIcon className="h-4 w-4" />
                Manutenções
              </Link>
            </Button>
          </>
        }
      >
        <PanelLead icon={WarningIcon}>
          {total === 0
            ? 'Nenhum veículo no pátio agora.'
            : `${total} veículos no pátio, do que trava a saída agora ao que ainda não dá para afirmar.`}
        </PanelLead>

        <CountTiles
          items={[
            {
              key: 'bloqueia',
              label: 'Bloqueia agora',
              value: data.vehiclesBlocked,
              tone: data.vehiclesBlocked > 0 ? 'critical' : 'neutral',
              hint: 'o caminhão não pode sair',
            },
            {
              key: 'preventiva',
              label: 'Preventiva vencida',
              value: overdueMaintenance,
              tone: overdueMaintenance > 0 ? 'attention' : 'neutral',
              hint: 'passou do km da revisão',
            },
            {
              key: 'sinal',
              label: 'Sem visibilidade',
              value: noSignal,
              tone: noSignal > 0 ? 'attention' : 'neutral',
              hint: 'rastreador sem sincronizar',
            },
          ]}
        />
      </Panel>

      <Panel
        title="Lançamentos do dia"
        actions={
          <>
            <Button asChild variant="brand">
              <Link to="/app/lancamentos">
                Lançar documento
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/abastecimentos">
                <FuelIcon className="h-4 w-4" />
                Abastecimentos
              </Link>
            </Button>
          </>
        }
      >
        <PanelLead icon={EntryIcon}>
          {data.entriesToday === 0
            ? 'Nenhum documento lançado hoje.'
            : `${data.entriesToday} documentos registrados no pátio hoje.`}
        </PanelLead>

        <CountTiles
          items={[
            {
              key: 'documentos',
              label: 'Documentos hoje',
              value: data.entriesToday,
              tone: 'neutral',
              hint: 'notas, multas e ordens',
            },
            {
              key: 'valor',
              label: 'Valor lançado hoje',
              value: data.amountToday !== undefined ? formatCurrency(data.amountToday) : 'Restrito',
              tone: 'neutral',
              hint:
                data.amountToday !== undefined
                  ? 'soma dos documentos do dia'
                  : 'seu perfil não vê valores consolidados',
              locked: data.amountToday === undefined,
            },
            {
              key: 'multas',
              label: 'Multas recentes',
              value: fines,
              tone: fines > 0 ? 'attention' : 'neutral',
              hint: 'entre os últimos registros',
            },
          ]}
        />

        {/* Categoria em pastilha, como a faixa de eventos da segurança do
              gestor: é contagem, e não lista. */}
        {data.recentEntries.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ENTRY_KIND_CHIPS.map((chip) => (
              <KindChip
                key={chip.kind}
                icon={chip.icon}
                label={chip.label}
                value={data.recentEntries.filter((entry) => entry.kind === chip.kind).length}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                      */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const { user, tenant } = useSession();
  const { hasPermission } = usePermissions();
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: alerts } = useAlerts();
  const [range, setRange] = useState<DateRangePreset>('7d');
  const [selected, setSelected] = useState<MapVehicleMarker | null>(null);

  const firstName = user?.name.split(' ')[0] ?? '';
  const showsYard = hasPermission('entries.manage');
  const markers = data?.markers ?? [];

  const liveAlerts = (alerts ?? []).filter(
    (a) => a.status !== 'ignored' && a.status !== 'resolved',
  );
  const criticalAlerts = liveAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'high',
  ).length;
  const inProgressAlerts = liveAlerts.filter((a) => a.status === 'in_progress').length;

  return (
    /*
     * Sem `space-y` no container: a fileira de indicadores precisa de margem
     * NEGATIVA para subir na faixa, e a margem do `space-y` vence a do
     * utilitário por especificidade. O espaçamento vertical aqui é explícito.
     */
    <div>
      {/*
       * FAIXA DE ABERTURA, no desenho do `HeroBand` da visão geral do gestor
       * (pedido do usuário em 09/09/2026, depois de a faixa grafite não casar
       * com o resto).
       *
       * É a terracota chapada com texto branco, e as pastilhas de contorno
       * claro no canto oposto, exatamente como em `/gestao`. O grafite com os
       * brilhos saiu: ele era bonito e era de outro produto.
       *
       * ⚠️ Sem rótulo acima do título. O `eyebrow` do `PageBanner` do painel de
       * gestão nem renderiza mais: é regra do piso de qualidade do projeto, o
       * título carrega o próprio peso. Por isso o perfil e a empresa entraram na
       * frase de baixo, que é onde a visão geral do gestor também os põe.
       *
       * O respiro de baixo é maior que o de cima porque é ali que os cards de
       * estado encostam, subindo por cima da borda.
       */}
      <section
        className={cn(
          'text-on-primary rounded-xl bg-primary px-6 pt-8 sm:px-8 sm:pt-10',
          showsYard ? 'pb-24 sm:pb-28' : 'pb-8 sm:pb-10',
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col">
            {/* `-0.03em` fecha o espaço que a Sora deixa entre maiúsculas em
                corpo grande. O piso de tracking do projeto é -0.04em. */}
            <h1 className="font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[36px]">
              {greetingForNow()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-body-lg mt-2 max-w-2xl">
              {user ? `${ROLE_LABELS[user.role]} · ` : ''}
              {showsYard
                ? `Veja o que chegou para tratar${tenant ? ` na ${tenant.name}` : ''} e quais veículos podem sair.`
                : `Acompanhe como a frota${tenant ? ` da ${tenant.name}` : ''} está indo hoje.`}
            </p>
          </div>

          {/* Pastilhas de traço branco, e não um segundo laranja: com a marca
              reduzida a um único #D5623A, fundo e pastilha ficariam do mesmo
              tom. É a mesma solução do `HeroPill` do painel de gestão. */}
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className={HERO_PILL}>
              <CalendarIcon className="h-[15px] w-[15px]" aria-hidden />
              Hoje, {TODAY_FORMAT.format(new Date())}
            </span>
            <span className={HERO_PILL}>
              <ClockIcon className="h-[15px] w-[15px]" aria-hidden />
              Atualizado às {HOUR_FORMAT.format(new Date())}
            </span>
          </div>
        </div>
      </section>

      {/*
       * Duas colunas no monitor, e a maior fica com a rotina de pátio: é o
       * trabalho do dia. À direita fica a consulta rápida, mapa e alertas, que é
       * o que se olha de relance.
       *
       * A checagem de permissão é uma condição, e não um `PermissionGuard`: para
       * quem não lança nota, a coluna simplesmente não existe. O guarda mostraria
       * um "sem acesso" no meio do dashboard de uma área que não é dele.
       */}
      {showsYard && <YardOverview />}

      <div className={cn('mt-8 grid items-start gap-4', showsYard && 'xl:grid-cols-[1.6fr_1fr]')}>
        {showsYard && <YardPanels />}

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Mapa da operação"
            actions={
              <Button asChild variant="outline">
                <Link to="/app/rastreamento">
                  Abrir mapa
                  <ArrowUpRightIcon className="h-4 w-4" />
                </Link>
              </Button>
            }
          >
            {/* Fila de placas, como no mapa da visão geral do gestor: clicar
                centra a leitura num veículo sem obrigar a caçar o alfinete. */}
            {markers.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
                {markers.map((marker) => {
                  const active = selected?.id === marker.id;
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={() => setSelected(active ? null : marker)}
                      aria-pressed={active}
                      /* `shrink-0` é o que faz a faixa rolar: sem ele o flex
                         espreme as pastilhas até caberem todas, e a placa fica
                         ilegível. */
                      /* ⚠️ Ativo e hover são EXCLUSIVOS, e a pastilha ativa é
                         preta, nunca terracota: é a regra do mesmo cartão no
                         painel de gestão. Somados, o realce do ponteiro apagava
                         a pastilha da placa escolhida. */
                      className={cn(
                        'font-display shrink-0 rounded-pill px-3 py-1.5 text-[13px] font-bold tabular-nums transition-colors',
                        active
                          ? 'bg-foreground text-background'
                          : 'bg-on-surface/[0.06] text-muted-foreground hover:bg-on-surface/[0.11]',
                      )}
                    >
                      {marker.plate}
                    </button>
                  );
                })}
              </div>
            )}

            <OperationMap
              markers={markers}
              selectedId={selected?.id}
              onSelect={setSelected}
              heightClassName="h-64 xl:h-72"
            />

            {selected && (
              <p className="text-body-md mt-4 border-t border-border pt-4 text-muted-foreground">
                <span className="font-display font-bold text-foreground">{selected.plate}</span> ·{' '}
                {selected.position.city}/{selected.position.state}
              </p>
            )}
          </Panel>

          <Panel
            title="Alertas"
            actions={
              <Button asChild variant="outline">
                <Link to="/app/alertas">
                  Ver alertas
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </Button>
            }
          >
            <PanelLead icon={BellIcon}>
              {liveAlerts.length === 0
                ? 'Nenhum alerta em aberto agora.'
                : `${liveAlerts.length} alertas ativos na operação.`}
            </PanelLead>

            <CountTiles
              stacked
              items={[
                {
                  key: 'criticos',
                  label: 'Críticos e altos',
                  value: criticalAlerts,
                  tone: criticalAlerts > 0 ? 'critical' : 'neutral',
                  hint: 'exigem tratativa hoje',
                },
                {
                  key: 'tratativa',
                  label: 'Em tratativa',
                  value: inProgressAlerts,
                  tone: 'neutral',
                  hint: 'alguém já está olhando',
                },
                {
                  key: 'abertos',
                  label: 'Sem responsável',
                  value: liveAlerts.filter((a) => a.status === 'open').length,
                  tone: 'attention',
                  hint: 'ninguém assumiu ainda',
                },
              ]}
            />
          </Panel>
        </div>
      </div>

      {isError ? (
        <div className="mt-10">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : (
        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              icon={ChartBarIcon}
              title="Visão da frota"
              description="Indicadores e leitura do período selecionado."
            />
            {/* O seletor governa os gráficos, e por isso mora aqui: na faixa de
                abertura ele parecia filtrar a tela inteira. */}
            <DateRangeSelector value={range} onChange={setRange} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data
              ? Array.from({ length: 4 }).map((_, i) => (
                  <MetricCard key={i} label="" value="" loading />
                ))
              : data.metrics.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                    trend={metric.trend}
                  />
                ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Performance da frota"
              description="Pontualidade x entregas no prazo (%)"
            >
              <TrendAreaChart
                data={data?.charts.fleetPerformance ?? []}
                /* ⚠️ Paleta CATEGÓRICA (`chart-1`, `chart-2`), e não as cores de
                   marca. O `accent` é o marinho fechado #010066: numa linha de
                   2px ele lê como preta, e foi para isso que a série 2 ganhou o
                   #2A2F9E na paleta. A ordem é fixa: série nunca troca de cor
                   quando um filtro muda a contagem. */
                series={[
                  { key: 'pontualidade', label: 'Pontualidade', color: 'var(--color-chart-1)' },
                  { key: 'entregas', label: 'Entregas', color: 'var(--color-chart-2)' },
                ]}
              />
            </ChartCard>

            <ChartCard title="Consumo de combustível" description="Litros consumidos por dia">
              <SimpleBarChart
                data={data?.charts.fuelConsumption ?? []}
                dataKey="litros"
                label="Litros"
                color="var(--color-chart-1)"
              />
            </ChartCard>
          </div>
        </section>
      )}
    </div>
  );
}
