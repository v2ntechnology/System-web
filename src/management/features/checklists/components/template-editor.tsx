import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryState } from '@/management/components/layout/query-state';
import { LightCard, StatusChip, cn } from '@/management/ui';

import {
  TIPOS_DE_VEICULO,
  getModelo,
  getResumoDosModelos,
  publicarModelo,
  rotuloDoTipo,
  type ItemDoModelo,
  type ResumoDoModelo,
} from '../template-api';

/**
 * O editor do checklist da frota.
 *
 * ⚠️ **POR TIPO DE VEÍCULO, E NÃO POR VEÍCULO.** Decisão do usuário em 24/09/2026,
 * depois de considerar pôr isto na ficha de um caminhão. Ali o gestor editaria
 * achando que mexe naquele veículo, e estaria mudando o que a frota inteira daquele
 * tipo confere na saída. Aqui o endereço já diz o alcance, e a confirmação repete o
 * número de veículos alcançados.
 *
 * ⚠️ **Publicar cria versão nova.** A anterior fica guardada, porque cada
 * preenchimento aponta para a versão dele: editar no lugar faria um checklist de
 * março passar a exibir as perguntas de setembro, e ninguém notaria.
 */
export function TemplateEditor() {
  const [tipo, setTipo] = useState<string>('truck');
  const resumo = useQuery({ queryKey: ['checklist-templates'], queryFn: getResumoDosModelos });

  return (
    <div className="grid gap-4">
      <LightCard title="Checklist por tipo de veículo">
        <p className="text-on-light-variant text-body-md mb-5">
          Cada tipo tem a sua lista. Publicar alcança <strong>todos</strong> os veículos daquele
          tipo, e cria uma versão nova: a anterior fica guardada, porque cada preenchimento aponta
          para a versão que estava na tela naquele dia.
        </p>

        <QueryState isPending={resumo.isPending} isError={resumo.isError} label="os checklists">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {TIPOS_DE_VEICULO.map((t) => {
              const dados = resumo.data?.find((r) => r.vehicleType === t.id);
              const ativo = tipo === t.id;

              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTipo(t.id)}
                    aria-pressed={ativo}
                    className={cn(
                      'w-full rounded-lg p-3 text-left transition',
                      ativo
                        ? 'bg-accent-soft ring-accent ring-1'
                        : 'bg-surface-lowest hover:bg-surface-low',
                    )}
                  >
                    <span className="text-on-surface block font-semibold">{t.label}</span>
                    <span className="tabular text-on-surface-muted text-label-md normal-case">
                      {dados?.name ? `${dados.itens} itens · v${dados.version}` : 'sem checklist'}
                    </span>
                    {/* ⚠️ O alcance, dito antes de qualquer edição. */}
                    <span className="text-on-surface-muted text-label-md mt-1 block normal-case">
                      {dados?.veiculos ?? 0} veículo(s) na frota
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </QueryState>
      </LightCard>

      <EditorDoTipo
        key={tipo}
        vehicleType={tipo}
        resumo={resumo.data?.find((r) => r.vehicleType === tipo)}
      />
    </div>
  );
}

/**
 * ⚠️ `resumo: ResumoDoModelo | undefined`, e não `resumo?:`.
 *
 * O projeto usa `exactOptionalPropertyTypes`, onde as duas coisas são diferentes:
 * a segunda quer dizer "pode não vir", e passar `undefined` explicitamente é erro.
 * Aqui ele vem de um `find` que pode não achar, então o `undefined` é um valor de
 * verdade e precisa estar no tipo.
 */
function EditorDoTipo({
  vehicleType,
  resumo,
}: {
  vehicleType: string;
  resumo: ResumoDoModelo | undefined;
}) {
  const queryClient = useQueryClient();

  const modelo = useQuery({
    queryKey: ['checklist-template', vehicleType],
    queryFn: () => getModelo(vehicleType),
    retry: false,
  });

  /*
   * ⚠️ O rascunho começa NULO e o que está na tela é derivado, em vez de copiado
   * para o estado por um efeito.
   *
   * Copiar com `useEffect` funcionava e tinha dois defeitos: uma renderização
   * descartada a cada carregamento, e a chance de o efeito sobrescrever o que o
   * gestor acabou de digitar se a consulta revalidasse no meio da edição. Derivado,
   * o servidor manda enquanto ninguém mexeu, e o rascunho manda depois da primeira
   * edição. O `key={tipo}` lá em cima é o que zera tudo ao trocar de tipo.
   */
  const [rascunho, setRascunho] = useState<{ nome: string; itens: ItemDoModelo[] } | null>(null);

  const nome = rascunho?.nome ?? modelo.data?.name ?? '';
  const itens = rascunho?.itens ?? modelo.data?.itens ?? [];

  function editar(patch: { nome?: string; itens?: ItemDoModelo[] }) {
    setRascunho({ nome: patch.nome ?? nome, itens: patch.itens ?? itens });
  }

  const setNome = (valor: string) => editar({ nome: valor });
  const setItens = (proximos: ItemDoModelo[] | ((atual: ItemDoModelo[]) => ItemDoModelo[])) =>
    editar({ itens: typeof proximos === 'function' ? proximos(itens) : proximos });

  const publicar = useMutation({
    mutationFn: () => publicarModelo(vehicleType, { name: nome, items: itens }),
    onSuccess: (novo) => {
      toast.success(
        `Checklist de ${rotuloDoTipo(vehicleType)} publicado na versão ${novo.version}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['checklist-template', vehicleType] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  function mudar(indice: number, patch: Partial<ItemDoModelo>) {
    setItens(itens.map((item, i) => (i === indice ? { ...item, ...patch } : item)));
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= itens.length) return;
    /*
     * ⚠️ Sem troca por índice: com `noUncheckedIndexedAccess`, `copia[i]` é
     * `ItemDoModelo | undefined`, e a troca em duas pontas não convence o
     * compilador de que os dois existem. Reconstruir a lista diz a mesma coisa sem
     * precisar de `!`, que é o que se usaria para calar o erro em vez de resolvê-lo.
     */
    const a = itens[indice];
    const b = itens[destino];
    if (!a || !b) return;
    setItens(itens.map((item, i) => (i === indice ? b : i === destino ? a : item)));
  }

  const campo = 'border-outline-variant bg-surface text-on-surface rounded border px-2 py-1';
  const semItens = itens.length === 0;

  return (
    <LightCard title={`Itens do checklist: ${rotuloDoTipo(vehicleType)}`}>
      <QueryState
        isPending={modelo.isPending}
        isError={modelo.isError && semItens}
        label="o checklist deste tipo"
      >
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-on-light-variant text-label-md">Nome do checklist</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Check list de saída"
              className="border-outline-variant bg-surface-lowest text-on-surface rounded-lg border px-3 py-2"
            />
          </label>

          <ol className="grid gap-2">
            {itens.map((item, i) => (
              <li key={i} className="bg-surface-lowest grid gap-2 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-on-surface-muted text-label-md w-6">{i + 1}</span>
                  <input
                    value={item.label}
                    onChange={(e) => mudar(i, { label: e.target.value })}
                    placeholder="O que se confere"
                    className={cn(campo, 'min-w-48 flex-1')}
                  />
                  <input
                    value={item.section}
                    onChange={(e) => mudar(i, { section: e.target.value })}
                    placeholder="Seção"
                    className={cn(campo, 'w-40')}
                  />
                </div>

                <input
                  value={item.hint ?? ''}
                  onChange={(e) => mudar(i, { hint: e.target.value })}
                  placeholder="Dica para o motorista (opcional)"
                  className={campo}
                />

                <div className="flex flex-wrap items-center gap-4">
                  {/* ⚠️ A única caixa desta tela que deixa um caminhão parado no
                      pátio. O rótulo diz a consequência, e não o nome do campo. */}
                  <label className="text-on-surface text-label-md flex items-center gap-2 normal-case">
                    <input
                      type="checkbox"
                      checked={item.blocking}
                      onChange={(e) => mudar(i, { blocking: e.target.checked })}
                    />
                    Reprovar para o caminhão
                  </label>

                  <label className="text-on-surface text-label-md flex items-center gap-2 normal-case">
                    <input
                      type="checkbox"
                      checked={item.requiresPhotoOnFail}
                      onChange={(e) => mudar(i, { requiresPhotoOnFail: e.target.checked })}
                    />
                    Exige foto ao reprovar
                  </label>

                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      aria-label={`Mover ${item.label || 'item'} para cima`}
                      className="text-on-surface-muted hover:text-on-surface px-2"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      aria-label={`Mover ${item.label || 'item'} para baixo`}
                      className="text-on-surface-muted hover:text-on-surface px-2"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setItens(itens.filter((_, x) => x !== i))}
                      aria-label={`Remover ${item.label || 'item'}`}
                      className="text-error px-2"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() =>
              setItens([
                ...itens,
                { section: 'Geral', label: '', blocking: false, requiresPhotoOnFail: true },
              ])
            }
            className="border-outline-variant text-on-surface rounded-lg border border-dashed px-3 py-2"
          >
            Acrescentar item
          </button>

          {/* ⚠️ A ordem da lista É a ordem da volta no caminhão: mover um item aqui
              muda o caminho que o motorista faz em volta do veículo. */}
          <p className="text-on-light-variant text-label-md normal-case">
            A ordem desta lista é a ordem em que o motorista dá a volta no caminhão.
          </p>

          <div className="border-outline-variant mt-2 flex flex-wrap items-center gap-3 border-t pt-3">
            <StatusChip tone="info">v{resumo?.version ?? 1} no ar</StatusChip>
            <span className="tabular text-on-surface-muted text-label-md normal-case">
              {itens.length} itens · {itens.filter((i) => i.blocking).length} travam o caminhão
            </span>

            <button
              type="button"
              disabled={publicar.isPending || semItens}
              onClick={() => {
                /* ⚠️ A confirmação carrega o NÚMERO. "Alcança 12 caminhões" é o que
                   faz alguém parar e reler antes de publicar. */
                const alcance = resumo?.veiculos ?? 0;
                const ok = window.confirm(
                  `Publicar alcança ${alcance} veículo(s) do tipo ${rotuloDoTipo(vehicleType)}, ` +
                    'a partir do próximo checklist aberto. A versão atual fica guardada. Publicar?',
                );
                if (ok) publicar.mutate();
              }}
              className="bg-accent-solid text-on-accent ml-auto rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
            >
              {publicar.isPending ? 'Publicando…' : 'Publicar versão nova'}
            </button>
          </div>

          {semItens ? (
            <p className="text-error text-label-md normal-case">
              Um checklist vazio na tela do motorista parece checklist cumprido. Acrescente ao menos
              um item.
            </p>
          ) : null}
        </div>
      </QueryState>
    </LightCard>
  );
}
