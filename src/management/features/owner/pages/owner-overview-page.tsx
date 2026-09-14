import { UserIcon, UsersIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { HeroStats, type HeroStat } from '@/management/components/layout/hero-stats';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';
import { fetchTeam } from '@/management/lib/fleet-api';
import { SpectrumButton } from '@/management/ui';

import { OwnerHero } from '../components/owner-hero';

/**
 * A visão geral do proprietário, enxuta.
 *
 * ⚠️ **Substitui a `OwnerHomePage` a pedido do usuário em 14/09/2026, e a
 * anterior continua no repositório.** Aquela tela responde "quanto sobrou" com
 * DRE, margem, insights e tendência, e **nenhum desses números tem origem**: são
 * do mock. Número inventado na tela de quem decide é pior que tela faltando,
 * porque ninguém duvida de um gráfico.
 *
 * O que sobra aqui é o que existe de verdade: quantas pessoas têm acesso ao
 * painel, que vem de `GET /v1/team`. O resto volta quando o dado for real, e
 * voltar é trocar o import do `RoleHome` de novo.
 *
 * ⚠️ **Sem motorista nesta contagem.** A equipe do dono é quem ele convidou, e o
 * quadro de motoristas vem da telemetria: misturar os dois num número só daria
 * um total que não corresponde a nenhuma das duas perguntas.
 */
export function OwnerOverviewPage() {
  const session = useSession();
  const empresa = session?.tenant.name ? ` na ${session.tenant.name}` : '';

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['equipe'],
    queryFn: () => fetchTeam(30),
  });

  const doPainel = (data?.people ?? []).filter((pessoa) => pessoa.kind === 'PAINEL');
  const ativos = doPainel.filter((pessoa) => pessoa.active).length;

  const stats: HeroStat[] = data
    ? [
        {
          key: 'acessos',
          label: 'Pessoas com acesso',
          value: ativos,
          hint: 'contas que entram no painel',
          icon: UsersIcon,
        },
        {
          key: 'desativados',
          label: 'Acessos desativados',
          value: doPainel.length - ativos,
          hint: 'contas desligadas, com histórico preservado',
          icon: UserIcon,
          tone: doPainel.length - ativos > 0 ? 'warn' : 'neutral',
        },
      ]
    : [];

  return (
    <>
      <OwnerHero description={`Quem trabalha${empresa} e quem tem acesso ao painel.`} />

      <PageContent>
        <h2 className="sr-only">Resumo da empresa</h2>

        <QueryState isPending={isPending} isError={isError} error={error} label="o resumo">
          {/* A subida fica nos cards, e não em volta do `QueryState`: ali ela
              jogaria o carregamento e o erro por cima da faixa colorida. */}
          <HeroStats items={stats} className="-mt-16 sm:-mt-20" />

          <p className="text-on-surface-muted text-label-sm mt-3 normal-case">
            Cadastro do sistema, e não da telemetria.
          </p>

          <div className="mt-8">
            <SpectrumButton asChild size="sm">
              <Link to="/gestao/equipe">Ver a equipe</Link>
            </SpectrumButton>
          </div>
        </QueryState>
      </PageContent>
    </>
  );
}
