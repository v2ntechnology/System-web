import { ClockCountdownIcon, ExternalLinkIcon, FileIcon } from '@/components/icons';

import type { Fine } from '../types';

/**
 * Uma infração na fila.
 *
 * ⚠️ **A gramática é a das FILAS de decisão**, a mesma de Impedimentos e
 * Liberações: linha larga sobre o papel branco, severidade no contorno e a
 * palavra do nível escrita. Cor sozinha não basta (RNF-028).
 */
export function FineRow({ fine, onOpen }: { fine: Fine; onOpen: () => void }) {
  const vencida = estaVencida(fine);
  const prazo = diasAte(fine.indicationDeadline);

  return (
    /*
     * ⚠️ **O cartão inteiro abre o detalhe**, como o do Pátio e o do motorista.
     * Quem dá acessibilidade é o botão do título, e não o clique do bloco: um
     * `article` com `onClick` não recebe foco nem responde ao Enter.
     *
     * ⚠️ **Os links do rodapé param a propagação**, senão abrir o PDF abriria o
     * diálogo por trás dele.
     */
    <article
      onClick={onOpen}
      className={[
        'ring-light-edge bg-light cursor-pointer rounded-3xl p-4 ring-1 transition-shadow sm:p-5',
        'hover:ring-outline-variant',
        vencida ? 'ring-error/45' : '',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="text-on-light text-title-sm focus-visible:ring-primary rounded font-semibold focus-visible:outline-none focus-visible:ring-2"
            >
              {fine.plate}
              <span className="sr-only">, abrir detalhes da infração</span>
            </button>

            <span className="text-on-light-variant text-label-sm">
              {fine.stage === 'MULTA' ? 'Multa' : 'Notificação'}
            </span>

            {/*
             * ⚠️ **O aviso de placa sem cadastro é a razão de ela aparecer.**
             * O token da Smartec alcança a frota do grupo inteiro, então há
             * placa aqui que é de outra empresa. Sem esta marca, a linha leria
             * como frota nossa, e o número do topo passaria a não fechar com a
             * lista sem explicação nenhuma.
             */}
            {fine.registered ? null : (
              <span className="text-on-light-variant ring-outline-variant text-label-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1">
                <ExternalLinkIcon className="size-3.5" aria-hidden />
                Sem cadastro no sistema
              </span>
            )}

            {/*
             * ⚠️ **Paga e vencida nunca aparecem juntas**, e quem garante isso
             * é `estaVencida`, que devolve falso para o que consta pago. Sem
             * essa guarda, a multa quitada em 2025 ficaria vermelha para
             * sempre, porque a data dela passou mesmo.
             */}
            {fine.paymentConfirmed ? (
              <span className="text-success-on-light text-label-sm font-medium">
                {fine.paidAt ? `Paga em ${formatarData(fine.paidAt)}` : 'Paga'}
              </span>
            ) : null}

            {vencida ? <span className="text-error text-label-sm font-medium">Vencida</span> : null}
          </div>

          <p className="text-on-light text-body-md mt-1">
            {fine.description ?? 'Infração sem descrição na origem'}
          </p>

          <p className="text-on-light-variant text-body-sm mt-1">
            {[
              formatarData(fine.infractionAt),
              fine.location,
              fine.city && fine.uf ? `${fine.city}/${fine.uf}` : fine.uf,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="text-right">
          <p className="text-on-light text-title-sm font-semibold">{moeda(fine.amount)}</p>
          {/*
           * ⚠️ O valor PAGO só aparece quando difere do valor da multa, e é
           * assim que o desconto fica visível: pagar em até 30 dias costuma
           * render abatimento, e é o número de baixo que entra no custo da
           * frota, não o de cima.
           */}
          {fine.paymentConfirmed && fine.paidAmount !== null && fine.paidAmount !== fine.amount ? (
            <p className="text-on-light-variant text-body-sm">Pago {moeda(fine.paidAmount)}</p>
          ) : null}
          {fine.points ? (
            <p className="text-on-light-variant text-body-sm">{fine.points} pontos</p>
          ) : null}
        </div>
      </header>

      {/*
       * ⚠️ **A base do veículo NÃO entra aqui**, e o campo existe no contrato de
       * propósito, sem uso na tela. O `unit` nasce do subgrupo da MiX, que não é
       * estrutura de operação: na frota real quatro deles se chamam "Default
       * Site" e cinco se chamam "DESLIGADOS / INATIVOS". A primeira versão desta
       * linha escrevia "Base DESLIGADOS/INATIVOS" ao lado de uma multa, o que
       * transforma erro de cadastro do fornecedor em informação de negócio.
       *
       * O que a linha mostra de localização é a UF da INFRAÇÃO, acima, que veio
       * do órgão autuador e é dado do próprio auto.
       */}
      <footer className="text-on-light-variant text-body-sm mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {fine.agency ? <span>{fine.agency}</span> : null}
        {fine.dueDate ? <span>Vence {formatarData(fine.dueDate)}</span> : null}

        {/*
         * ⚠️ **O prazo de indicação é o que dá valor à notificação.** Passada a
         * data, perde-se a chance de dizer quem dirigia, e a pontuação fica com
         * a empresa. Por isso ele aparece em destaque, e só enquanto vale.
         */}
        {prazo !== null && prazo >= 0 ? (
          <span className="text-warning inline-flex items-center gap-1 font-medium">
            <ClockCountdownIcon className="size-4" aria-hidden />
            {prazo === 0 ? 'Último dia para indicar condutor' : `Indicar em ${prazo} dias`}
          </span>
        ) : null}

        {fine.documentUrl ? (
          <a
            href={fine.documentUrl}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noreferrer"
            className="text-primary-on-light inline-flex items-center gap-1 font-medium hover:underline"
          >
            <FileIcon className="size-4" aria-hidden />
            {fine.stage === 'MULTA' ? 'Ver penalidade' : 'Ver notificação'}
          </a>
        ) : null}

        {fine.boletoUrl ? (
          <a
            href={fine.boletoUrl}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noreferrer"
            className="text-primary-on-light inline-flex items-center gap-1 font-medium hover:underline"
          >
            Boleto
            {fine.boletoDiscountPercent ? ` (${fine.boletoDiscountPercent}% de desconto)` : ''}
          </a>
        ) : null}
      </footer>
    </article>
  );
}

/** Data em dd/mm/aaaa, aceitando data pura ou instante. */
function formatarData(valor: string | null): string | null {
  if (!valor) return null;
  const d = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

function moeda(valor: number | null): string {
  if (valor === null) return 'Sem valor informado';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * ⚠️ **Só é "vencida" o que tem data E não consta pago.** Sem a segunda
 * condição, multa quitada apareceria em vermelho para sempre.
 */
function estaVencida(fine: Fine): boolean {
  if (!fine.dueDate || fine.paymentConfirmed) return false;
  const d = new Date(`${fine.dueDate}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function diasAte(valor: string | null): number | null {
  if (!valor) return null;
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}
