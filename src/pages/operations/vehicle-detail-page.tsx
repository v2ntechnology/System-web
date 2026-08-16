import { ArrowLeft, Gauge, MapPin, Wrench } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState, EmptyState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAlerts,
  useChecklists,
  useFines,
  useFuel,
  useMaintenance,
  useTrips,
  useVehicle,
} from '@/hooks/use-queries';
import { formatDate, formatDateTime, formatCurrency, formatKm } from '@/lib/format';
import {
  alertStatusDescriptor,
  checklistStatusDescriptor,
  criticalityDescriptor,
  fineStatusDescriptor,
  maintenanceStatusDescriptor,
  tripStatusDescriptor,
  vehicleStatusDescriptor,
} from '@/lib/status-maps';
import { VEHICLE_TYPE_LABEL } from '@/mocks/fleet/vehicles';

const TABS = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'telemetry', label: 'Telemetria' },
  { value: 'trips', label: 'Viagens' },
  { value: 'fuel', label: 'Abastecimentos' },
  { value: 'maintenance', label: 'Manutenções' },
  { value: 'fines', label: 'Multas' },
  { value: 'checklists', label: 'Checklists' },
  { value: 'alerts', label: 'Alertas' },
  { value: 'documents', label: 'Documentos' },
];

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function VehicleDetailPage() {
  const { vehicleId = '' } = useParams();
  const navigate = useNavigate();
  const { data: vehicle, isLoading, isError, refetch } = useVehicle(vehicleId);

  const { data: trips } = useTrips();
  const { data: fuel } = useFuel('');
  const { data: maintenance } = useMaintenance();
  const { data: fines } = useFines();
  const { data: checklists } = useChecklists();
  const { data: alerts } = useAlerts();

  if (isLoading) return <LoadingState label="Carregando veículo…" />;
  if (isError || !vehicle) return <ErrorState onRetry={() => refetch()} />;

  const plate = vehicle.plate;
  const vTrips = (trips ?? []).filter((x) => x.vehiclePlate === plate);
  const vFuel = (fuel ?? []).filter((x) => x.vehiclePlate === plate);
  const vMaint = (maintenance ?? []).filter((x) => x.vehiclePlate === plate);
  const vFines = (fines ?? []).filter((x) => x.vehiclePlate === plate);
  const vChecklists = (checklists ?? []).filter((x) => x.vehiclePlate === plate);
  const vAlerts = (alerts ?? []).filter((x) => x.vehiclePlate === plate);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/veiculos')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {vehicle.fleetNumber} · <span className="font-mono">{plate}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.manufacturer} {vehicle.model} · {VEHICLE_TYPE_LABEL[vehicle.type]} ·{' '}
              {vehicle.year}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge descriptor={vehicleStatusDescriptor(vehicle.status)} />
            <StatusBadge descriptor={criticalityDescriptor(vehicle.criticality)} withDot={false} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Gauge className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-xl font-bold">{formatKm(vehicle.mileageKm)}</p>
              <p className="text-xs text-muted-foreground">Quilometragem atual</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Wrench className="h-5 w-5 text-warning" />
            <div>
              <p className="font-display text-xl font-bold">
                {vehicle.nextMaintenanceDate ? formatDate(vehicle.nextMaintenanceDate) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Próxima manutenção</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <MapPin className="h-5 w-5 text-accent" />
            <div>
              <p className="font-display text-xl font-bold">
                {vehicle.lastPosition
                  ? `${vehicle.lastPosition.city}/${vehicle.lastPosition.state}`
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Última posição</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do veículo</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Placa" value={<span className="font-mono">{plate}</span>} />
                <Separator />
                <InfoRow label="Fabricante" value={vehicle.manufacturer} />
                <Separator />
                <InfoRow label="Modelo" value={vehicle.model} />
                <Separator />
                <InfoRow label="Tipo" value={VEHICLE_TYPE_LABEL[vehicle.type]} />
                <Separator />
                <InfoRow label="Unidade" value={vehicle.unit} />
                <Separator />
                <InfoRow label="Motorista atual" value={vehicle.currentDriver?.name ?? '—'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Situação operacional</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow
                  label="Status"
                  value={<StatusBadge descriptor={vehicleStatusDescriptor(vehicle.status)} />}
                />
                <Separator />
                <InfoRow
                  label="Criticidade"
                  value={
                    <StatusBadge
                      descriptor={criticalityDescriptor(vehicle.criticality)}
                      withDot={false}
                    />
                  }
                />
                <Separator />
                <InfoRow label="Alertas ativos" value={vAlerts.length} />
                <Separator />
                <InfoRow label="Viagens registradas" value={vTrips.length} />
                <Separator />
                <InfoRow label="Última atualização" value={formatDateTime(vehicle.updatedAt)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="telemetry">
          <EmptyState
            icon={Gauge}
            title="Telemetria em tempo real"
            description="Os dados de telemetria (RPM, temperatura, freio motor, posição) serão exibidos aqui quando a integração de telemetria estiver conectada."
          />
        </TabsContent>

        <TabsContent value="trips">
          {vTrips.length === 0 ? (
            <EmptyState
              title="Nenhuma viagem"
              description="Este veículo ainda não possui viagens registradas."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-medium">
                        {trip.origin} → {trip.destination}
                      </TableCell>
                      <TableCell>{trip.driverName}</TableCell>
                      <TableCell>
                        <StatusBadge descriptor={tripStatusDescriptor(trip.status)} />
                      </TableCell>
                      <TableCell className="text-right">{trip.progressPercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fuel">
          {vFuel.length === 0 ? (
            <EmptyState
              title="Sem abastecimentos"
              description="Nenhum abastecimento registrado para este veículo."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Posto</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vFuel.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.station}</TableCell>
                      <TableCell className="text-right">{record.liters} L</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(record.totalValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.hasAnomaly ? (
                          <Badge variant="destructive">{record.computedConsumptionKmL} km/L</Badge>
                        ) : (
                          `${record.computedConsumptionKmL} km/L`
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="maintenance">
          {vMaint.length === 0 ? (
            <EmptyState
              title="Sem manutenções"
              description="Nenhuma ordem de manutenção para este veículo."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Oficina</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Custo estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vMaint.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.title}</TableCell>
                      <TableCell>{order.workshop}</TableCell>
                      <TableCell>
                        <StatusBadge descriptor={maintenanceStatusDescriptor(order.status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.estimatedCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fines">
          {vFines.length === 0 ? (
            <EmptyState
              title="Sem multas"
              description="Nenhuma multa registrada para este veículo."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Infração</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vFines.map((fine) => (
                    <TableRow key={fine.id}>
                      <TableCell className="font-medium">{fine.infractionType}</TableCell>
                      <TableCell>{formatDate(fine.date)}</TableCell>
                      <TableCell>
                        <StatusBadge descriptor={fineStatusDescriptor(fine.status)} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(fine.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checklists">
          {vChecklists.length === 0 ? (
            <EmptyState
              title="Sem checklists"
              description="Nenhuma inspeção registrada para este veículo."
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Irregularidades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vChecklists.map((checklist) => (
                    <TableRow key={checklist.id}>
                      <TableCell>{formatDate(checklist.date)}</TableCell>
                      <TableCell>{checklist.driverName}</TableCell>
                      <TableCell>
                        <StatusBadge descriptor={checklistStatusDescriptor(checklist.status)} />
                      </TableCell>
                      <TableCell className="text-right">{checklist.irregularItems}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts">
          {vAlerts.length === 0 ? (
            <EmptyState title="Sem alertas" description="Nenhum alerta ativo para este veículo." />
          ) : (
            <div className="space-y-2">
              {vAlerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(alert.date)} · {alert.source}
                      </p>
                    </div>
                    <StatusBadge descriptor={alertStatusDescriptor(alert.status)} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <EmptyState
            title="Documentos do veículo"
            description="CRLV, documentos do implemento e demais arquivos ficarão disponíveis aqui quando o módulo de documentos for integrado."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/app/veiculos">Voltar à lista</Link>
              </Button>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
