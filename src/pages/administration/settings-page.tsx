import {
  Bell,
  Building2,
  MapPin,
  Monitor,
  Moon,
  Palette,
  ScrollText,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ROLE_LABELS } from '@/app/permissions';
import { PLAN_LABELS } from '@/app/plans';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionGuard } from '@/components/shared/guards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/hooks/use-session';
import { tenantStatusDescriptor } from '@/lib/status-maps';
import { cn } from '@/lib/utils';
import { useThemeStore, type Theme } from '@/stores/theme-store';
import type { UserRole } from '@/types';

const MOCK_USERS: { name: string; email: string; role: UserRole; active: boolean }[] = [
  {
    name: 'Felipe Vinícius',
    email: 'felipe.vinicius@teste.com.br',
    role: 'MANAGER',
    active: true,
  },
  {
    name: 'Marina Alves',
    email: 'marina.alves@servioeste.com.br',
    role: 'OWNER',
    active: true,
  },
  {
    name: 'Roberto Dias',
    email: 'roberto.dias@servioeste.com.br',
    role: 'MAINTENANCE',
    active: true,
  },
  {
    name: 'Paula Fernandes',
    email: 'paula.fernandes@servioeste.com.br',
    role: 'OPERATOR',
    active: false,
  },
];

const ALERT_PREFERENCES = [
  { id: 'speeding', label: 'Excesso de velocidade', checked: true },
  { id: 'maintenance', label: 'Manutenção preventiva', checked: true },
  { id: 'fatigue', label: 'Fadiga do condutor', checked: true },
  { id: 'delay', label: 'Risco de atraso', checked: false },
  { id: 'fuel', label: 'Anomalia de combustível', checked: true },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
];

const SECTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'company', label: 'Empresa', icon: Building2 },
  { value: 'users', label: 'Usuários', icon: Users },
  { value: 'units', label: 'Unidades', icon: MapPin },
  { value: 'alerts', label: 'Alertas', icon: Bell },
  { value: 'appearance', label: 'Aparência', icon: Palette },
  { value: 'security', label: 'Segurança', icon: ShieldCheck },
  { value: 'audit', label: 'Auditoria', icon: ScrollText },
];

/* -------------------------------------------------------------------------- */
/* Blocos auxiliares                                                          */
/* -------------------------------------------------------------------------- */

/** Linha rótulo/valor do resumo lateral. */
function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { tenant } = useSession();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie sua empresa, usuários, preferências e segurança."
      />

      <PermissionGuard permission="settings.manage">
        <Tabs
          defaultValue="company"
          orientation="vertical"
          className="flex flex-col gap-6 lg:flex-row lg:items-start"
        >
          {/* Menu de seções: coluna no desktop, faixa rolável no mobile. */}
          <div className="-mx-1 overflow-x-auto px-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:overflow-visible lg:px-0">
            <TabsList className="h-auto w-max lg:w-full lg:flex-col lg:items-stretch lg:bg-transparent lg:p-0">
              {SECTIONS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-2 hover:text-foreground lg:justify-start lg:px-3 lg:py-2 lg:data-[state=active]:bg-muted"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="min-w-0 flex-1">
            <TabsContent value="company" className="mt-0 grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Dados da empresa</CardTitle>
                  <CardDescription>Informações cadastrais do tenant ativo.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Razão social</Label>
                    <Input id="company-name" defaultValue={tenant?.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-slug">Identificador</Label>
                    <Input id="company-slug" defaultValue={tenant?.slug} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-doc">CNPJ</Label>
                    <Input id="company-doc" defaultValue="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">Telefone</Label>
                    <Input id="company-phone" defaultValue="(11) 4002-8922" />
                  </div>
                  <div className="sm:col-span-2">
                    <Button variant="brand">Salvar alterações</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assinatura</CardTitle>
                  <CardDescription>Situação atual do tenant na plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SummaryRow label="Plano">
                    {tenant && <Badge variant="default">{PLAN_LABELS[tenant.plan]}</Badge>}
                  </SummaryRow>
                  <SummaryRow label="Situação">
                    {tenant && <StatusBadge descriptor={tenantStatusDescriptor(tenant.status)} />}
                  </SummaryRow>
                  <SummaryRow label="Identificador">
                    <span className="font-medium">{tenant?.slug}</span>
                  </SummaryRow>
                  <SummaryRow label="Usuários">
                    <span className="font-medium">{MOCK_USERS.length}</span>
                  </SummaryRow>
                  <div className="pt-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/app/planos">Ver planos</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Usuários e permissões</CardTitle>
                  <CardDescription>Membros com acesso à plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_USERS.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                          <TableCell>
                            <Badge variant={user.active ? 'success' : 'muted'}>
                              {user.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="units" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Unidades operacionais</CardTitle>
                  <CardDescription>Filiais e bases da operação.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    'São Paulo',
                    'Rio de Janeiro',
                    'Belo Horizonte',
                    'Curitiba',
                    'Goiânia',
                    'Porto Alegre',
                  ].map((unit) => (
                    <div
                      key={unit}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
                    >
                      <span>{unit}</span>
                      <StatusBadge descriptor={{ label: 'Ativa', variant: 'success' }} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preferências de alertas</CardTitle>
                  <CardDescription>Escolha quais alertas devem gerar notificações.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ALERT_PREFERENCES.map((pref) => (
                    <label
                      key={pref.id}
                      htmlFor={pref.id}
                      className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
                    >
                      <Checkbox id={pref.id} defaultChecked={pref.checked} />
                      {pref.label}
                    </label>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aparência</CardTitle>
                  <CardDescription>O tema escuro é o padrão do RookHub.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value)}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors',
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted/40',
                          )}
                          aria-pressed={active}
                        >
                          <Icon className="h-5 w-5" />
                          {option.label}
                        </button>
                      );
                    })}
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      <Monitor className="h-5 w-5" />
                      Sistema (em breve)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0 grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Segurança</CardTitle>
                  <CardDescription>Proteções da conta e da sessão.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex items-start gap-3 rounded-md border border-border p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    <div>
                      <p className="font-medium">Autenticação em duas etapas</p>
                      <p className="text-muted-foreground">
                        Recomendada para todos os administradores. Configuração disponível com o
                        backend.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Validação no servidor</CardTitle>
                  <CardDescription>Onde o controle de acesso realmente vale.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  As validações críticas de acesso e permissão também são aplicadas no backend a
                  cada requisição. O controle visual aqui é apenas uma camada adicional de
                  usabilidade.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auditoria</CardTitle>
                  <CardDescription>Eventos recentes de configuração.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    'Marina Alves atualizou as permissões de um usuário',
                    'Felipe Vinícius conectou a integração de WhatsApp',
                    'Roberto Dias criou uma unidade operacional',
                  ].map((event, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0"
                    >
                      <span>{event}</span>
                      <span className="text-xs text-muted-foreground">há {i + 1}h</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </PermissionGuard>

      <p className="text-xs text-muted-foreground">
        Precisa conectar fontes de dados? Acesse{' '}
        <Link to="/app/integracoes" className="text-primary hover:underline">
          Integrações
        </Link>
        .
      </p>
    </div>
  );
}
