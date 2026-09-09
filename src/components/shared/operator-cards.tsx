import {
  FuelIcon,
  LockIcon,
  MaintenanceIcon,
  MoneyIcon,
  SearchIcon,
  ShieldAlertIcon,
  WarningIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LightCard } from '@/components/layout/page-hero';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime, formatKm } from '@/lib/format';
import { vehicleStatusDescriptor } from '@/lib/status-maps';
import { cn } from '@/lib/utils';
import type { LaunchEntry, YardVehicle } from '@/services/operator';
import type { VehicleStatus } from '@/types';

/**
 * Blocos da rotina de pátio, compartilhados entre o dashboard do operador e as
 * telas de Lançamentos e Triagem.
 */

const ENTRY_KIND_LABEL: Record<LaunchEntry['kind'], string> = {
  ABASTECIMENTO: 'Abastecimento',
  MULTA: 'Multa',
  ORDEM_MANUTENCAO: 'Ordem de manutenção',
  DESPESA: 'Despesa',
};

/* O tipo passou a ser ÍCONE, e não pastilha de contorno: são só quatro, sempre
   os mesmos, e o desenho se reconhece mais rápido que a leitura. O rótulo
   continua escrito na linha, então o ícone nunca é o único portador. */
const ENTRY_KIND_ICON: Record<LaunchEntry['kind'], IconType> = {
  ABASTECIMENTO: FuelIcon,
  MULTA: ShieldAlertIcon,
  ORDEM_MANUTENCAO: MaintenanceIcon,
  DESPESA: MoneyIcon,
};

/**
 * O pátio veio do painel de gestão, que nomeia os estados em português; o
 * System-web usa os seus. Traduzir aqui evita um segundo mapa de rótulos e
 * cores só para esta tela.
 */
const YARD_STATUS: Record<YardVehicle['status'], VehicleStatus> = {
  EM_VIAGEM: 'on_trip',
  DISPONIVEL: 'available',
  MANUTENCAO: 'maintenance',
  BLOQUEADO: 'alert',
  /* Sem sinal nao e 'parado': ninguem sabe onde o caminhao esta. No painel
     operacional isso e alerta, e nao disponibilidade. */
  SEM_SINAL: 'alert',
};

/* -------------------------------------------------------------------------- */
/* Indicador com valor restrito                                                */
/* -------------------------------------------------------------------------- */

type MetricAccent = 'brand' | 'success' | 'info' | 'warning';

interface YardMetricProps {
  label: string;
  value: string | number;
  /** Denominador. Fora do card do total, é sempre a frota inteira. */
  outOf?: number;
  icon?: IconType;
  accent?: MetricAccent;
  /**
   * `warn` pinta o número; `alert` pinta e contorna o card. O contorno é só da
   * perda de visibilidade, que é o único estado que não é estado da operação: é
   * a parte da frota sobre a qual não se sabe nada.
   */
  tone?: 'neutral' | 'warn' | 'alert';
  /**
   * RF-007: quem não pode ver o valor enxerga o campo bloqueado, não a ausência
   * dele. Sumir com o indicador vira chamado de suporte.
   */
  locked?: boolean;
}

/*
 * O bloco de cor do ícone é o mesmo do `StateCard` da visão geral do gestor:
 * quadrado de 36px, matiz a 10% com o traço cheio por cima. É o que faz o
 * indicador do operador e o do gestor lerem como a mesma peça.
 */
const METRIC_ACCENT: Record<MetricAccent, string> = {
  brand: 'bg-primary-on-light/10 text-primary-on-light',
  success: 'bg-success-on-light/10 text-success-on-light',
  info: 'bg-info-on-light/10 text-info-on-light',
  warning: 'bg-warning-on-light/12 text-warning-on-light',
};

/**
 * Card de estado da frota: ícone, rótulo e o número, com o denominador ao lado.
 *
 * Contexto, e não ação: por isso não há botão nenhum aqui. Quem quiser a lista
 * clica no botão do painel do assunto, logo abaixo na tela.
 */
export function YardMetric({
  label,
  value,
  outOf,
  icon: Icon,
  accent = 'brand',
  tone = 'neutral',
  locked = false,
}: YardMetricProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-5', tone === 'alert' && 'ring-1 ring-warning/35')}>
      {Icon && (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            locked ? 'bg-muted text-muted-foreground' : METRIC_ACCENT[accent],
          )}
          aria-hidden
        >
          <Icon className="h-[17px] w-[17px]" />
        </span>
      )}

      <p className="text-label-sm mt-4 flex items-center gap-1.5 text-on-light-variant normal-case">
        {label}
        {locked && <LockIcon className="h-3 w-3" aria-label="Restrito ao seu perfil" />}
      </p>

      <p
        className={cn(
          'font-display mt-1 text-[30px] font-bold leading-none tabular-nums',
          locked
            ? 'text-on-light-muted'
            : tone === 'neutral'
              ? 'text-on-light'
              : 'text-warning-on-light',
        )}
      >
        {value}
        {outOf !== undefined && (
          <span className="text-body-md font-normal text-on-light-muted"> / {outOf}</span>
        )}
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Lançamentos recentes                                                        */
/* -------------------------------------------------------------------------- */

interface RecentEntriesProps {
  entries: LaunchEntry[];
  /** RF-007 — sem visibilidade financeira, o valor não é exibido. */
  canSeeAmounts: boolean;
  title?: string;
  className?: string;
}

