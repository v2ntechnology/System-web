import { ArrowLeft, MapPin } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTrips } from '@/hooks/use-queries';
import { formatDateTime } from '@/lib/format';
import { tripStatusDescriptor } from '@/lib/status-maps';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function TripDetailPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTrips();

  if (isLoading) return <LoadingState label="Carregando viagem…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const trip = (data ?? []).find((t) => t.id === tripId);
  if (!trip)
    return (
      <ErrorState title="Viagem não encontrada" description="A viagem solicitada não existe." />
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/viagens')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {trip.origin} → {trip.destination}
          </h1>
          <p className="text-sm text-muted-foreground">
            {trip.vehiclePlate} · {trip.driverName} · {trip.distanceKm} km
          </p>
        </div>
        <StatusBadge descriptor={tripStatusDescriptor(trip.status)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes da viagem</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <InfoRow label="Origem" value={trip.origin} />
            <Separator />
            <InfoRow label="Destino" value={trip.destination} />
            <Separator />
            <InfoRow label="Início" value={formatDateTime(trip.startDate)} />
            <Separator />
            <InfoRow label="Previsão de chegada" value={formatDateTime(trip.eta)} />
            <Separator />
            <InfoRow label="Distância" value={`${trip.distanceKm} km`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Percurso concluído</span>
                <span className="font-medium">{trip.progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-gradient"
                  style={{ width: `${trip.progressPercent}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <MapPin className="h-4 w-4 text-primary" />O acompanhamento em mapa em tempo real
              ficará disponível com a integração de rastreamento.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
