import { MailIcon, PlusIcon, PowerIcon, ShieldCheckIcon, UnlockIcon } from '@/components/icons';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatDateTime, getInitials } from '@/lib/format';
import { useSession } from '@/hooks/use-session';
import { useSaasStore } from '@/stores/saas-store';
import {
  PLATFORM_ROLE_DESCRIPTION,
  PLATFORM_ROLE_LABEL,
  type SaasPlatformUser,
} from '@/mocks/saas';
import type { PlatformRole } from '@/types';

import { Callout } from './saas-ui';

const ROLES: PlatformRole[] = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'];

/**
 * Equipe interna da RookHub.
 *
 * Papéis **fixos**, e não cargos configuráveis como os da transportadora: são
 * dois, são nossos, e não há por que deixá-los editáveis. As contas vivem fora
 * de qualquer cliente: quem administra a plataforma não entra pela porta de
 * quem opera uma transportadora.
 */
export default function SaasTeamPage() {
  const { user } = useSession();
  const actor = user?.name ?? 'Administração';

  const platformUsers = useSaasStore((s) => s.platformUsers);
  const invitePlatformUser = useSaasStore((s) => s.invitePlatformUser);
  const setPlatformUserActive = useSaasStore((s) => s.setPlatformUserActive);

  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('PLATFORM_SUPPORT');
  const [deactivating, setDeactivating] = useState<SaasPlatformUser | null>(null);

  const admins = platformUsers.filter((u) => u.role === 'PLATFORM_ADMIN' && u.active);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canInvite = name.trim().length > 1 && emailValid;

  function handleInvite() {
    if (!canInvite) return;
    invitePlatformUser({ name: name.trim(), email: email.trim(), role }, actor);
    setInviting(false);
    setName('');
    setEmail('');
    setRole('PLATFORM_SUPPORT');
    toast.success('Convite enviado', {
      description:
        'A pessoa define a senha pelo link e entra com a senha trocada no primeiro acesso.',
    });
  }

  function handleToggle(target: SaasPlatformUser) {
    setPlatformUserActive(target.id, !target.active, actor);
    setDeactivating(null);
    toast.success(target.active ? 'Conta desligada' : 'Conta reativada', {
      description: target.active
        ? 'As sessões abertas são revogadas na hora, então não sobra acesso por até 30 dias.'
        : undefined,
    });
  }

  /* O último TI Topo ativo não pode ser desligado: sem ele ninguém aprova
     transportadora nem cria conta, e a plataforma fica sem dono. */
  const isLastAdmin = (target: SaasPlatformUser) =>
    target.role === 'PLATFORM_ADMIN' && target.active && admins.length === 1;

  const columns: DataTableColumn<SaasPlatformUser>[] = [
    {
      id: 'name',
      header: 'Pessoa',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px]">{getInitials(u.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Papel',
      cell: (u) => (
        <Badge variant={u.role === 'PLATFORM_ADMIN' ? 'default' : 'info'}>
          {PLATFORM_ROLE_LABEL[u.role]}
        </Badge>
      ),
    },
    {
      id: 'lastLogin',
      header: 'Último acesso',
      cell: (u) =>
        u.lastLoginAt ? (
          formatDateTime(u.lastLoginAt)
        ) : (
          <span className="text-muted-foreground">Nunca entrou</span>
        ),
    },
    { id: 'created', header: 'Criada em', cell: (u) => formatDate(u.createdAt) },
    {
      id: 'status',
      header: 'Situação',
      cell: (u) =>
        !u.active ? (
          <Badge variant="muted">Desligada</Badge>
        ) : u.pendingInvite ? (
          <Badge variant="warning">Convite pendente</Badge>
        ) : (
          <Badge variant="success">Ativa</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (u) => (
        <div className="flex justify-end gap-1">
          {u.pendingInvite && u.active && (
            <Button variant="ghost" size="icon" aria-label={`Reenviar convite para ${u.name}`}>
              <MailIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={isLastAdmin(u)}
            onClick={() => (u.active ? setDeactivating(u) : handleToggle(u))}
            aria-label={u.active ? `Desligar ${u.name}` : `Reativar ${u.name}`}
          >
            {u.active ? <PowerIcon className="h-4 w-4" /> : <UnlockIcon className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe RookHub"
        description="Contas da plataforma. Ficam fora de qualquer transportadora e têm papéis fixos."
        actions={
          <Button onClick={() => setInviting(true)}>
            <PlusIcon className="h-4 w-4" />
            Convidar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{PLATFORM_ROLE_LABEL[r]}</CardTitle>
              <Badge variant="muted">
                {platformUsers.filter((u) => u.role === r && u.active).length} ativas
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{PLATFORM_ROLE_DESCRIPTION[r]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Callout tone="info" icon={ShieldCheckIcon} title="Desligar não apaga">
        A conta é desativada e as sessões são revogadas na hora; a anonimização vem depois, pelo
        prazo de retenção. Apagar a linha derrubaria o histórico que a auditoria precisa guardar.
      </Callout>

      <DataTable columns={columns} data={platformUsers} getRowId={(u) => u.id} />

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convidar para a equipe</DialogTitle>
            <DialogDescription>
              A pessoa recebe um link de uso único por e-mail e define a própria senha. Nenhuma
              senha é criada aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Nome</Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@rookhub.com.br"
              />
              {email && !emailValid && (
                <p className="text-xs text-error-on-light">E-mail inválido.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {PLATFORM_ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PLATFORM_ROLE_DESCRIPTION[role]}</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviting(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={!canInvite}>
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Desligar ${deactivating?.name ?? ''}?`}
        description="A conta é desativada e as sessões abertas são revogadas imediatamente. O histórico de auditoria é preservado."
        confirmLabel="Desligar"
        variant="destructive"
        onConfirm={() => deactivating && handleToggle(deactivating)}
      />
    </div>
  );
}
