import { KeyIcon, PlusIcon, PowerIcon, ShieldCheckIcon, UnlockIcon } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ApiErrorState, LoadingState } from '@/components/shared/states';
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
import { formatDate, getInitials } from '@/lib/format';
import { ApiError } from '@/services/http';
import {
  createPlatformUser,
  resetPlatformUserPassword,
  SAAS_KEYS,
  setPlatformUserActive,
  usePlatformUsers,
} from './saas-api';
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
  const queryClient = useQueryClient();
  const consulta = usePlatformUsers();
  const platformUsers = consulta.data ?? [];

  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('PLATFORM_SUPPORT');
  const [deactivating, setDeactivating] = useState<SaasPlatformUser | null>(null);
  const [redefinindo, setRedefinindo] = useState<SaasPlatformUser | null>(null);
  /**
   * A senha provisória recém-criada.
   *
   * ⚠️ **Ela volta UMA vez, na resposta, e não há rota que a leia depois.** Por
   * isso ela fica na tela até alguém fechar o aviso, em vez de virar um toast
   * que some sozinho: um toast perdido custaria uma redefinição.
   */
  const [senhaProvisoria, setSenhaProvisoria] = useState<{ pessoa: string; senha: string } | null>(
    null,
  );

  const admins = platformUsers.filter((u) => u.role === 'PLATFORM_ADMIN' && u.active);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canInvite = name.trim().length > 1 && emailValid;

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: SAAS_KEYS.platformUsers });
  };

  const avisarErro = (causa: unknown, alternativa: string) =>
    toast.error(causa instanceof ApiError ? causa.message : alternativa);

  const admissao = useMutation({
    mutationFn: () => createPlatformUser({ name: name.trim(), email: email.trim(), role }),
    onSuccess: (criada) => {
      setInviting(false);
      const pessoa = name.trim();
      setName('');
      setEmail('');
      setRole('PLATFORM_SUPPORT');
      recarregar();
      if (criada.temporaryPassword) {
        setSenhaProvisoria({ pessoa, senha: criada.temporaryPassword });
      } else {
        toast.success('Conta criada', {
          description: 'A pessoa troca a senha no primeiro acesso.',
        });
      }
    },
    onError: (causa) => avisarErro(causa, 'Não foi possível criar a conta.'),
  });

  const situacao = useMutation({
    mutationFn: (alvo: SaasPlatformUser) => setPlatformUserActive(alvo.id, !alvo.active),
    onSuccess: (_resultado, alvo) => {
      setDeactivating(null);
      recarregar();
      toast.success(alvo.active ? 'Conta desligada' : 'Conta reativada', {
        description: alvo.active
          ? 'As sessões abertas são revogadas na hora, então não sobra acesso por até 30 dias.'
          : 'A senha antiga volta a valer.',
      });
    },
    onError: (causa) => avisarErro(causa, 'Não foi possível alterar a conta.'),
  });

  const redefinicao = useMutation({
    mutationFn: (alvo: SaasPlatformUser) => resetPlatformUserPassword(alvo.id),
    onSuccess: (senha, alvo) => {
      setRedefinindo(null);
      recarregar();
      setSenhaProvisoria({ pessoa: alvo.name, senha });
    },
    onError: (causa) => avisarErro(causa, 'Não foi possível redefinir a senha.'),
  });

  function handleInvite() {
    if (!canInvite) return;
    admissao.mutate();
  }

  function handleToggle(target: SaasPlatformUser) {
    situacao.mutate(target);
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
    /* ⚠️ "Último acesso" saiu: a API não guarda essa coluna, e mostrar "nunca
       entrou" para toda a equipe seria afirmar o que ninguém mediu. */
    { id: 'created', header: 'Criada em', cell: (u) => formatDate(u.createdAt) },
    {
      id: 'status',
      header: 'Situação',
      cell: (u) =>
        !u.active ? (
          <Badge variant="muted">Desligada</Badge>
        ) : u.pendingInvite ? (
          <Badge variant="warning">Senha provisória</Badge>
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
          {u.active && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRedefinindo(u)}
              aria-label={`Redefinir a senha de ${u.name}`}
            >
              <KeyIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={isLastAdmin(u) || situacao.isPending}
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
            Admitir
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

      {consulta.isPending ? (
        <LoadingState label="Carregando a equipe" />
      ) : consulta.isError ? (
        <ApiErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />
      ) : (
        <DataTable columns={columns} data={platformUsers} getRowId={(u) => u.id} />
      )}

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Admitir na equipe</DialogTitle>
            <DialogDescription>
              A conta nasce com uma senha provisória, que aparece uma única vez depois de criar, e
              com troca obrigatória no primeiro acesso.
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
            <Button onClick={handleInvite} disabled={!canInvite || admissao.isPending}>
              Criar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={senhaProvisoria !== null} onOpenChange={() => setSenhaProvisoria(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Senha provisória de {senhaProvisoria?.pessoa}</DialogTitle>
            <DialogDescription>
              Ela aparece só aqui, agora. Não existe rota que a leia depois: se sair desta tela sem
              anotar, o caminho é redefinir de novo.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm break-all">
            {senhaProvisoria?.senha}
          </p>

          <p className="text-xs text-muted-foreground">
            Entregue por um canal que a pessoa já use, e ela troca a senha no primeiro acesso.
          </p>

          <DialogFooter>
            <Button
              onClick={() => {
                if (senhaProvisoria) {
                  void navigator.clipboard.writeText(senhaProvisoria.senha);
                }
                setSenhaProvisoria(null);
              }}
            >
              Copiar e fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={redefinindo !== null}
        onOpenChange={(open) => !open && setRedefinindo(null)}
        title={`Redefinir a senha de ${redefinindo?.name ?? ''}?`}
        description="A senha nova aparece uma única vez e as sessões abertas da pessoa são derrubadas. Sem isso, a sessão da máquina que motivou a redefinição continuaria valendo."
        confirmLabel="Redefinir"
        onConfirm={() => redefinindo && redefinicao.mutate(redefinindo)}
      />

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
