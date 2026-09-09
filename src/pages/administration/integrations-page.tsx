import {
  ApprovalIcon,
  BoxesIcon,
  CameraIcon,
  ChatIcon,
  CheckCircleIcon,
  FuelIcon,
  IntegrationIcon,
  RadarIcon,
  SatelliteIcon,
  WarningIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HeroStats,
  LightCard,
  PageHero,
  PagePanel,
  type HeroStat,
} from '@/components/layout/page-hero';
import { PermissionGuard, PlanGuard } from '@/components/shared/guards';
import { usePermissions } from '@/hooks/use-session';

type IntegrationStatus = 'connected' | 'disconnected' | 'error';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: IconType;
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
    icon: SatelliteIcon,
    status: 'connected',
    lastSync: 'há 3 minutos',
  },
  {
    id: 'tracking',
    name: 'Rastreamento',
    description: 'Posição GPS em tempo real da frota.',
    icon: RadarIcon,
    status: 'connected',
    lastSync: 'há 1 minuto',
  },
  {
    id: 'fuel',
    name: 'Abastecimento',
    description: 'Integração com redes de postos e cartões.',
    icon: FuelIcon,
    status: 'error',
    lastSync: 'há 2 horas',
  },
  {
    id: 'fines',
    name: 'Multas',
    description: 'Consulta automática de infrações nos órgãos.',
    icon: ApprovalIcon,
    status: 'disconnected',
  },
  {
    id: 'erp',
    name: 'ERP',
    description: 'Sincronização de custos, notas e ordens.',
    icon: BoxesIcon,
    status: 'disconnected',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Notificações e checklists via WhatsApp.',
    icon: ChatIcon,
    status: 'connected',
    lastSync: 'há 20 minutos',
  },
  {
    id: 'cameras',
    name: 'Câmeras e visão computacional',
    description: 'Detecção de fadiga e eventos em cabine.',
    icon: CameraIcon,
    status: 'disconnected',
  },
];

export default function IntegrationsPage() {
  /* Mesma permissão do conteúdo: o cabeçalho não conta o que a tela nega. */
  const { hasPermission } = usePermissions();
  const canSee = hasPermission('integrations.manage');

  const connected = INTEGRATIONS.filter((i) => i.status === 'connected').length;
  const failing = INTEGRATIONS.filter((i) => i.status === 'error').length;

  const stats: HeroStat[] = [
    {
      key: 'disponiveis',
      label: 'Disponíveis',
      value: INTEGRATIONS.length,
      hint: 'fontes que a plataforma fala',
      icon: IntegrationIcon,
    },
    {
      key: 'conectadas',
      label: 'Conectadas',
      value: connected,
      hint: 'trazendo dados agora',
      icon: CheckCircleIcon,
    },
    {
      key: 'erro',
      label: 'Com erro',
      value: failing,
      hint: failing > 0 ? 'sincronização falhando' : 'nenhuma falhando',
      icon: WarningIcon,
      tone: failing > 0 ? 'alert' : 'neutral',
    },
    {
      key: 'desconectadas',
      label: 'Desconectadas',
      value: INTEGRATIONS.length - connected - failing,
      hint: 'nunca configuradas',
      icon: SatelliteIcon,
    },
  ];

  return (
    /* Sem `space-y` no container: a fileira de números sobe com margem NEGATIVA,
       e a margem do utilitário vence a dela por especificidade. */
    <div>
      <PageHero
        title="Integrações"
        description="Conecte fontes de dados externas para enriquecer a inteligência da plataforma."
        bleed={canSee}
      />

      {canSee && <HeroStats items={stats} />}

      <PagePanel className={canSee ? undefined : 'mt-6'}>
        <PermissionGuard permission="integrations.manage">
          <PlanGuard module="integrations">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {INTEGRATIONS.map((integration) => {
                const Icon = integration.icon;
                const badge = STATUS_BADGE[integration.status];
                return (
                  <LightCard
                    key={integration.id}
                    title={
                      <span className="flex items-center gap-3">
                        <span className="bg-light-container text-primary-on-light flex h-10 w-10 items-center justify-center rounded-lg">
                          <Icon className="h-5 w-5" />
                        </span>
                        {integration.name}
                      </span>
                    }
                    action={<Badge variant={badge.variant}>{badge.label}</Badge>}
                  >
                    <div className="space-y-4">
                      <p className="text-on-light-muted text-sm">{integration.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-on-light-muted text-xs">
                          {integration.lastSync
                            ? `Última sincronização ${integration.lastSync}`
                            : 'Nunca sincronizado'}
                        </span>
                        <Button variant="outline" size="sm">
                          {integration.status === 'connected' ? 'Configurar' : 'Conectar'}
                        </Button>
                      </div>
                    </div>
                  </LightCard>
                );
              })}
            </div>
          </PlanGuard>
        </PermissionGuard>
      </PagePanel>
    </div>
  );
}
