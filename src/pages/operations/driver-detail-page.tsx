import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { InfoCard } from '@/components/shared/cards';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useDriver } from '@/hooks/use-queries';
import { formatDate, getInitials, formatPercent } from '@/lib/format';
import { driverStatusDescriptor } from '@/lib/status-maps';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function DriverDetailPage() {
  const { driverId = '' } = useParams();
  const navigate = useNavigate();
  const { data: driver, isLoading, isError, refetch } = useDriver(driverId);

  if (isLoading) return <LoadingState label="Carregando motorista…" />;
  if (isError || !driver) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/motoristas')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">{driver.name}</h1>
          <p className="text-sm text-muted-foreground">Matrícula {driver.registration}</p>
        </div>
        <StatusBadge descriptor={driverStatusDescriptor(driver.status)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Pontuação de direção"
          value={driver.drivingScore}
          accent={driver.drivingScore >= 85 ? 'success' : 'warning'}
        />
        <InfoCard label="Consumo médio" value={`${driver.avgConsumptionKmL} km/L`} accent="info" />
        <InfoCard
          label="Entregas no prazo"
          value={formatPercent(driver.onTimeDeliveryRate)}
          accent="success"
        />
        <InfoCard
          label="Alertas de segurança"
          value={driver.safetyAlerts}
          icon={ShieldAlert}
          accent={driver.safetyAlerts > 0 ? 'destructive' : 'default'}
        />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Habilitação e vínculo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <InfoRow label="Categoria CNH" value={driver.cnhCategory} />
          <Separator />
          <InfoRow label="Validade CNH" value={formatDate(driver.cnhExpiration)} />
          <Separator />
          <InfoRow label="Veículo atual" value={driver.currentVehiclePlate ?? '—'} />
        </CardContent>
      </Card>
    </div>
  );
}
