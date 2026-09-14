import { BadgeCheckIcon, DeleteIcon, InfoIcon, PlusIcon } from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { HeroBand } from '@/management/components/layout/hero-band';
import { PageContent } from '@/management/components/layout/page-content';
import { QueryState } from '@/management/components/layout/query-state';
import type { TeamRole } from '@/management/lib/fleet-api';
import { Alert, GlassModal, GlassSelect, SpectrumButton, StatusChip } from '@/management/ui';
import { usePermissions } from '@/hooks/use-session';
import { ApiError } from '@/services/http';

import { deleteRole, fetchPermissions, fetchRoles } from '../api';
import { RoleDialog } from '../components/role-dialog';

/**
 * O editor de cargos da empresa.
 *
 * <h2>O plano é o teto; o cargo distribui o que sobrou</h2>
 *
 * O plano decide quais módulos a empresa tem, e é decisão comercial. O cargo
 * decide quem, dentro dela, alcança cada um deles, e é decisão do Dono. Por isso
 * esta tela mora no painel do cliente e não no backoffice: a RookHub não escolhe
 * quem vê custo consolidado na transportadora.
 *
 * <h2>⚠️ Mexer em cargo derruba sessão, e isso é o desenho</h2>
 *
 * Apagar um cargo, ou migrar alguém para outro, faz as pessoas afetadas
 * receberem 401 na requisição seguinte e voltarem ao login. É o mesmo mecanismo
 * que faz um rebaixamento valer na hora, em vez de esperar o token expirar.
 */
