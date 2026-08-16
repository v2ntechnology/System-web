import {
  Camera,
  Fuel,
  Gavel,
  MessageCircle,
  Radar,
  Satellite,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionGuard, PlanGuard } from '@/components/shared/guards';

type IntegrationStatus = 'connected' | 'disconnected' | 'error';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: IntegrationStatus;
  lastSync?: string;
}

const STATUS_BADGE: Record<
  IntegrationStatus,
  { label: string; variant: 'success' | 'muted' | 'destructive' }
> = {
  connected: { label: 'Conectado', variant: 'success' },
  disconnected: { label: 'Não conectado', variant: 'muted' },
  error: { label: 'Erro de sincronização', variant: 'destructive' },
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'telemetry',
    name: 'Telemetria',
    description: 'Dados de motor, RPM, temperatura e freio motor.',
    icon: Satellite,
    status: 'connected',
    lastSync: 'há 3 minutos',
  },
  {
    id: 'tracking',
    name: 'Rastreamento',
    description: 'Posição GPS em tempo real da frota.',
    icon: Radar,
    status: 'connected',
    lastSync: 'há 1 minuto',
  },
  {
    id: 'fuel',
    name: 'Abastecimento',
    description: 'Integração com redes de postos e cartões.',
    icon: Fuel,
    status: 'error',
    lastSync: 'há 2 horas',
  },
  {
    id: 'fines',
    name: 'Multas',
    description: 'Consulta automática de infrações nos órgãos.',
    icon: Gavel,
    status: 'disconnected',
  },
  {
    id: 'erp',
    name: 'ERP',
    description: 'Sincronização de custos, notas e ordens.',
    icon: Boxes,
    status: 'disconnected',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Notificações e checklists via WhatsApp.',
    icon: MessageCircle,
    status: 'connected',
    lastSync: 'há 20 minutos',
  },
  {
    id: 'cameras',
    name: 'Câmeras e visão computacional',
    description: 'Detecção de fadiga e eventos em cabine.',
    icon: Camera,
    status: 'disconnected',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Conecte fontes de dados externas para enriquecer a inteligência da plataforma."
      />

      <PermissionGuard permission="integrations.manage">
        <PlanGuard module="integrations">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.map((integration) => {
              const Icon = integration.icon;
              const badge = STATUS_BADGE[integration.status];
              return (
                <Card key={integration.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {integration.lastSync
                          ? `Última sincronização ${integration.lastSync}`
                          : 'Nunca sincronizado'}
                      </span>
                      <Button variant="outline" size="sm">
                        {integration.status === 'connected' ? 'Configurar' : 'Conectar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PlanGuard>
      </PermissionGuard>
    </div>
  );
}
