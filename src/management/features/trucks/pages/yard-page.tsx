import { GridIcon, MapPinIcon, PlusIcon, SearchIcon, TruckIcon } from '@/components/icons';
import type { Vehicle, VehicleStatus } from '@/management/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HeroBand, HERO_PILL } from '@/management/components/layout/hero-band';
import { QueryState } from '@/management/components/layout/query-state';
import { useSession } from '@/management/features/auth/store';
import {
  deleteVehicle,
  fetchVehicleRegistryList,
  setVehicleActive,
  type VehicleListEntry,
} from '@/management/lib/fleet-api';
import { Pagination } from '@/management/ui';
import { getVehicles } from '../api';
import { ConfirmDelete, ConfirmToggle } from '../components/vehicle-confirm-dialogs';
import { VehicleRegistryModal } from '../components/vehicle-registry-modal';
import { fetchVehicleReadiness } from '@/management/features/documents/api';
import { YardCard } from '../components/yard-card';
import {
  EMPTY_YARD_FILTERS,
  TODOS_OS_PATIOS,
  normalizeYardSearch,
  type YardFiltersValue,
} from '../yard-filters';
import { YardFilters } from '../components/yard-filters';
import { YARD_STATUS } from '../yard-status';
import './yard.css';

const patioDe = (vehicle: Vehicle) => vehicle.unit?.trim() || 'Sem pátio definido';
const STATUS_ORDER = Object.keys(YARD_STATUS) as VehicleStatus[];

/**
 * O ALVO de veículos por página, e não o teto.
 *
 * ⚠️ Uma empresa nunca é dividida, então a página fecha quando a próxima não
 * cabe: ela pode terminar com menos que isto, e uma empresa sozinha maior que
 * isto ocupa a página inteira. Ver `paginas`.
 */
const POR_PAGINA = 30;

/** Quanto tempo o aviso de veículos mudos fica na tela. O mesmo do mapa ao vivo. */
const AVISO_MS = 8000;

/** O valor do filtro preserva a filial integral; só o rótulo perde o prefixo comum. */
function shortUnitLabels(units: string[]) {
  let prefix = units.length > 1 ? (units[0] ?? '') : '';
  for (const unit of units.slice(1)) {
    let index = 0;
    while (index < prefix.length && prefix[index] === unit[index]) index++;
    prefix = prefix.slice(0, index);
  }
  const cut = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('-'));
  prefix = cut > 0 ? prefix.slice(0, cut + 1) : '';
  return units.map((unit) => ({
    value: unit,
    label: (prefix ? unit.slice(prefix.length).replace(/^[\s-·]+/, '') : unit) || unit,
  }));
}

/**
 * O pátio, e o cadastro da frota junto.
 *
 * ⚠️ **As duas telas viraram uma em 18/09/2026**, a pedido do usuário, pelo
 * mesmo motivo que juntou o cadastro de motorista dentro de Equipe: quem olha a
 * frota e vê um dado errado quer corrigir ali, e não procurar a mesma placa em
 * outra tela. O cartão leva à ficha; o rodapé dele edita, inativa e exclui.
 *
 * ⚠️ **São DUAS consultas, de duas origens, e isso não é desperdício.** A grade
 * desenha `getVehicles`, que é a telemetria e responde "onde está e como está";
 * as ações escrevem sobre `fetchVehicleRegistryList`, que é o nosso cadastro e é
 * quem sabe se a placa está ativa. Quem aparece só na telemetria fica sem ações,
 * porque não há ficha para editar.
 */
