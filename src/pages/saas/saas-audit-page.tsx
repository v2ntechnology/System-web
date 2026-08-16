import { ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { SAAS_AUDIT } from '@/mocks/saas';

export default function SaasAuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Registro de eventos administrativos da plataforma."
      />
      <Card>
        <CardContent className="divide-y divide-border/60 pt-6">
          {SAAS_AUDIT.map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                <ScrollText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm">{event.action}</p>
                <p className="text-xs text-muted-foreground">
                  {event.actor} · {formatDateTime(event.date)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
