import { ClockIcon, MaintenanceIcon, RouteIcon, WarningIcon } from '@/components/icons';
import { Pagination, StatusChip, cn } from '@/management/ui';
import { useMemo, useState, type ReactNode } from 'react';

import { formatAlertDescription, type VeiculoComAlerta } from '../alerts';

/**
 * O que a rede CAN acusou de mecânico, por veículo.
 *
 * <h2>Por que isto existe</h2>
 *
 * A tela de Manutenção inteira era um aviso de origem ausente, e isso estava
 * certo pela metade: ordem de serviço, oficina e plano preventivo de fato não
 * existem no sistema. Mas o rastreador acusa problema mecânico o tempo todo, e
 * ninguém estava olhando: **22.307 ocorrências em 30 dias, em 33 veículos**,
 * medido em 06/09/2026.
 *
 * <h2>⚠️ Contagem, e não diagnóstico</h2>
 *
 * O evento diz que o sensor disparou, e não que a peça está ruim. É a diferença
 * entre "este caminhão acusou pressão baixa de óleo 4.170 vezes" e "este
 * caminhão está com problema no motor". A primeira é o que temos; a segunda é
 * conclusão de quem entende, com o veículo na frente. Por isso a ressalva está
 * na linha de contexto da fila, e não escondida num rodapé.
 *
 * <h2>⚠️ Fila, e não cartão de vidro (08/09/2026)</h2>
 *
 * Era um `GlassCard` flutuando no papel, escrito nos tokens `on-surface`. Agora
 * mora dentro do painel branco da página, no mesmo arranjo de
 * `/gestao/impedimentos`: faixa, cards que mordem a borda, painel. Daí os tokens
 * `on-light` (os mesmos que `BlockerRow` usa) e a linha com trilho, ícone,
 * placa, etiquetas e o número forte à direita.
 */

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const data = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Quantos veículos cabem numa página.
 *
 * ⚠️ Paginação, e não mais um "ver os outros 23 veículos" (decisão do usuário em
 * 08/09/2026). O botão de expandir só tem dois estados, curto e inteiro: com 33
 * caminhões o "inteiro" é uma lista sem fim, sem noção de tamanho nem lugar para
 * voltar depois de rolar. A barra é a mesma dos cadastros de frota e de
 * motoristas, e ela já diz "1 a 8 de 33".
 */
const POR_PAGINA = 8;

/**
 * A fileira de tipos, no desenho de `KindFilters` da tela de impedimentos.
 *
 * Serve a duas coisas ao mesmo tempo: dar a dimensão de cada tipo antes das
 * placas, e recortar a fila ao ser clicado. Clicar no tipo já escolhido devolve
 * a fila inteira. As contagens são sempre da janela inteira: se seguissem o
 * filtro, escolher um tipo zeraria os outros.
 */
