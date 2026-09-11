import { CheckIcon, InboxIcon, MailIcon, PhoneIcon, XCircleIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { DetailDrawer } from '@/components/shared/detail-drawer';
import { EmptyState } from '@/components/shared/states';
import { FilterBar, SearchInput } from '@/components/shared/filters';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatNumber } from '@/lib/format';
import { accessRequestDescriptor } from '@/lib/status-maps';
import { useSession } from '@/hooks/use-session';
import { useSaasStore, type ApprovalInput } from '@/stores/saas-store';
import { type SaasAccessRequest } from '@/mocks/saas';
import type { AccessRequestStatus } from '@/types';

import { ApprovalWizard } from './approval-wizard';
import { DefinitionRow } from './saas-ui';

type StatusFilter = AccessRequestStatus | 'all';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Aguardando' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Recusadas' },
  { value: 'all', label: 'Todas' },
];

/**
 * Fila de pedidos de acesso vindos do site institucional.
 *
 * É a porta de entrada da plataforma: hoje não existe nenhum caminho para criar
 * acesso, e é aqui que ele nasce. Decidir uma solicitação não é um sim ou não:
 * aprovar abre o assistente que parametriza o ambiente inteiro.
 */
export default function SaasRequestsPage() {
  const { user } = useSession();
  const actor = user?.name ?? 'Administração';

  const requests = useSaasStore((s) => s.requests);
  const tenants = useSaasStore((s) => s.tenants);
  const approveRequest = useSaasStore((s) => s.approveRequest);
  const rejectRequest = useSaasStore((s) => s.rejectRequest);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardId, setWizardId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const inWizard = requests.find((r) => r.id === wizardId) ?? null;
  const rejecting = requests.find((r) => r.id === rejectingId) ?? null;

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests
      .filter((r) => status === 'all' || r.status === status)
      .filter(
        (r) =>
          !term ||
          r.company.toLowerCase().includes(term) ||
          r.contactEmail.toLowerCase().includes(term) ||
          r.document.includes(term),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requests, search, status]);

  function handleApprove(input: ApprovalInput) {
    if (!wizardId) return;
    approveRequest(wizardId, input, actor);
    setSelectedId(null);
    toast.success('Ambiente em provisionamento', {
      description: `${input.name} · ${input.slug}.rookhub.com.br. O convite do Dono sai quando o schema ficar pronto.`,
    });
  }

  function handleReject() {
    if (!rejectingId || !reason.trim()) return;
    rejectRequest(rejectingId, reason.trim(), actor);
    setRejectingId(null);
    setSelectedId(null);
    setReason('');
    toast.success('Solicitação recusada', { description: 'O contato foi notificado por e-mail.' });
  }

  const columns: DataTableColumn<SaasAccessRequest>[] = [
    {
      id: 'company',
      header: 'Transportadora',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.company}</p>
          <p className="text-xs text-muted-foreground">{r.document}</p>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contato',
      cell: (r) => (
        <div>
          <p className="text-sm">{r.contactName}</p>
          <p className="text-xs text-muted-foreground">{r.contactEmail}</p>
        </div>
      ),
    },
    {
      id: 'place',
      header: 'Praça',
      cell: (r) => (
        <span className="text-sm">
          {r.city}/{r.state}
        </span>
      ),
    },
    {
      id: 'fleet',
      header: 'Frota',
      align: 'right',
      cell: (r) => formatNumber(r.fleetSize),
    },
    {
      id: 'provider',
      header: 'Rastreamento declarado',
      cell: (r) => <Badge variant="muted">{r.declaredProvider}</Badge>,
    },
    { id: 'created', header: 'Recebida em', cell: (r) => formatDateTime(r.createdAt) },
    {
      id: 'status',
      header: 'Situação',
      cell: (r) => <StatusBadge descriptor={accessRequestDescriptor(r.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitações de acesso"
        description="Pedidos recebidos pelo site institucional. Aprovar parametriza e provisiona o ambiente da transportadora."
        actions={
          pendingCount > 0 ? (
            <Badge variant="warning">
              {pendingCount} {pendingCount === 1 ? 'aguardando' : 'aguardando decisão'}
            </Badge>
          ) : undefined
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por empresa, e-mail ou CNPJ"
          className="w-full md:max-w-sm"
          aria-label="Buscar solicitações"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyState={
          <EmptyState
            icon={InboxIcon}
            title="Nenhuma solicitação nesta situação"
            description="Pedidos novos chegam pelo formulário do site institucional e avisam o time por e-mail."
          />
        }
      />

      <RequestDrawer
        request={selected}
        onClose={() => setSelectedId(null)}
        onApprove={() => selected && setWizardId(selected.id)}
        onReject={() => selected && setRejectingId(selected.id)}
      />

      <ApprovalWizard
        request={inWizard}
        tenants={tenants}
        open={wizardId !== null}
        onOpenChange={(open) => !open && setWizardId(null)}
        onConfirm={handleApprove}
      />

      <Dialog
        open={rejectingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(null);
            setReason('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recusar {rejecting?.company}</DialogTitle>
            <DialogDescription>
              O motivo vai no e-mail enviado ao contato. Escreva algo que a transportadora consiga
              usar, porque é a única resposta que ela recebe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: frota abaixo do porte mínimo atendido pelo plano Starter."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim()}>
              Recusar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ficha da solicitação                                                        */
/* -------------------------------------------------------------------------- */

function RequestDrawer({
  request,
  onClose,
  onApprove,
  onReject,
}: {
  request: SaasAccessRequest | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!request) return null;
  const pending = request.status === 'pending';

  return (
    <DetailDrawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={request.company}
      description={`${request.city}/${request.state} · ${request.document}`}
      footer={
        pending ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onReject}>
              <XCircleIcon className="h-4 w-4" />
              Recusar
            </Button>
            <Button className="flex-1" onClick={onApprove}>
              <CheckIcon className="h-4 w-4" />
              Aprovar
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <StatusBadge descriptor={accessRequestDescriptor(request.status)} />
        </div>

        <section>
          <h3 className="mb-1 font-display text-sm font-semibold">Contato</h3>
          <DefinitionRow label="Responsável" value={request.contactName} />
          <DefinitionRow
            label="E-mail"
            value={
              <a
                href={`mailto:${request.contactEmail}`}
                className="inline-flex items-center gap-1.5 text-accent hover:underline"
              >
                <MailIcon className="h-3.5 w-3.5" />
                {request.contactEmail}
              </a>
            }
          />
          <DefinitionRow
            label="Telefone"
            value={
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {request.contactPhone}
              </span>
            }
          />
        </section>

        <section>
          <h3 className="mb-1 font-display text-sm font-semibold">Operação declarada</h3>
          <DefinitionRow label="Frota" value={`${formatNumber(request.fleetSize)} veículos`} />
          <DefinitionRow label="Rastreamento" value={request.declaredProvider} />
          <DefinitionRow label="Recebida em" value={formatDateTime(request.createdAt)} />
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Mensagem</h3>
          <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {request.message}
          </p>
        </section>

        {request.status !== 'pending' && (
          <section>
            <h3 className="mb-1 font-display text-sm font-semibold">Decisão</h3>
            <DefinitionRow label="Por" value={request.decidedBy ?? '—'} />
            <DefinitionRow
              label="Em"
              value={request.decidedAt ? formatDateTime(request.decidedAt) : '—'}
            />
            {request.rejectionReason && (
              <DefinitionRow label="Motivo" value={request.rejectionReason} />
            )}
          </section>
        )}
      </div>
    </DetailDrawer>
  );
}
