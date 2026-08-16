import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ProviderStatus = 'operational' | 'degraded';

const PROVIDERS: { name: string; tenants: number; status: ProviderStatus }[] = [
  { name: 'Telemetria (Sascar)', tenants: 5, status: 'operational' },
  { name: 'Rastreamento (Omnilink)', tenants: 6, status: 'operational' },
  { name: 'WhatsApp Business API', tenants: 4, status: 'operational' },
  { name: 'Consulta de multas (Detran)', tenants: 2, status: 'degraded' },
  { name: 'ERP (TOTVS)', tenants: 3, status: 'operational' },
];

const STATUS: Record<ProviderStatus, { label: string; variant: 'success' | 'warning' }> = {
  operational: { label: 'Operacional', variant: 'success' },
  degraded: { label: 'Degradado', variant: 'warning' },
};

export default function SaasIntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Status global dos provedores de integração da plataforma."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((provider) => (
          <Card key={provider.name}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <Badge variant={STATUS[provider.status].variant}>
                {STATUS[provider.status].label}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{provider.tenants} empresas usando</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