export function MechanicalKindFilters({
  porTipo,
  selected,
  onSelect,
}: {
  porTipo: [string, number][];
  selected: string | null;
  onSelect: (tipo: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {porTipo.map(([descricao, quantidade]) => {
        const active = selected === descricao;

        return (
          <button
            key={descricao}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : descricao)}
            className={cn(
              'group flex min-w-0 items-center gap-2 rounded-md px-3.5 py-2.5 text-left transition-colors',
              'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'bg-primary-strong text-on-primary'
                : 'bg-light-container text-on-light-variant hover:bg-primary/10 hover:text-primary',
            )}
          >
            <WarningIcon size={15} className="shrink-0" aria-hidden="true" />
            <span className="text-label-md min-w-0 flex-1 truncate normal-case">
              {formatAlertDescription(descricao)}
            </span>
            <span
              className={cn(
                'tabular shrink-0 font-semibold transition-colors',
                active ? 'text-on-primary' : 'text-accent group-hover:text-primary',
              )}
            >
              {inteiro.format(quantidade)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A fila de veículos que estão acusando alerta mecânico.
 *
 * Fila única, do que mais dispara para o que menos dispara: o topo é o caminhão
 * que a oficina examina primeiro. O filtro por tipo muda o que entra na fila,
 * nunca a ordem.
 */
export function MechanicalAlertsQueue({
  veiculos,
  note,
  action,
  emptyMessage = 'Nenhum alerta mecânico neste recorte.',
  page,
  onPageChange,
}: {
  veiculos: VeiculoComAlerta[];
  /** Linha de contexto acima da lista, como o recorte que está em vigor. */
  note?: ReactNode | undefined;
  /** Ação do cabeçalho, como limpar o filtro. */
  action?: ReactNode | undefined;
  emptyMessage?: string | undefined;
  /**
   * Página atual, começando em 1.
   *
   * Vem de fora porque quem filtra é a página: trocar de tipo com a página 4 em
   * pé deixaria a fila vazia, e só quem mexe no filtro sabe a hora de voltar
   * para a primeira.
   */
  page?: number | undefined;
  onPageChange?: ((page: number) => void) | undefined;
}) {
  /* Estado próprio para quem não passa `page`: a fila continua paginando
     sozinha, e a página que manda é a de fora quando ela existe. */
  const [paginaInterna, setPaginaInterna] = useState(1);
  const pedida = page ?? paginaInterna;
  const irPara = onPageChange ?? setPaginaInterna;

  /* A página é presa ao total durante o render, e não corrigida por efeito:
     filtrar na página 4 de uma lista que passou a ter 6 deixaria a tela vazia.
     Mesmo padrão dos cadastros de frota e de motoristas. */
  const totalPaginas = Math.max(1, Math.ceil(veiculos.length / POR_PAGINA));
  const paginaAtual = Math.min(pedida, totalPaginas);

  const mostrados = useMemo(
    () => veiculos.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [veiculos, paginaAtual],
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-sora text-on-light text-headline-md tracking-[-0.02em]">
          Fila por veículo
        </h2>
        {action}
      </div>

      {note ? (
        <p className="text-on-light-muted text-label-md -mt-2 mb-3 normal-case">{note}</p>
      ) : null}

      {veiculos.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">{emptyMessage}</p>
      ) : (
        <ol className="flex flex-col">
          {mostrados.map((veiculo) => (
            <li
              key={veiculo.vehicleId}
              className="border-light-outline flex items-stretch gap-4 border-b py-4 last:border-b-0"
            >
              {/* ⚠️ Trilho de VOLUME, e não de gravidade: quem dispara mais é
                  quem a oficina olha primeiro, e o dado não autoriza dizer mais
                  que isso. A cor repete o número à direita, nunca o substitui. */}
              <span
                className="bg-warning-on-light/50 w-1 shrink-0 rounded-full"
                aria-hidden="true"
              />

              <span className="bg-on-light/[0.06] text-on-light-variant mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-md sm:flex">
                <MaintenanceIcon size={18} aria-hidden="true" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular font-sora text-on-light text-body-lg font-bold tracking-[-0.01em]">
                    {veiculo.plate}
                  </span>
                  {veiculo.model ? (
                    <span className="text-on-light-muted text-label-md truncate normal-case">
                      {veiculo.model}
                    </span>
                  ) : null}
                  {veiculo.unidade ? (
                    <StatusChip surface="light">{veiculo.unidade}</StatusChip>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {veiculo.tipos.map((tipo) => (
                    <StatusChip
                      key={tipo.description}
                      tone="attention"
                      surface="light"
                      icon={<WarningIcon size={13} aria-hidden="true" />}
                    >
                      {formatAlertDescription(tipo.description)}
                      <span className="tabular font-semibold">
                        {inteiro.format(tipo.occurrences)}
                      </span>
                    </StatusChip>
                  ))}
                </div>

                <p className="text-on-light-muted text-label-sm flex flex-wrap items-center gap-x-3 gap-y-1 normal-case">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon size={13} className="shrink-0" aria-hidden="true" />
                    último em{' '}
                    <span className="tabular">{data.format(new Date(veiculo.ultimo))}</span>
                  </span>
                  {/* O odômetro responde a pergunta que a data não responde: em
                      que quilometragem o alerta apareceu. */}
                  {veiculo.odometro != null ? (
                    <span className="flex items-center gap-1.5">
                      <RouteIcon size={13} className="shrink-0" aria-hidden="true" />
                      <span className="tabular">{inteiro.format(veiculo.odometro)} km</span>
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular font-sora text-on-light text-body-lg font-bold">
                  {inteiro.format(veiculo.total)}
                </span>
                <span className="text-on-light-muted text-label-sm normal-case">ocorrências</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Pagination
        className="mt-6"
        page={paginaAtual}
        total={veiculos.length}
        pageSize={POR_PAGINA}
        onPageChange={irPara}
        label="veículos"
      />
    </section>
  );
}
