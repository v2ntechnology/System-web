import { ReportIcon, ShieldCheckIcon } from '@/components/icons';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import { InfoCard } from '@/components/shared/cards';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/lib/format';
import { useSaasStore } from '@/stores/saas-store';
import { PLATFORM_ROLE_LABEL, type AuditKind, type SaasAuditEntry } from '@/mocks/saas';

/**
 * Trilha de auditoria da plataforma, em duas abas.
 *
 * A separação não é cosmética. O acesso de suporte é a exceção deliberada à
 * regra de que a empresa vem sempre do token: o TI Operacional lê dados de
 * cliente passando o cabeçalho da empresa. Misturar essas linhas com "fulano
 * aprovou uma solicitação" esconderia justamente o que precisa ser conferível.
 */
export default function SaasAuditPage() {
  const audit = useSaasStore((s) => s.audit);
  const tenants = useSaasStore((s) => s.tenants);

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');

  const filter = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (kind: AuditKind) =>
      audit
        .filter((e) => e.kind === kind)
        .filter((e) => tenantFilter === 'all' || e.tenant === tenantFilter)
        .filter(
          (e) =>
            !term ||
            e.action.toLowerCase().includes(term) ||
            e.actor.toLowerCase().includes(term) ||
            (e.tenant ?? '').toLowerCase().includes(term) ||
            (e.route ?? '').toLowerCase().includes(term),
        );
  }, [audit, search, tenantFilter]);

  const adminEntries = filter('admin');
  const supportEntries = filter('support');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Tudo que a equipe da RookHub fez no backoffice e todo acesso de suporte aos dados de um cliente."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          label="Eventos administrativos"
          value={audit.filter((e) => e.kind === 'admin').length}
          icon={ReportIcon}
        />
        <InfoCard
          label="Acessos de suporte"
          value={audit.filter((e) => e.kind === 'support').length}
          icon={ShieldCheckIcon}
          accent="info"
        />
        <InfoCard
          label="Empresas tocadas pelo suporte"
          value={new Set(audit.filter((e) => e.kind === 'support').map((e) => e.tenant)).size}
        />
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por ação, pessoa, empresa ou rota"
          className="w-full md:max-w-sm"
          aria-label="Buscar na auditoria"
        />
        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-[220px]" aria-label="Filtrar por transportadora">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as transportadoras</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">Administração ({adminEntries.length})</TabsTrigger>
          <TabsTrigger value="support">Acessos de suporte ({supportEntries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="admin" className="mt-4">
          <AuditList entries={adminEntries} />
        </TabsContent>

        <TabsContent value="support" className="mt-4 space-y-4">
          <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">
            <p className="mb-1 font-semibold text-info-on-light">Leitura, e só leitura</p>
            Qualquer método diferente de GET é recusado antes de chegar ao controller, e toda
            requisição grava quem, quando, qual empresa e qual rota. É o que torna aceitável a única
            exceção à regra de que a empresa vem sempre do token.
          </div>
          <AuditList entries={supportEntries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditList({ entries }: { entries: SaasAuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ReportIcon}
        title="Nenhum evento encontrado"
        description="Ajuste a busca ou o filtro de transportadora."
      />
    );
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border/60 pt-6">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div
              className={
                entry.kind === 'support'
                  ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info/15 text-info-on-light'
                  : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground'
              }
            >
              {entry.kind === 'support' ? (
                <ShieldCheckIcon className="h-4 w-4" />
              ) : (
                <ReportIcon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">{entry.action}</p>
                {entry.tenant && <Badge variant="muted">{entry.tenant}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {entry.actor} · {PLATFORM_ROLE_LABEL[entry.actorRole]} · {formatDateTime(entry.at)}
              </p>
              {entry.route && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {entry.method} {entry.route}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
