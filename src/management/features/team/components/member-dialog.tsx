import { CheckIcon, MailIcon, UserSettingsIcon } from '@/components/icons';
import type { TeamMember, TeamRole } from '@/management/lib/fleet-api';
import { inviteTeamMember, updateTeamMember } from '@/management/lib/fleet-api';
import { Alert, GlassInput, GlassSelect, SpectrumButton, Spinner } from '@/management/ui';
import { ApiError } from '@/services/http';
import { useState } from 'react';

/**
 * Convidar alguém e editar quem já existe são o mesmo formulário.
 *
 * Os campos são os três que a API aceita, e a diferença entre os dois modos é
 * qual rota recebe e o que já vem preenchido. Dois diálogos separados seriam
 * duas cópias do mesmo formulário divergindo na primeira mudança de regra.
 */

/** Valor de "não mexer no cargo". Sentinela, e não string vazia: o Radix recusa. */
const MANTER = 'MANTER';

const PAPEL_LABEL: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gestor',
  OPERATOR: 'Operador',
  MAINTENANCE: 'Manutenção',
  DRIVER: 'Motorista',
  SUPER_ADMIN: 'Administração',
};

export interface MemberDialogProps {
  /** Nulo abre em modo convite; preenchido abre em modo edição. */
  member: TeamMember | null;
  roles: TeamRole[];
  onClose: () => void;
  /** Chamado depois de gravar, para a lista recarregar. */
  onSaved: () => void;
}

export function MemberDialog({ member, roles, onClose, onSaved }: MemberDialogProps) {
  const editando = member !== null;

  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  /*
   * ⚠️ Em edição o cargo começa em "manter", e não no cargo atual da pessoa.
   *
   * `GET /v1/team` devolve o PAPEL (`MANAGER`), que é o que o painel usa para
   * liberar tela, e não o `roleId`, que é o que a edição recebe. Os dois não
   * são reversíveis um no outro: dois cargos diferentes podem cair no mesmo
   * papel. Adivinhar aqui trocaria o cargo de alguém em silêncio, e trocar
   * cargo derruba a sessão da pessoa.
   */
  const [roleId, setRoleId] = useState(editando ? MANTER : '');

  /* Os cargos chegam da API, e podem chegar depois de o diálogo abrir: o
     primeiro da lista é o padrão enquanto ninguém escolheu. */
  const cargoEscolhido = roleId || (editando ? MANTER : (roles[0]?.id ?? ''));

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /**
   * O convite recém-criado.
   *
   * ⚠️ São dois estados, e não um, porque o link pode não existir. Com a entrega
   * por e-mail ligada o `acceptUrl` vem nulo, e usar o próprio link como "já
   * convidei" deixava a tela voltar ao formulário como se nada tivesse
   * acontecido. `enviado` diz que deu certo; `link` diz se há endereço para
   * entregar à mão.
   */
  const [enviado, setEnviado] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const opcoesDeCargo = [
    ...(editando
      ? [
          {
            value: MANTER,
            label: `Manter cargo atual${member.role ? ` (${PAPEL_LABEL[member.role] ?? member.role})` : ''}`,
          },
        ]
      : []),
    /* ⚠️ `name`, e não `key`: a chave é identificador interno, e o nome é o que o
       cliente escolheu para o cargo. */
    ...roles.map((role) => ({ value: role.id, label: role.name })),
  ];

  async function gravar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      if (editando) {
        /* Só o que mudou viaja: mandar o valor atual de volta seria uma
           alteração que a API registra na auditoria sem nada ter mudado. */
        const changes: { name?: string; email?: string; roleId?: string } = {};
        if (name.trim() !== member.name) changes.name = name.trim();
        if (email.trim().toLowerCase() !== (member.email ?? '')) {
          changes.email = email.trim().toLowerCase();
        }
        if (cargoEscolhido !== MANTER) changes.roleId = cargoEscolhido;

        if (Object.keys(changes).length === 0) {
          setErro('Altere algum campo antes de salvar.');
          return;
        }

        await updateTeamMember(member.id, changes);
        onSaved();
        onClose();
        return;
      }

      /* A lista de cargos vem da API e pode não ter chegado: sem ela não há o
         que escolher, e um convite sem cargo seria recusado com 400. */
      if (!cargoEscolhido) {
        setErro('Escolha um cargo para a pessoa.');
        return;
      }

      const criado = await inviteTeamMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        roleId: cargoEscolhido,
      });
      setLink(criado.acceptUrl);
      setEnviado(true);
      onSaved();
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

  /*
   * ⚠️ O link só aparece quando o servidor manda um, o que hoje significa
   * "a entrega por e-mail está desligada neste ambiente". Com ela ligada, o
   * `acceptUrl` é nulo: mostrar o bloco assim mesmo daria um endereço em branco
   * com um botão de copiar nada, e quem convidou concluiria que falhou.
   */
  if (enviado) {
    const destinatario = email.trim().toLowerCase();

    return (
      <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <Alert severity="success">Convite enviado para {destinatario}.</Alert>

        {link ? (
          <div>
            <p className="text-on-surface-variant text-body-md">
              O envio por e-mail está desligado neste ambiente, então copie o link e mande para a
              pessoa. Ele abre no endereço da empresa, que é o que permite encontrar o convite.
            </p>

            <p className="text-label-sm text-on-surface-muted mt-3 break-all normal-case">{link}</p>
          </div>
        ) : (
          <p className="text-on-surface-variant text-body-md">
            A pessoa recebe o link por e-mail e define a própria senha ao aceitar. Se o convite não
            chegar, reemita pela lista da equipe.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {link && (
            <SpectrumButton
              type="button"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => setCopiado(true));
              }}
            >
              {copiado ? (
                <CheckIcon size={16} aria-hidden="true" />
              ) : (
                <MailIcon size={16} aria-hidden="true" />
              )}
              {copiado ? 'Link copiado' : 'Copiar link'}
            </SpectrumButton>
          )}

          <SpectrumButton type="button" onClick={onClose}>
            Concluir
          </SpectrumButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={gravar} className="flex flex-col gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      <GlassInput
        label="Nome"
        value={name}
        onChange={(evento) => setName(evento.target.value)}
        autoComplete="name"
        placeholder="Marina Duarte"
        required
        disabled={salvando}
      />

      <GlassInput
        label="E-mail"
        type="email"
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        autoComplete="email"
        placeholder="marina.duarte@empresa.com.br"
        required
        disabled={salvando}
      />

      <GlassSelect
        label="Cargo"
        options={opcoesDeCargo}
        value={cargoEscolhido}
        onValueChange={setRoleId}
        /* Só aparece sem lista de cargos, que é enquanto ela não chegou da API:
           ali `cargoEscolhido` é string vazia e o campo ficaria em branco. */
        placeholder="Selecione um cargo"
        hint={
          editando
            ? 'Trocar o cargo encerra a sessão da pessoa na hora.'
            : 'O cargo define o que a pessoa vê e faz no painel.'
        }
        disabled={salvando || roles.length === 0}
      />

      <div className="mt-2 flex flex-wrap justify-end gap-3">
        <SpectrumButton type="button" variant="danger" onClick={onClose} disabled={salvando}>
          Cancelar
        </SpectrumButton>

        <SpectrumButton type="submit" disabled={salvando}>
          {salvando ? (
            <>
              <Spinner label="Salvando" />
              Salvando…
            </>
          ) : (
            <>
              <UserSettingsIcon size={16} aria-hidden="true" />
              {editando ? 'Salvar alterações' : 'Criar convite'}
            </>
          )}
        </SpectrumButton>
      </div>
    </form>
  );
}
