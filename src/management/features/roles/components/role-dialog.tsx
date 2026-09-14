import { useMemo, useState } from 'react';

import { PERMISSION_GROUP_ORDER, permissionEntry } from '@/app/permission-catalog';
import { PLAN_LABELS, planoQueInclui } from '@/app/plans';
import type { TeamRole } from '@/management/lib/fleet-api';
import { Alert, Checkbox, GlassInput, GlassSelect, SpectrumButton } from '@/management/ui';
import { ApiError } from '@/services/http';

import { createRole, updateRole, type PermissionItem, type RoleInput } from '../api';

/**
 * Criar e editar cargo são o mesmo formulário.
 *
 * O que muda entre os dois é a rota que recebe e a chave, que só existe na
 * criação: ela nunca muda depois, mesmo renomeando o cargo.
 */

/** Valor de "não mexer no destino". Sentinela, e não string vazia: o Radix recusa. */
const MANTER = 'MANTER';

const DESTINOS = [
  { value: 'gestao', label: 'Painel de gestão' },
  { value: 'operacional', label: 'Painel operacional' },
];

export interface RoleDialogProps {
  /** Nulo abre em modo criação; preenchido abre em modo edição. */
  role: TeamRole | null;
  /** O catálogo que o plano da empresa cobre. */
  catalogo: PermissionItem[];
  onClose: () => void;
  onSaved: () => void;
}

