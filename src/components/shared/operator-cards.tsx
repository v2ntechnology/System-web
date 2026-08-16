import { useMemo, useState } from 'react';
import { AlertTriangle, Lock, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
};

/* -------------------------------------------------------------------------- */
/* Indicador com valor restrito                                                */
/* -------------------------------------------------------------------------- */

interface YardMetricProps {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warning';
  /**
   * RF-007 — quem não pode ver o valor enxerga o campo bloqueado, não a ausência
   * dele: sumir com o indicador vira chamado de suporte.
   */
  locked?: boolean;
}

export function YardMetric({
  label,
  value,
  hint,
  tone = 'default',
  locked = false,
}: YardMetricProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {locked && <Lock className="h-3 w-3" aria-label="Restrito ao seu perfil" />}
        </p>
        <p
          className={cn(
            'font-display mt-2 text-2xl font-bold tabular-nums',
            locked
              ? 'text-muted-foreground'
              : tone === 'warning'
                ? 'text-warning'
                : 'text-foreground',
          )}
        >
          {value}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento ainda"
            description="Os documentos registrados no pátio aparecem aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">{entry.plate}</span>
                    <Badge variant="outline">{ENTRY_KIND_LABEL[entry.kind]}</Badge>
                    {entry.documentNumber && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {entry.documentNumber}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{entry.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)} · {entry.createdBy}
                  </p>
                </div>

                <p className="text-sm font-semibold tabular-nums">
                  {canSeeAmounts ? (
                    formatCurrency(entry.amount)
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Lock className="h-3 w-3" aria-hidden />
                      Restrito
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
        <CardTitle className="text-base">Pátio</CardTitle>
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
          <Search
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
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
