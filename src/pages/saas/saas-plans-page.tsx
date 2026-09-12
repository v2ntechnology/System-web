import { CheckIcon, TruckIcon, UsersIcon } from '@/components/icons';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_DEFINITIONS } from '@/app/plans';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSaasStore } from '@/stores/saas-store';
import type { ModuleKey, PlanType } from '@/types';

import { Callout } from './saas-ui';

const ORDER: PlanType[] = ['starter', 'business', 'enterprise'];

/** Todos os módulos que a matriz compara, na ordem em que fazem sentido ler. */
const ALL_MODULES: ModuleKey[] = [
  'dashboard',
  'fleet',
  'vehicles',
  'drivers',
  'trips',
  'tracking',
  'fuel',
  'maintenance',
  'fines',
  'checklists',
  'alerts',
  'settings',
  'plans',
  'analytics',
  'ai',
  'integrations',
  'saas',
];

const MODULE_LABEL: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  fleet: 'Frota',
  vehicles: 'Veículos',
  drivers: 'Motoristas',
  trips: 'Viagens',
  tracking: 'Rastreamento',
  fuel: 'Abastecimentos',
  maintenance: 'Manutenções',
  fines: 'Multas',
  checklists: 'Checklists',
  alerts: 'Alertas',
  settings: 'Configurações',
  plans: 'Planos',
  analytics: 'Analytics',
  ai: 'IA RookHub',
  integrations: 'Integrações',
  saas: 'Administração da plataforma',
};

/**
 * Catálogo comercial e a matriz de módulos por plano.
 *
 * A matriz é o que torna a regra visível: o plano define **quais módulos
 * existem** para a empresa, e o cargo distribui o que sobrou dentro disso. Sem
 * ela, a diferença entre os planos vira uma lista de preços sem consequência.
 */
export default function SaasPlansPage() {
  const tenants = useSaasStore((s) => s.tenants);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Configuração comercial e o que cada plano libera na plataforma."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((planType) => {
          const def = PLAN_DEFINITIONS[planType];
          const subscribers = tenants.filter((t) => t.plan === planType).length;
          const mrr = tenants
            .filter((t) => t.plan === planType)
            .reduce((sum, t) => sum + (t.mrr ?? 0), 0);
          return (
            <Card key={planType} className={def.highlighted ? 'border-primary/50' : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{def.name}</CardTitle>
                  <Badge variant="muted">{subscribers} empresas</Badge>
                </div>
                <CardDescription>{def.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-display text-2xl font-bold">
                  {formatCurrency(def.monthlyPrice)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(mrr)} de receita recorrente neste plano
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TruckIcon className="h-4 w-4" />
                    {formatNumber(def.vehicleLimit)} veículos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="h-4 w-4" />
                    {formatNumber(def.userLimit)} usuários
                  </span>
                </div>
                <Badge variant="outline">{def.modules.length} módulos</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Callout tone="info" title="Os limites de veículo e usuário ainda não travam nada">
        Estão definidos aqui e aparecem na tela, mas não são aplicados: entram quando houver
        cobrança de verdade. O que já vale como teto é a lista de módulos.
      </Callout>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos por plano</CardTitle>
          <CardDescription>
            Rota de módulo fora do plano devolve 402, e a tela oferece upgrade em vez de dizer “sem
            acesso”.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Módulo</th>
                {ORDER.map((p) => (
                  <th key={p} className="pb-2 text-center font-medium text-muted-foreground">
                    {PLAN_DEFINITIONS[p].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map((module) => (
                <tr key={module} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{MODULE_LABEL[module]}</td>
                  {ORDER.map((p) => {
                    const included = PLAN_DEFINITIONS[p].modules.includes(module);
                    return (
                      <td key={p} className="py-2 text-center">
                        <CheckIcon
                          className={cn(
                            'mx-auto h-4 w-4',
                            included ? 'text-success' : 'text-transparent',
                          )}
                          aria-label={included ? 'Incluído' : 'Não incluído'}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
