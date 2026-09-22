import { maskDecimal, maskInteger, parseDecimal, parseInteger } from '@/lib/input-masks';
import type { MaintenanceItemId } from '@/management/lib/fleet-api';
import { Checkbox, GlassInput, GlassSelect, cn } from '@/management/ui';

import { CAMPOS_POR_ITEM, type CampoDeItem } from '../maintenance-item-fields';

/** O que o formulário carrega enquanto se digita. Número ainda é texto aqui. */
export type DetalhesEmEdicao = Record<string, string | string[] | boolean>;

const NAO_INFORMADO = '';

/**
 * Do que está gravado para o formulário.
 *
 * ⚠️ Lê pela DEFINIÇÃO do item: chave que já saiu da lista de campos não volta
 * para a tela, e o campo novo nasce vazio em lançamento antigo.
 */
export function detalhesParaEdicao(
  item: MaintenanceItemId,
  gravado: Record<string, unknown> | undefined,
): DetalhesEmEdicao {
  const saida: DetalhesEmEdicao = {};

  for (const campo of CAMPOS_POR_ITEM[item] ?? []) {
    const valor = gravado?.[campo.id];

    if (campo.type === 'simNao') saida[campo.id] = valor === true;
    else if (campo.type === 'multipla') saida[campo.id] = Array.isArray(valor) ? valor : [];
    else if (campo.type === 'numero')
      saida[campo.id] =
        typeof valor === 'number'
          ? campo.decimais
            ? maskDecimal(valor.toFixed(campo.decimais).replace('.', ','), campo.decimais)
            : maskInteger(String(valor))
          : NAO_INFORMADO;
    else saida[campo.id] = typeof valor === 'string' ? valor : NAO_INFORMADO;
  }

  return saida;
}

/**
 * Do formulário para o que vai ao servidor.
 *
 * ⚠️ Campo vazio NÃO é gravado, e "não" também não: o objeto guarda o que foi
 * preenchido, e não uma linha por campo existente. Sem isso, cada lançamento
 * levaria sete chaves nulas ao banco e a ficha teria de filtrá-las de novo na
 * leitura.
 */
export function detalhesParaGravar(
  item: MaintenanceItemId,
  edicao: DetalhesEmEdicao,
): Record<string, unknown> | undefined {
  const saida: Record<string, unknown> = {};

  for (const campo of CAMPOS_POR_ITEM[item] ?? []) {
    const valor = edicao[campo.id];

    if (campo.type === 'simNao') {
      if (valor === true) saida[campo.id] = true;
      continue;
    }
    if (campo.type === 'multipla') {
      if (Array.isArray(valor) && valor.length > 0) saida[campo.id] = valor;
      continue;
    }
    if (typeof valor !== 'string' || valor.trim() === '') continue;

    if (campo.type === 'numero') {
      const numero = campo.decimais ? parseDecimal(valor) : parseInteger(valor);
      if (numero != null) saida[campo.id] = numero;
      continue;
    }

    saida[campo.id] = valor.trim();
  }

  return Object.keys(saida).length > 0 ? saida : undefined;
}

/**
 * Os campos que só existem naquele item, dentro do registro de troca.
 *
 * Decisão do usuário em 22/09/2026: o formulário era o mesmo para os seis itens
 * e tudo que era próprio do serviço acabava na observação em texto livre. A
 * lista de campos mora em `maintenance-item-fields.ts`.
 *
 * ⚠️ **Nenhum campo é obrigatório**, pela mesma razão do odômetro e do custo: o
 * lançamento retroativo chega com a nota da oficina dias depois, e exigir a
 * medida do pneu faria a operação inventar um número para conseguir salvar.
 */
export function MaintenanceDetailFields({
  item,
  valor,
  onChange,
}: {
  item: MaintenanceItemId;
  valor: DetalhesEmEdicao;
  onChange: (proximo: DetalhesEmEdicao) => void;
}) {
  const campos = CAMPOS_POR_ITEM[item] ?? [];
  if (campos.length === 0) return null;

  const alterar = (id: string, novo: string | string[] | boolean) =>
    onChange({ ...valor, [id]: novo });

  return (
    <div className="border-outline-variant flex flex-col gap-4 border-t pt-4">
      {campos.map((campo) => (
        <Campo
          key={campo.id}
          campo={campo}
          valor={valor[campo.id]}
          onChange={(novo) => alterar(campo.id, novo)}
        />
      ))}
    </div>
  );
}

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoDeItem;
  valor: string | string[] | boolean | undefined;
  onChange: (valor: string | string[] | boolean) => void;
}) {
  if (campo.type === 'simNao') {
    return (
      <Checkbox
        label={campo.label}
        checked={valor === true}
        onCheckedChange={(marcado) => onChange(marcado === true)}
      />
    );
  }

  if (campo.type === 'opcao') {
    return (
      <GlassSelect
        label={campo.label}
        /* A opção vazia é como se desfaz a escolha, e o placeholder repete o
           rótulo dela: sem isso o Radix desenha o gatilho em branco. */
        placeholder="Não informado"
        options={[
          { value: NAO_INFORMADO, label: 'Não informado' },
          ...campo.opcoes.map((opcao) => ({ value: opcao, label: opcao })),
        ]}
        value={typeof valor === 'string' ? valor : NAO_INFORMADO}
        onValueChange={onChange}
      />
    );
  }

  if (campo.type === 'multipla') {
    const marcados = Array.isArray(valor) ? valor : [];

    return (
      <fieldset>
        <legend className="text-on-surface-variant text-label-md mb-2 normal-case">
          {campo.label}
        </legend>
        <div className="flex flex-wrap gap-2">
          {campo.opcoes.map((opcao) => {
            const ativo = marcados.includes(opcao);

            return (
              <button
                key={opcao}
                type="button"
                aria-pressed={ativo}
                onClick={() =>
                  onChange(
                    ativo ? marcados.filter((atual) => atual !== opcao) : [...marcados, opcao],
                  )
                }
                className={cn(
                  'text-label-md focus-visible:ring-primary rounded-pill border px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
                  ativo
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-on-surface-variant hover:text-on-surface',
                )}
              >
                {opcao}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (campo.type === 'numero') {
    return (
      <GlassInput
        label={campo.unidade ? `${campo.label} (${campo.unidade})` : campo.label}
        inputMode={campo.decimais ? 'decimal' : 'numeric'}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(evento) =>
          onChange(
            campo.decimais
              ? maskDecimal(evento.target.value, campo.decimais)
              : maskInteger(evento.target.value, 7),
          )
        }
      />
    );
  }

  return (
    <GlassInput
      label={campo.label}
      placeholder={campo.placeholder ?? ''}
      value={typeof valor === 'string' ? valor : ''}
      onChange={(evento) => onChange(evento.target.value)}
    />
  );
}