export function RoleDialog({ role, catalogo, onClose, onSaved }: RoleDialogProps) {
  const editando = role !== null;

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [key, setKey] = useState('');
  const [landing, setLanding] = useState(editando ? MANTER : 'gestao');

  const cobertas = useMemo(() => new Set(catalogo.map((p) => p.key)), [catalogo]);

  /*
   * ⚠️ **As permissões fora do plano ficam de lado, e voltam no envio.**
   *
   * `GET /v1/roles` devolve o que está GRAVADO, e uma empresa starter tem cargos
   * semeados com `analytics.view`, que o plano dela não cobre. Se o editor
   * mostrasse só as cobertas, o array enviado no PATCH sairia sem aquelas
   * chaves, e o PATCH substitui o array inteiro: elas seriam apagadas, e um
   * upgrade de plano depois não as traria de volta. Salvar uma vez destruiria
   * configuração que ninguém pediu para mexer.
   */
  const foraDoPlano = useMemo(
    () => (role?.permissions ?? []).filter((chave) => !cobertas.has(chave)),
    [role, cobertas],
  );

  const [marcadas, setMarcadas] = useState<string[]>(() =>
    (role?.permissions ?? []).filter((chave) => cobertas.has(chave)),
  );

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const grupos = useMemo(() => {
    const porGrupo = new Map<string, PermissionItem[]>();
    for (const item of catalogo) {
      porGrupo.set(item.group, [...(porGrupo.get(item.group) ?? []), item]);
    }
    return [...porGrupo.entries()].sort(
      (a, b) => PERMISSION_GROUP_ORDER.indexOf(a[0]) - PERMISSION_GROUP_ORDER.indexOf(b[0]),
    );
  }, [catalogo]);

  function alternar(chave: string, marcada: boolean) {
    setMarcadas((atuais) =>
      marcada ? [...atuais, chave] : atuais.filter((outra) => outra !== chave),
    );
  }

  async function gravar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    /* Cargo sem permissão nenhuma é recusado pela API, e dizer isso aqui evita
       uma viagem para receber a mesma frase. */
    if (marcadas.length === 0 && foraDoPlano.length === 0) {
      setErro('Escolha ao menos uma permissão para o cargo.');
      return;
    }

    setSalvando(true);
    try {
      const permissions = [...marcadas, ...foraDoPlano];

      if (editando) {
        const changes: Partial<RoleInput> = { permissions };
        if (name.trim() !== role.name) changes.name = name.trim();
        if (description.trim() !== (role.description ?? ''))
          changes.description = description.trim();
        if (landing !== MANTER) changes.landing = landing as RoleInput['landing'];
        await updateRole(role.id, changes);
      } else {
        await createRole({
          name: name.trim(),
          ...(key.trim() ? { key: key.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          permissions,
          landing: landing as RoleInput['landing'],
        });
      }

      onSaved();
      onClose();
    } catch (causa) {
      setErro(
        causa instanceof ApiError
          ? causa.message
          : 'Não foi possível salvar agora. Tente novamente em instantes.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={gravar} className="flex flex-col gap-4">
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      <GlassInput
        label="Nome do cargo"
        value={name}
        onChange={(evento) => setName(evento.target.value)}
        required
        disabled={salvando}
        hint={
          editando
            ? `A chave continua ${role.key}: renomear o cargo não muda o identificador.`
            : 'A chave sai do nome quando você não informa uma, e nunca muda depois.'
        }
      />

      {!editando && (
        <GlassInput
          label="Chave (opcional)"
          value={key}
          onChange={(evento) => setKey(evento.target.value.toLowerCase().trim())}
          disabled={salvando}
          placeholder="diretor-financeiro"
          hint="Identificador interno. Chave repetida é recusada."
        />
      )}

      <GlassInput
        label="Descrição (opcional)"
        value={description}
        onChange={(evento) => setDescription(evento.target.value)}
        disabled={salvando}
      />

      {/* ⚠️ `gestao` ou `operacional`, e não um caminho de rota: mandar `/app`
          responde 400. Na edição começa em "manter" porque a lista de cargos não
          devolve o destino atual, e adivinhar mudaria a porta de entrada de
          alguém em silêncio. */}
      <GlassSelect
        label="Onde este cargo entra"
        options={
          editando ? [{ value: MANTER, label: 'Manter o destino atual' }, ...DESTINOS] : DESTINOS
        }
        value={landing}
        onValueChange={setLanding}
        disabled={salvando}
        hint="Painel de gestão para quem administra; operacional para quem executa."
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-on-light text-label-md normal-case">Permissões</legend>

        {grupos.map(([grupo, itens]) => (
          <div key={grupo} className="flex flex-col gap-2">
            <p className="text-on-light-muted text-label-sm normal-case">
              {itens[0]?.groupLabel ?? grupo}
            </p>
            {itens.map((item) => (
              <Checkbox
                key={item.key}
                surface="light"
                label={item.label}
                checked={marcadas.includes(item.key)}
                onCheckedChange={(marcada) => alternar(item.key, marcada === true)}
                disabled={salvando}
              />
            ))}
          </div>
        ))}

        {foraDoPlano.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-on-light-muted text-label-sm normal-case">Fora do plano atual</p>
            <p className="text-on-light-muted text-body-sm normal-case">
              Já estão gravadas neste cargo e continuam aí. Elas não valem enquanto o plano não
              cobrir o módulo, e voltam a valer sozinhas num upgrade.
            </p>
            {foraDoPlano.map((chave) => (
              <Checkbox
                key={chave}
                surface="light"
                checked
                disabled
                label={permissionEntry(chave)?.label ?? chave}
                description={descricaoForaDoPlano(chave)}
              />
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3">
        <SpectrumButton type="button" variant="ghost" onClick={onClose} disabled={salvando}>
          Cancelar
        </SpectrumButton>
        <SpectrumButton type="submit" disabled={salvando}>
          {editando ? 'Salvar cargo' : 'Criar cargo'}
        </SpectrumButton>
      </div>
    </form>
  );
}

/** Em que plano a permissão fora do teto passa a valer. */
function descricaoForaDoPlano(chave: string): string {
  const entrada = permissionEntry(chave);
  const necessario = planoQueInclui(entrada?.module ?? null);
  if (!necessario) return 'Não está incluída no plano atual.';
  return `Vem no plano ${PLAN_LABELS[necessario]}.`;
}