export function YardPage() {
  const queryClient = useQueryClient();
  const role = useSession()?.user.role;
  /*
   * ⚠️ Guarda de TELA, e não de segurança: quem autoriza é a API, que exige
   * `vehicles.update` e `vehicles.delete` em cada uma destas rotas. Aqui o papel
   * só decide se o rodapé do cartão aparece.
   */
  const podeAdministrar = role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 60_000,
  });
  /*
   * ⚠️ Carrega para TODO MUNDO desde 18/09/2026, e não só para quem administra:
   * é daqui que sai o `active`, e sem ele a grade não teria como esconder o
   * caminhão que saiu da frota. A rota é leitura livre na API, pela mesma razão
   * que o resto da frota é: saber que uma placa não roda mais é operação, e não
   * decisão de contrato. O que continua restrito ao gestor são as AÇÕES.
   */
  const registryQuery = useQuery({
    queryKey: ['vehicle-registry-list'],
    queryFn: fetchVehicleRegistryList,
  });
  /*
   * A situação documental, que é a TERCEIRA origem desta tela.
   *
   * ⚠️ **A grade não espera por ela.** O cartão aparece sem o selo enquanto a
   * consulta não chega, e o selo entra depois: documento é informação de apoio,
   * e segurar o pátio inteiro por causa dela atrasaria a pergunta que a tela
   * responde primeiro, que é onde cada caminhão está.
   *
   * ⚠️ Chave com o prefixo de `vehicle-documents` de propósito: uma coleta nova
   * invalida o prefixo e atualiza a fila de Documentos, a ficha e este selo de
   * uma vez.
   */
  const readinessQuery = useQuery({
    queryKey: ['vehicle-documents', 'readiness'],
    queryFn: fetchVehicleReadiness,
  });
  const [filters, setFilters] = useState<YardFiltersValue>(EMPTY_YARD_FILTERS);
  const [pagina, setPagina] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; vehicle: VehicleListEntry | null }>({
    open: false,
    vehicle: null,
  });
  const [confirming, setConfirming] = useState<VehicleListEntry | null>(null);
  const [deleting, setDeleting] = useState<VehicleListEntry | null>(null);

  /* O cruzamento é pelo id, que é o do nosso banco nas duas consultas. Casar por
     placa erraria justamente onde o cadastro ainda está torto, que é onde estas
     ações mais servem. */
  const registryById = useMemo(
    () => new Map((registryQuery.data ?? []).map((entry) => [entry.id, entry])),
    [registryQuery.data],
  );
  /* Pelo id, como o cadastro: casar por placa erraria justamente onde o cadastro
     ainda está torto. */
  const readinessById = useMemo(
    () => new Map((readinessQuery.data?.items ?? []).map((item) => [item.vehicleId, item])),
    [readinessQuery.data],
  );

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['vehicle-registry-list'] });
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setVehicleActive(id, active),
    onSuccess: (veiculo) => {
      toast.success(`${veiculo.plate} foi ${veiculo.active ? 'ativado' : 'inativado'}.`);
      recarregar();
      setConfirming(null);
    },
    onError: (erro) => {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível alterar o status.');
      setConfirming(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      toast.success(`${deleting?.plate ?? 'O veículo'} foi excluído.`);
      recarregar();
      setDeleting(null);
    },
    onError: (erro) => {
      /* ⚠️ A mensagem do backend vai inteira para a tela. É ela que diz o que
         prende o registro (viagem, evento, posição) e sugere tirar de serviço em
         vez de excluir. "Não foi possível excluir" deixaria a pessoa tentando de
         novo sem entender. */
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível excluir o veículo.');
      setDeleting(null);
    },
  });
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const patios = useMemo(
    () =>
      shortUnitLabels(
        [...new Set(vehicles.map(patioDe))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      ),
    [vehicles],
  );
  /**
   * O recorte por cadastro, aplicado ANTES de tudo.
   *
   * ⚠️ Entra no `scoped`, e não só na lista visível, porque `scoped` é o que
   * alimenta os indicadores do topo: fora dali, "Toda a frota: 40" contaria
   * caminhão que a grade não mostra, e o número deixaria de bater com o que se
   * vê logo abaixo dele.
   *
   * ⚠️ **Sem ficha, o veículo APARECE (`?? true`), e o motivo é o CARREGAMENTO.**
   * As duas consultas saem juntas e não chegam juntas: existe um intervalo em
   * que a grade já tem os veículos e o cadastro ainda não chegou. Nele o mapa
   * está vazio e toda busca falha. Assumindo ativo, a grade aparece inteira e os
   * inativos somem quando o cadastro chega; assumindo inativo, a tela piscaria
   * "Nenhum veículo encontrado" toda vez que alguém abrisse o pátio.
   *
   * Hoje não existe veículo sem ficha: `/v1/vehicles` e `/v1/vehicles/registry`
   * leem a MESMA tabela com o mesmo escopo. A guarda cobriria isso se as duas
   * divergirem um dia, mas é consequência, e não a razão de existir.
   *
   * A assimetria é deliberada nos dois casos: mostrar um caminhão que saiu da
   * frota é um incômodo, esconder um que está rodando é erro de operação, porque
   * some da tela de quem decide quem sai para a rua.
   */
  const naFrota = vehicles.filter((vehicle) => {
    if (filters.fleet === 'TODOS') return true;
    const ativo = registryById.get(vehicle.id)?.active ?? true;
    return filters.fleet === 'ATIVOS' ? ativo : !ativo;
  });
  const scoped = naFrota.filter(
    (vehicle) => filters.unit === TODOS_OS_PATIOS || patioDe(vehicle) === filters.unit,
  );
  const term = normalizeYardSearch(filters.search.trim());
  /*
   * ⚠️ Entra no `visible`, e não no `scoped`: os indicadores do topo contam
   * por SITUAÇÃO da telemetria, e um recorte documental ali faria "Disponíveis:
   * 27" virar outro número sem que ninguém tivesse mexido no filtro de situação.
   *
   * ⚠️ Veículo sem resposta da consulta NÃO some da grade quando o filtro está
   * ativo: ele simplesmente não casa com o recorte, que é diferente de ser
   * escondido. Com a consulta ainda em voo, o filtro não encontra nada, e isso é
   * honesto: ainda não sabemos.
   */
  const visible = scoped.filter(
    (vehicle) =>
      (filters.status === 'TODAS' || vehicle.status === filters.status) &&
      (filters.docs === 'TODOS' || readinessById.get(vehicle.id)?.level === filters.docs) &&
      (!term ||
        normalizeYardSearch(
          [
            vehicle.plate,
            vehicle.internalCode,
            vehicle.brand,
            vehicle.model,
            vehicle.driverName,
            patioDe(vehicle),
          ].join(' '),
        ).includes(term)),
  );
  const groups = new Map<string, Vehicle[]>();
  for (const vehicle of visible) {
    const unit = patioDe(vehicle);
    groups.set(unit, [...(groups.get(unit) ?? []), vehicle]);
  }

  /**
   * As páginas, montadas por EMPRESA e não por veículo.
   *
   * ⚠️ **Nenhuma empresa é dividida entre duas páginas** (decisão do usuário em
   * 18/09/2026). Cortar a cada 30 veículos deixaria metade de Queimados numa
   * página e metade na outra, com o mesmo título repetido nas duas: quem conta
   * os caminhões de uma filial passaria a precisar somar duas telas, e é
   * exatamente essa conta que o agrupamento existe para evitar.
   *
   * O algoritmo é o mais simples que respeita isso: percorre as empresas em
   * ordem e fecha a página quando a próxima não couber. Empresa maior que o
   * alvo ocupa a página inteira sozinha, porque dividi-la é o que não se faz.
   * Por isso as páginas não têm todas o mesmo tamanho, e a barra recebe
   * `pageCount` em vez de calcular por `total / pageSize`.
   */
  const paginas = useMemo(() => {
    const ordenadas = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
    const saida: [string, Vehicle[]][][] = [];
    let atual: [string, Vehicle[]][] = [];
    let cabem = 0;

    for (const grupo of ordenadas) {
      if (atual.length > 0 && cabem + grupo[1].length > POR_PAGINA) {
        saida.push(atual);
        atual = [];
        cabem = 0;
      }
      atual.push(grupo);
      cabem += grupo[1].length;
    }
    if (atual.length > 0) saida.push(atual);
    return saida;
    /* `groups` é remontado a cada render, então a dependência é o que o
       alimenta: a lista filtrada. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* A página é presa ao total durante o render: filtrar estando na página 3 de
     uma lista que passou a ter uma deixaria a grade vazia. */
  const totalPaginas = Math.max(1, paginas.length);
  const paginaAtual = Math.min(pagina, totalPaginas);
  const gruposDaPagina = paginas[paginaAtual - 1] ?? [];
  /* Onde esta página começa e termina na contagem de veículos, para a barra
     dizer "1 a 29 de 40" mesmo com páginas de tamanhos diferentes. */
  const antesDaPagina = paginas
    .slice(0, paginaAtual - 1)
    .reduce((soma, pag) => soma + pag.reduce((n, [, itens]) => n + itens.length, 0), 0);
  const naPagina = gruposDaPagina.reduce((n, [, itens]) => n + itens.length, 0);
  // A consulta periódica fornece um instante estável, sem Date.now() durante o render.
  const staleCount = scoped.filter((vehicle) => {
    const sync = vehicle.lastSyncAt ? Date.parse(vehicle.lastSyncAt) : NaN;
    return !Number.isFinite(sync) || vehiclesQuery.dataUpdatedAt - sync > 30 * 60_000;
  }).length;
  const ready = vehiclesQuery.isSuccess;

  /**
   * O aviso de veículos mudos, flutuante.
   *
   * ⚠️ **Era uma faixa fixa acima da grade e virou aviso em 18/09/2026**, a
   * pedido do usuário, para ficar igual ao do mapa ao vivo. O motivo é o mesmo
   * que valeu lá em 30/08: a faixa ocupava uma linha inteira o tempo todo,
   * repetindo um recado que se lê uma vez, e empurrava os cartões para baixo.
   *
   * ⚠️ A guarda pelo número anterior é o que torna isto usável. A tela
   * repergunta a cada 60 s, e sem ela o mesmo aviso reapareceria de minuto em
   * minuto até virar ruído que se aprende a ignorar. Ele volta quando a
   * CONTAGEM muda, que é quando há de fato algo novo a dizer.
   */
  const avisado = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || staleCount === 0) {
      avisado.current = 0;
      return;
    }
    if (avisado.current === staleCount) return;
    avisado.current = staleCount;

    toast.warning(
      staleCount === 1
        ? '1 veículo sem sincronização recente'
        : `${staleCount} veículos sem sincronização recente`,
      {
        description: 'Dados ausentes ou há mais de 30 minutos sem atualizar.',
        duration: AVISO_MS,
        /* Um id fixo troca o conteúdo do aviso que já está na tela em vez de
           empilhar um segundo: a contagem pode mudar duas vezes seguidas. */
        id: 'patio-sem-sincronizar',
      },
    );
  }, [ready, staleCount]);

  /*
   * ⚠️ **O aviso sai junto com a tela** (pedido do usuário em 19/09/2026). O
   * `Toaster` vive no layout, acima das rotas, então o toast sobrevive à
   * navegação: quem trocasse de tela antes dos segundos acabarem levava para a
   * tela nova um aviso sobre a frota do Pátio, sem nada ali que o explicasse.
   *
   * ⚠️ **O efeito é separado e com lista de dependências VAZIA, de propósito.**
   * Dispensar no `return` do efeito de cima faria o aviso piscar a cada
   * mudança de contagem, porque aquele efeito roda de novo a cada
   * `staleCount`. Este só roda na desmontagem.
   */
  useEffect(
    () => () => {
      /* ⚠️ Chave no corpo: `toast.dismiss` DEVOLVE o id, e um `return` implícito
         aqui faria o cleanup devolver `string`, que o TypeScript recusa. */
      toast.dismiss('patio-sem-sincronizar');
    },
    [],
  );

  return (
    <>
      {/*
       * ⚠️ A FAIXA LARANJA é o cabeçalho de página do painel (decisão do usuário
       * em 16/09/2026), no lugar do cabeçalho próprio que esta tela tinha. Ela
       * traz a topbar dentro, então **não se põe `AppTopbar` junto**: sairiam
       * duas barras, uma sobre a outra.
       *
       * ⚠️ **O "Consultado às" e o "Atualizar" saíram em 18/09/2026**, a pedido
       * do usuário. A consulta se refaz sozinha a cada 60 s e o rodapé da grade
       * já diz isso, então as duas pastilhas gastavam a faixa repetindo o que o
       * relógio da máquina responde. Cadastrar é a única ação que ficou.
       */}
      <HeroBand
        title="Pátio"
        description="Sua frota, um olhar. Saiba com quem contar para a próxima viagem."
      >
        {podeAdministrar ? (
          <button
            type="button"
            className={`${HERO_PILL} text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2`}
            onClick={() => setDialog({ open: true, vehicle: null })}
          >
            <PlusIcon size={15} aria-hidden="true" />
            Cadastrar caminhão
          </button>
        ) : null}
      </HeroBand>

      <div className="yard-page">
        {/*
         * ⚠️ **Os indicadores vêm ANTES dos filtros desde 18/09/2026**, a pedido
         * do usuário, que é a ordem que a tela de Equipe já usa: primeiro o
         * número que resume a frota, depois o que recorta a lista. Eles também
         * SÃO filtro, então a inversão não separa leitura de ação, só põe o
         * panorama na altura em que o olho chega.
         */}
        <div className="yard-summary" role="group" aria-label="Filtrar por situação">
          <button
            type="button"
            className="yard-summary-item"
            aria-pressed={filters.status === 'TODAS'}
            onClick={() => setFilters({ ...filters, status: 'TODAS' })}
          >
            <span className="yard-summary-label">
              <TruckIcon size={16} aria-hidden="true" />
              Toda a frota
            </span>
            <strong>{ready ? scoped.length : '—'}</strong>
            <span className="yard-summary-hint">
              {filters.unit === TODOS_OS_PATIOS ? 'em todos os pátios' : 'na filial selecionada'}
            </span>
          </button>
          {STATUS_ORDER.map((status) => {
            const config = YARD_STATUS[status];
            const Icon = config.icon;
            return (
              <button
                key={status}
                type="button"
                className="yard-summary-item"
                data-tone={config.tone}
                aria-pressed={filters.status === status}
                onClick={() =>
                  setFilters({ ...filters, status: filters.status === status ? 'TODAS' : status })
                }
              >
                <span className="yard-summary-label">
                  <Icon size={16} aria-hidden="true" />
                  {config.plural}
                </span>
                <strong>
                  {ready ? scoped.filter((vehicle) => vehicle.status === status).length : '—'}
                </strong>
                <span className="yard-summary-hint">
                  {status === 'DISPONIVEL'
                    ? 'prontos para alocar'
                    : status === 'EM_VIAGEM'
                      ? 'em rota externa'
                      : status === 'SEM_SINAL'
                        ? 'verificar telemetria'
                        : status === 'BLOQUEADO'
                          ? 'saída impedida'
                          : 'cuidados técnicos'}
                </span>
              </button>
            );
          })}
        </div>

        <YardFilters value={filters} onChange={setFilters} patios={patios} />

        <section className="yard-board" aria-labelledby="yard-board-title">
          <div className="yard-board-header">
            <div>
              <h2 id="yard-board-title">
                <GridIcon size={19} aria-hidden="true" />
                Visão do pátio
              </h2>
              <p>Veículos organizados por filial de vínculo.</p>
            </div>
            <span className="yard-result-count" role="status">
              {ready ? `${visible.length} de ${scoped.length} veículos` : 'Aguardando dados'}
            </span>
          </div>
          <QueryState
            isPending={vehiclesQuery.isPending}
            isError={vehiclesQuery.isError}
            error={vehiclesQuery.error}
            label="o pátio"
          >
            {visible.length === 0 ? (
              <div className="yard-empty">
                <SearchIcon size={30} aria-hidden="true" />
                <h3>
                  {vehicles.length ? 'Nenhum veículo encontrado' : 'Seu pátio ainda está vazio'}
                </h3>
                <p>
                  {vehicles.length
                    ? 'Experimente outra placa, filial ou situação.'
                    : 'Os veículos aparecerão aqui quando estiverem disponíveis na frota.'}
                </p>
                {vehicles.length > 0 && (
                  <button
                    type="button"
                    className="yard-empty-action"
                    onClick={() => setFilters(EMPTY_YARD_FILTERS)}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="yard-groups">
                {gruposDaPagina.map(([unit, items]) => (
                  <section className="yard-group" key={unit} aria-label={unit}>
                    <div className="yard-group-header">
                      <div>
                        <MapPinIcon size={16} aria-hidden="true" />
                        <h3 title={unit}>
                          {patios.find((patio) => patio.value === unit)?.label ?? unit}
                        </h3>
                        <span>
                          {items.length} {items.length === 1 ? 'veículo' : 'veículos'}
                        </span>
                      </div>
                      <span className="yard-group-caption">FILIAL DE VÍNCULO</span>
                    </div>
                    <ul className="yard-grid">
                      {items.map((vehicle) => (
                        <li key={vehicle.id}>
                          <YardCard
                            vehicle={vehicle}
                            registry={registryById.get(vehicle.id)}
                            readiness={readinessById.get(vehicle.id)}
                            {...(podeAdministrar
                              ? {
                                  onEditar: (entry: VehicleListEntry) =>
                                    setDialog({ open: true, vehicle: entry }),
                                  onAlternar: setConfirming,
                                  onExcluir: setDeleting,
                                }
                              : {})}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </QueryState>

          {/*
           * ⚠️ `pageCount` e o intervalo vêm prontos: as páginas do pátio têm
           * tamanhos diferentes porque cada uma leva empresas inteiras, e a
           * conta padrão da barra pressupõe página de tamanho fixo.
           *
           * ⚠️ **A barra É o rodapé do quadro desde 19/09/2026** (pedido do
           * usuário), e por isso encosta nas bordas em vez de flutuar com
           * `mt-6`. Abaixo dela havia uma faixa só para dizer "Agrupamento por
           * filial. A posição na grade não indica vaga física": o título da
           * seção já diz que o agrupamento é por filial, e ninguém procura vaga
           * numa grade que mostra seis colunas iguais. Duas faixas empilhadas
           * no pé, uma delas explicando o óbvio.
           *
           * O "Consulta automática a cada 60 s" tinha saído dali em 18/09/2026,
           * pelo mesmo motivo.
           */}
          <Pagination
            className="yard-board-footer"
            page={paginaAtual}
            total={visible.length}
            pageCount={totalPaginas}
            rangeStart={antesDaPagina + 1}
            rangeEnd={antesDaPagina + naPagina}
            onPageChange={setPagina}
            label="veículos"
          />
        </section>
      </div>

      <VehicleRegistryModal
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, vehicle: open ? dialog.vehicle : null })}
        vehicleId={dialog.vehicle?.id ?? null}
        plate={dialog.vehicle?.plate ?? null}
      />

      <ConfirmToggle
        vehicle={confirming}
        pending={toggle.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          confirming && toggle.mutate({ id: confirming.id, active: !confirming.active })
        }
      />

      <ConfirmDelete
        vehicle={deleting}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
