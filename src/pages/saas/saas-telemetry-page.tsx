import { SatelliteIcon } from '@/components/icons';
import { Link } from 'react-router';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { InfoCard } from '@/components/shared/cards';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { telemetryDescriptor } from '@/lib/status-maps';
import { useSaasStore } from '@/stores/saas-store';
import { TELEMETRY_HINT, TELEMETRY_PROVIDERS, type SaasTenant } from '@/mocks/saas';
import type { TelemetryState } from '@/types';

import { Callout } from './saas-ui';

const STATES: TelemetryState[] = ['CONNECTED', 'PENDING_CONNECTOR', 'PENDING_CONTRACT'];

/**
 * Telemetria de toda a base, por transportadora.
 *
 * A arquitetura de integrações já é multi-fornecedor. O que falta é conector.
 * Esta tela existe para que "cliente sem coleta" seja um número acompanhado, e
 * não uma descoberta feita quando alguém abre a frota e a vê vazia.
 */
export default function SaasTelemetryPage() {
  const tenants = useSaasStore((s) => s.tenants).filter((t) => t.provisioningState === 'READY');

  const countFor = (state: TelemetryState) =>
    tenants.filter((t) => t.telemetryState === state).length;

  const columns: DataTableColumn<SaasTenant>[] = [
    {
      id: 'tenant',
      header: 'Transportadora',
      cell: (t) => (
        <Link to={`/admin-saas/empresas/${t.id}`} className="font-medium hover:underline">
          {t.name}
        </Link>
      ),
    },
    {
      id: 'provider',
      header: 'Fornecedor',
      cell: (t) =>
        t.telemetryProvider ? (
          <Badge variant="muted">{t.telemetryProvider}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Não contratado</span>
        ),
    },
    {
      id: 'state',
      header: 'Estado',
      cell: (t) => <StatusBadge descriptor={telemetryDescriptor(t.telemetryState)} />,
    },
    {
      id: 'hint',
      header: 'O que isso significa',
      cell: (t) => (
        <span className="text-xs text-muted-foreground">{TELEMETRY_HINT[t.telemetryState]}</span>
      ),
    },
    { id: 'vehicles', header: 'Veículos', align: 'right', cell: (t) => t.vehicles },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetria"
        description="Situação da coleta em cada transportadora e cobertura de conectores."
      />

      <Callout tone="warning" icon={SatelliteIcon} title="Só a MiX tem conector implementado">
        Aceitar cliente de outro fornecedor significa entregar ambiente sem telemetria por tempo
        indeterminado. O ambiente é liberado assim mesmo: a decisão é comercial, não técnica.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Coletando" value={countFor('CONNECTED')} accent="success" />
        <InfoCard
          label="Aguardando conector"
          value={countFor('PENDING_CONNECTOR')}
          accent="warning"
        />
        <InfoCard label="Sem contrato" value={countFor('PENDING_CONTRACT')} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fornecedores homologados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TELEMETRY_PROVIDERS.map((provider) => {
            const users = tenants.filter((t) => t.telemetryProvider === provider.label).length;
            return (
              <div
                key={provider.value}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {users} {users === 1 ? 'transportadora' : 'transportadoras'}
                  </p>
                </div>
                <Badge variant={provider.hasConnector ? 'success' : 'muted'}>
                  {provider.hasConnector ? 'Conector pronto' : 'Sem conector'}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {STATES.map((state) => {
          const rows = tenants.filter((t) => t.telemetryState === state);
          if (rows.length === 0) return null;
          return (
            <div key={state} className="space-y-2">
              <h2 className="font-display text-sm font-semibold">
                <StatusBadge descriptor={telemetryDescriptor(state)} />
              </h2>
              <DataTable columns={columns} data={rows} getRowId={(t) => t.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
