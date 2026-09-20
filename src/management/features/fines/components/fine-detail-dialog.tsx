import { ExternalLinkIcon, FileIcon, WarningIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';

import { GlassModal, SpectrumButton } from '@/management/ui';

import { fetchFine } from '../api';
import type { Fine } from '../types';

/**
 * A infração inteira, aberta da lista.
 *
 * ⚠️ **A lista mostra o que cabe numa linha; aqui vai o que a origem entrega.**
 * São 44 campos no retorno da Smartec, e a maioria só importa quando alguém
 * está decidindo o que fazer com aquela multa: número do auto, órgão, código da
 * infração, desconto, linha digitável.
 *
 * ⚠️ **O que a origem não mandou não vira linha em branco.** Campo nulo some,
 * em vez de mostrar rótulo com traço: numa ficha de 20 campos, metade vazia
 * esconde a que interessa.
 */
export function FineDetailDialog({
  fineId,
  onOpenChange,
}: {
  fineId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['fine', fineId],
    queryFn: () => fetchFine(fineId as string),
    enabled: fineId !== null,
  });

  return (
    <GlassModal
      open={fineId !== null}
      onOpenChange={onOpenChange}
      title={data ? `${data.plate}, ${rotuloFase(data)}` : 'Infração'}
      description={data?.description ?? undefined}
      className="w-[calc(100vw-2rem)] max-w-[760px]"
    >
      {isPending && fineId ? (
        <p className="text-on-surface-variant px-5 pb-8 sm:px-6">Carregando…</p>
      ) : null}
      {isError ? (
        <p className="text-error px-5 pb-8 sm:px-6">Não foi possível carregar esta infração.</p>
      ) : null}

      {data ? (
        /*
         * ⚠️ **Quem rola é este bloco, e não o diálogo.** O `GlassModal` é uma
         * coluna flex com `overflow-hidden` e teto de `85dvh`, e só aplica
         * padding no próprio cabeçalho. Sem `min-h-0 flex-1 overflow-y-auto` a
         * ficha era cortada embaixo, sem rolagem, e os botões de abrir a
         * penalidade e o boleto ficavam fora de alcance.
         */
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 sm:px-6">
          {/*
           * ⚠️ O aviso de origem manual vem PRIMEIRO, porque muda o que o resto
           * da ficha significa: não há PDF do órgão, não há boleto, e o valor é
           * o que alguém digitou, não o que o DETRAN cobrou.
           */}
          {data.source === 'MANUAL' ? (
            <p className="text-on-surface-variant ring-outline-variant text-body-sm flex items-start gap-2 rounded-2xl p-3 ring-1">
              <WarningIcon className="size-4 shrink-0 translate-y-0.5" aria-hidden />
              <span>
                Cadastrada à mão no RookHub. Não veio do DETRAN, então não tem documento nem boleto
                do órgão, e a sincronização não a altera.
              </span>
            </p>
          ) : null}

          {data.registered ? null : (
            <p className="text-on-surface-variant ring-outline-variant text-body-sm flex items-start gap-2 rounded-2xl p-3 ring-1">
              <ExternalLinkIcon className="size-4 shrink-0 translate-y-0.5" aria-hidden />
              <span>
                Esta placa não tem cadastro no RookHub. A infração aparece para você saber que
                existe, e fica fora das somas de custo da transportadora.
              </span>
            </p>
          )}

          <Secao titulo="A infração">
            <Campo rotulo="Descrição" valor={data.description} />
            <Campo rotulo="Data e hora" valor={dataHora(data.infractionAt)} />
            <Campo rotulo="Local" valor={data.location} />
            <Campo rotulo="Município" valor={cidade(data)} />
            <Campo rotulo="Órgão autuador" valor={data.agency} />
            <Campo rotulo="Código da infração" valor={data.infractionCode} />
            <Campo
              rotulo="Pontos na CNH"
              valor={data.points === null ? null : String(data.points)}
            />
          </Secao>

          <Secao titulo="Identificação">
            <Campo rotulo="Placa" valor={data.plate} />
            <Campo rotulo="Renavam" valor={data.renavam} />
            <Campo rotulo="Número do auto" valor={data.ait} />
            <Campo rotulo="Número de frota" valor={data.fleetNumber} />
          </Secao>

          <Secao titulo="Valores e prazos">
            <Campo rotulo="Valor" valor={moeda(data.amount)} />
            <Campo rotulo="Com desconto" valor={moeda(data.amountWithDiscount)} />
            <Campo rotulo="Desconto" valor={moeda(data.discountAmount)} />
            <Campo rotulo="Vencimento" valor={dataCurta(data.dueDate)} />
            <Campo
              rotulo="Prazo para indicar condutor"
              valor={dataCurta(data.indicationDeadline)}
            />
            <Campo rotulo="Pagamento confirmado" valor={data.paymentConfirmed ? 'Sim' : 'Não'} />
          </Secao>

          {/*
           * ⚠️ **A seção só existe quando alguém já perguntou.** Ela nasce do
           * `STATUS INFRACAO`, que a coleta faz a cada 72 horas sobre o que
           * está em aberto. Desenhá-la vazia diria "sem pagamento" onde o certo
           * é "ainda não sabemos", que são coisas diferentes.
           */}
          {data.status || data.paidAt || data.paidAmount !== null ? (
            <Secao titulo="Situação no órgão">
              {/* Texto cru do DETRAN: a plataforma não traduz, porque o
                  vocabulário muda por UF e traduzir seria inventar. */}
              <Campo rotulo="Situação" valor={data.status} />
              <Campo rotulo="Pago em" valor={dataCurta(data.paidAt)} />
              <Campo rotulo="Valor pago" valor={moeda(data.paidAmount)} />
            </Secao>
          ) : null}

          {data.boletoUrl || data.boletoAmount !== null ? (
            <Secao titulo="Boleto">
              <Campo rotulo="Valor do boleto" valor={moeda(data.boletoAmount)} />
              <Campo
                rotulo="Desconto do boleto"
                valor={
                  data.boletoDiscountPercent === null ? null : `${data.boletoDiscountPercent}%`
                }
              />
              <Campo rotulo="Vence em" valor={dataCurta(data.boletoDueDate)} />
            </Secao>
          ) : null}

          {data.notes ? (
            <Secao titulo="Observação de quem cadastrou">
              <p className="text-on-surface text-body-md col-span-2">{data.notes}</p>
            </Secao>
          ) : null}

          {/*
           * ⚠️ **A data de pesquisa é da SMARTEC, não nossa.** Ela diz quando o
           * fornecedor consultou o órgão, e é o que explica um dado defasado sem
           * que ninguém precise adivinhar.
           */}
          {data.searchedAt ? (
            <p className="text-on-surface-muted text-body-sm">
              A Smartec consultou o órgão em {dataCurta(data.searchedAt)}.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {data.documentUrl ? (
              <SpectrumButton asChild variant="ghost" size="sm">
                <a href={data.documentUrl} target="_blank" rel="noreferrer">
                  <FileIcon className="size-4" aria-hidden />
                  {data.stage === 'MULTA' ? 'Abrir penalidade' : 'Abrir notificação'}
                </a>
              </SpectrumButton>
            ) : null}
            {data.boletoUrl ? (
              <SpectrumButton asChild size="sm">
                <a href={data.boletoUrl} target="_blank" rel="noreferrer">
                  Abrir boleto
                </a>
              </SpectrumButton>
            ) : null}
            {/*
             * ⚠️ **"Abrir na Smartec", e NUNCA "comprovante".** O que a origem
             * devolve em `COMPROVANTE_PAGAMENTO` não é um PDF: é um endereço
             * do sistema deles, que pede a conta deles. Um botão escrito
             * "comprovante" prometeria um arquivo que não temos, e quem
             * clicasse cairia numa tela de login procurando o defeito aqui.
             */}
            {data.smartecPaymentUrl ? (
              <SpectrumButton asChild variant="ghost" size="sm">
                <a href={data.smartecPaymentUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-4" aria-hidden />
                  Abrir na Smartec
                </a>
              </SpectrumButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </GlassModal>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-on-surface-variant text-label-md mb-2 normal-case">{titulo}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** Campo nulo não vira linha: ele some. */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-on-surface-muted text-body-sm shrink-0">{rotulo}</dt>
      <dd className="text-on-surface text-body-md min-w-0 text-right">{valor}</dd>
    </div>
  );
}

function rotuloFase(f: Fine): string {
  return f.stage === 'MULTA' ? 'multa' : 'notificação';
}

function cidade(f: Fine): string | null {
  if (f.city && f.uf) return `${f.city}/${f.uf}`;
  return f.city ?? f.uf;
}

function moeda(valor: number | null): string | null {
  if (valor === null) return null;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataCurta(valor: string | null): string | null {
  if (!valor) return null;
  const d = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

function dataHora(valor: string | null): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  /* Meia-noite em ponto quase sempre é data sem hora na origem, e mostrar
     "00:00" sugeriria que a infração foi de madrugada. */
  const meiaNoite = d.getHours() === 0 && d.getMinutes() === 0;
  return meiaNoite
    ? d.toLocaleDateString('pt-BR')
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