export function RecentEntries({
  entries,
  canSeeAmounts,
  title = 'Lançamentos recentes',
  className,
}: RecentEntriesProps) {
  return (
    <LightCard title={title} className={className}>
      {entries.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento ainda"
          description="Os documentos registrados no pátio aparecem aqui."
        />
      ) : (
        /*
         * Cada lançamento é um BLOCO, e não uma linha separada por fio.
         *
         * ⚠️ O que a linha separada quebrava era a leitura do valor: sem caixa,
         * ele encostava na borda do painel e ficava a mais de mil pixels do
         * documento a que pertence, no monitor grande. O bloco fecha a linha, e
         * o valor volta a ficar ao lado do que ele mede.
         *
         * ⚠️ E no monitor a lista GANHA COLUNA em vez de esticar, que é a regra
         * deste painel: com uma coluna só, cada bloco passava de 1300px e a
         * distância entre o documento e o valor voltava, agora dentro da caixa.
         */
        <ul className="grid gap-2 xl:grid-cols-2">
          {entries.map((entry) => {
            const Icon = ENTRY_KIND_ICON[entry.kind];

            return (
              <li
                key={entry.id}
                className="bg-light-container flex items-start gap-3 rounded-md p-3"
              >
                <span
                  className="bg-primary-on-light/10 text-primary-on-light flex size-9 shrink-0 items-center justify-center rounded-md"
                  aria-hidden="true"
                >
                  <Icon size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-on-light font-semibold tabular-nums">{entry.plate}</span>
                    <span className="text-on-light-variant text-label-md font-medium normal-case">
                      {ENTRY_KIND_LABEL[entry.kind]}
                    </span>
                    {entry.documentNumber && (
                      <span className="text-on-light-muted text-label-md tabular-nums normal-case">
                        {entry.documentNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-on-light-variant mt-0.5 truncate text-sm">
                    {entry.description}
                  </p>
                  <p className="text-on-light-muted text-label-md mt-0.5 normal-case">
                    {formatDateTime(entry.createdAt)} · {entry.createdBy}
                  </p>
                </div>

                {/* Coluna de largura própria: o valor alinha entre as linhas em
                    vez de flutuar até a borda do painel. */}
                <div className="w-28 shrink-0 text-right">
                  {canSeeAmounts ? (
                    <span className="text-on-light font-semibold tabular-nums">
                      {formatCurrency(entry.amount)}
                    </span>
                  ) : (
                    <span className="text-on-light-muted text-label-md inline-flex items-center gap-1 normal-case">
                      <LockIcon className="h-3 w-3" aria-hidden />
                      Restrito
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LightCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Quadro do pátio                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Consulta de apoio, não análise: a pergunta é "esse caminhão pode sair?", e a
 * resposta precisa caber num olhar — por isso o impedimento vem escrito por
 * extenso em vez de virar um ícone que exige interpretação.
 *
 * A busca cobre placa, vaga e motorista: no pátio se procura pelos três.
 */
export function YardBoard({
  vehicles,
  className,
}: {
  vehicles: YardVehicle[];
  className?: string;
}) {
  const [term, setTerm] = useState('');

  const visible = useMemo(() => {
    const needle = term.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!needle) return vehicles;
    return vehicles.filter(
      (vehicle) =>
        vehicle.plate.includes(needle) ||
        (vehicle.bay ?? '').toUpperCase().includes(needle) ||
        (vehicle.driverName ?? '').toUpperCase().includes(needle),
    );
  }, [vehicles, term]);

  const blocked = vehicles.filter((vehicle) => vehicle.blockingReason).length;

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl tracking-tight">Pátio</CardTitle>
        <Badge variant={blocked > 0 ? 'destructive' : 'success'}>
          {blocked === 0
            ? 'Nenhum impedimento'
            : blocked === 1
              ? '1 impedimento'
              : `${blocked} impedimentos`}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Placa, vaga ou motorista"
            aria-label="Buscar no pátio"
            className="pl-9"
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nenhum veículo encontrado"
            description="Revise o termo da busca — ela cobre placa, vaga e motorista."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visible.map((vehicle) => {
              const overdue = vehicle.kmToMaintenance < 0;

              return (
                <li
                  key={vehicle.vehicleId}
                  className={cn(
                    'min-w-0 rounded-xl border border-border bg-muted/30 p-4',
                    vehicle.blockingReason && 'border-destructive/40',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold tabular-nums">{vehicle.plate}</p>
                    <StatusBadge
                      descriptor={vehicleStatusDescriptor(YARD_STATUS[vehicle.status])}
                    />
                  </div>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {vehicle.model}
                    {vehicle.bay ? ` · vaga ${vehicle.bay}` : ' · fora do pátio'}
                  </p>

                  {vehicle.driverName && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {vehicle.driverName}
                    </p>
                  )}

                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Odômetro</dt>
                      <dd className="tabular-nums">{formatKm(vehicle.odometerKm)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Preventiva</dt>
                      <dd
                        className={cn(
                          'tabular-nums',
                          overdue ? 'font-semibold text-destructive' : 'text-foreground',
                        )}
                      >
                        {overdue
                          ? `vencida há ${formatKm(Math.abs(vehicle.kmToMaintenance))}`
                          : `em ${formatKm(vehicle.kmToMaintenance)}`}
                      </dd>
                    </div>
                  </dl>

                  {vehicle.blockingReason ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
                      <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {vehicle.blockingReason}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-success">Sem impedimento para a saída.</p>
                  )}

                  {/* Rastreador que parou de sincronizar não é "tudo certo". */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sincronizado {formatDateTime(vehicle.lastSyncAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