export function RolesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  /*
   * ⚠️ Guarda de TELA, e não de segurança: quem autoriza é a API, que exige
   * `roles.manage` em cada escrita daqui. `settings.manage` é a permissão que
   * este painel dá ao proprietário, e é a que corresponde ao único cargo com
   * `roles.manage` do lado de lá.
   */
  const podeAdministrar = hasPermission('settings.manage');

  const cargos = useQuery({ queryKey: ['cargos'], queryFn: fetchRoles });
  const catalogo = useQuery({ queryKey: ['permissoes'], queryFn: fetchPermissions });

  /** Aberto com um cargo edita; aberto com `null` cria. */
  const [emEdicao, setEmEdicao] = useState<TeamRole | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [apagando, setApagando] = useState<TeamRole | null>(null);
  const [destino, setDestino] = useState('');

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['cargos'] });
    void queryClient.invalidateQueries({ queryKey: ['equipe'] });
  };

  const exclusao = useMutation({
    mutationFn: ({ cargo, migrateTo }: { cargo: TeamRole; migrateTo: string }) =>
      migrateTo ? deleteRole(cargo.id, migrateTo) : deleteRole(cargo.id),
    onSuccess: () => {
      setApagando(null);
      setDestino('');
      recarregar();
      toast.success('Cargo apagado.', {
        description: 'Quem estava nele entra de novo na próxima vez que usar o sistema.',
      });
    },
    onError: (causa) =>
      toast.error(causa instanceof ApiError ? causa.message : 'Não foi possível apagar o cargo.'),
  });

  const abrirDialogo = (cargo: TeamRole | null) => {
    setEmEdicao(cargo);
    setDialogoAberto(true);
  };

  const fecharDialogo = () => {
    setDialogoAberto(false);
    setEmEdicao(null);
  };

  /* O destino da migração é qualquer outro cargo da empresa: mandar alguém para
     o cargo que está sendo apagado não faria sentido. */
  const opcoesDeDestino = [
    { value: '', label: 'Nenhum cargo em uso (não migrar ninguém)' },
    ...(cargos.data ?? [])
      .filter((cargo) => cargo.id !== apagando?.id)
      .map((cargo) => ({ value: cargo.id, label: cargo.name })),
  ];

  return (
    <>
      <HeroBand
        title="Cargos"
        description="Quem alcança o quê dentro da empresa. O plano define os módulos; o cargo distribui o que sobrou."
      />

      <PageContent className="rounded-t-4xl bg-light mt-0 pt-8 sm:mt-0 sm:rounded-t-[40px]">
        <QueryState
          isPending={cargos.isPending || catalogo.isPending}
          isError={cargos.isError || catalogo.isError}
          error={cargos.error ?? catalogo.error}
          label="os cargos"
        >
          <Alert severity="info">
            Trocar alguém de cargo, ou apagar um cargo em uso, encerra a sessão das pessoas
            afetadas: elas entram de novo e já com as permissões novas.
          </Alert>

          {podeAdministrar ? (
            <div className="mt-5 mb-5 flex justify-end">
              <SpectrumButton type="button" size="sm" onClick={() => abrirDialogo(null)}>
                <PlusIcon size={14} aria-hidden="true" />
                Criar cargo
              </SpectrumButton>
            </div>
          ) : null}

          <ul className="flex flex-col gap-3">
            {(cargos.data ?? []).map((cargo) => (
              <li
                key={cargo.id}
                className="border-light-outline flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-on-light text-title-sm">{cargo.name}</p>
                    {cargo.system ? (
                      <StatusChip tone="info" surface="light">
                        Sistema
                      </StatusChip>
                    ) : null}
                  </div>
                  <p className="text-on-light-muted text-label-sm mt-1 normal-case">{cargo.key}</p>
                  {cargo.description ? (
                    <p className="text-on-light-muted text-body-sm mt-2 normal-case">
                      {cargo.description}
                    </p>
                  ) : null}
                  <p className="text-on-light-muted text-label-sm mt-2 normal-case">
                    {cargo.permissions.length}{' '}
                    {cargo.permissions.length === 1 ? 'permissão' : 'permissões'} gravadas
                  </p>
                </div>

                {podeAdministrar ? (
                  <div className="flex flex-wrap gap-2">
                    {/* ⚠️ Cargo de sistema não é editável nem apagável, e a API
                        responde 409. Desabilitar diz isso antes do clique. */}
                    <SpectrumButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={cargo.system}
                      onClick={() => abrirDialogo(cargo)}
                    >
                      <BadgeCheckIcon size={14} aria-hidden="true" />
                      Editar
                    </SpectrumButton>
                    <SpectrumButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={cargo.system}
                      onClick={() => {
                        setApagando(cargo);
                        setDestino('');
                      }}
                    >
                      <DeleteIcon size={14} aria-hidden="true" />
                      Apagar
                    </SpectrumButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {!podeAdministrar ? (
            <p className="text-on-light-muted text-body-sm mt-5 normal-case">
              <InfoIcon size={14} aria-hidden="true" className="mr-1 inline" />
              Criar e editar cargos é do cargo de comando da empresa. Esta é a leitura.
            </p>
          ) : null}
        </QueryState>
      </PageContent>

      <GlassModal
        open={dialogoAberto}
        onOpenChange={(aberto) => (aberto ? setDialogoAberto(true) : fecharDialogo())}
        title={emEdicao ? `Cargo ${emEdicao.name}` : 'Criar cargo'}
        description="As permissões que o plano não cobre aparecem marcadas e desabilitadas: elas continuam gravadas."
      >
        {/* A chave remonta o formulário a cada abertura: sem ela, o estado do
            cargo anterior sobreviveria à troca. */}
        <RoleDialog
          key={emEdicao?.id ?? 'novo'}
          role={emEdicao}
          catalogo={catalogo.data ?? []}
          onClose={fecharDialogo}
          onSaved={recarregar}
        />
      </GlassModal>

      <GlassModal
        open={apagando !== null}
        onOpenChange={(aberto) => (aberto ? null : setApagando(null))}
        title={`Apagar o cargo ${apagando?.name ?? ''}?`}
        description="Cargo com gente dentro exige dizer para onde essas pessoas vão."
      >
        <div className="flex flex-col gap-4">
          {/* ⚠️ Não migra sozinho para um padrão: a pessoa herdaria um conjunto
              de permissões que ninguém escolheu, e aqui o cargo decide quem vê
              custo consolidado. */}
          <GlassSelect
            label="Migrar as pessoas para"
            options={opcoesDeDestino}
            value={destino}
            onValueChange={setDestino}
            hint="Se o cargo estiver em uso e nenhum destino for escolhido, a API recusa a exclusão."
          />

          <Alert severity="warning">
            Quem for migrado recebe as permissões do cargo de destino e precisa entrar de novo.
          </Alert>

          <div className="flex flex-wrap justify-end gap-3">
            <SpectrumButton type="button" variant="ghost" onClick={() => setApagando(null)}>
              Cancelar
            </SpectrumButton>
            <SpectrumButton
              type="button"
              disabled={exclusao.isPending}
              onClick={() => apagando && exclusao.mutate({ cargo: apagando, migrateTo: destino })}
            >
              Apagar cargo
            </SpectrumButton>
          </div>
        </div>
      </GlassModal>
    </>
  );
}
