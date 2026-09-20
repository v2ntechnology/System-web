import { CopyIcon, FileIcon } from '@/components/icons';
import { Link } from 'react-router';

import { KIND_LABEL, type VehicleDocument } from '../types';

/**
 * Uma guia na fila.
 *
 * ⚠️ **O destaque segue `pending`, e nunca `overdue`.** Data passada não é
 * dívida: a guia de licenciamento vence em janeiro e quem pagou em janeiro fica
 * com ela "vencida" o ano inteiro. Pintar as 88 de vermelho numa frota com 9
 * problemas reais treinaria o time a ignorar a cor.
 */
export function DocumentRow({
  doc,
  onCopy,
  showPlate = true,
}: {
  doc: VehicleDocument;
  onCopy: () => void;
  /**
   * Na ficha do veículo a placa é o contexto da página inteira.
   *
   * Repeti-la em cada linha ocupa a coluna com o que já está no cabeçalho, e o
   * link apontaria para a tela em que a pessoa já está. Sem ela, quem passa a
   * ser o título da linha é o tipo da guia.
   */
  showPlate?: boolean;
}) {
  return (
    <article
      className={[
        'ring-light-edge bg-light rounded-3xl p-4 ring-1 sm:p-5',
        doc.pending ? 'ring-error/45' : '',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showPlate ? (
              <Link
                to={`/gestao/patio/${doc.plate}`}
                className="text-on-light text-title-sm focus-visible:ring-primary rounded font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                {doc.plate}
              </Link>
            ) : null}
            <span
              className={
                showPlate
                  ? 'text-on-light-variant text-label-sm'
                  : 'text-on-light text-title-sm font-semibold'
              }
            >
              {KIND_LABEL[doc.kind]}
            </span>
            {doc.exercise ? (
              <span className="text-on-light-muted text-label-sm">{doc.exercise}</span>
            ) : null}
            {doc.pending ? (
              <span className="text-error text-label-sm font-medium">{motivo(doc)}</span>
            ) : null}
          </div>

          <p className="text-on-light-variant text-body-sm mt-1">
            {[
              doc.dueDate ? `Vence ${data(doc.dueDate)}` : null,
              doc.status,
              doc.issuer,
              doc.fleetNumber ? `Frota ${doc.fleetNumber}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <p className="text-on-light text-title-sm shrink-0 font-semibold">{moeda(doc.amount)}</p>
      </header>

      <footer className="text-on-light-variant text-body-sm mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {doc.documentUrl ? (
          <a
            href={doc.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary-on-light inline-flex items-center gap-1 font-medium hover:underline"
          >
            <FileIcon className="size-4" aria-hidden />
            Abrir guia
          </a>
        ) : (
          /*
           * ⚠️ **Sem guia NÃO é erro, e o texto explica qual caso é.** O
           * cronotacógrafo só ganha GRU depois que alguém a solicita: das 26
           * linhas da frota, nenhuma tem PDF, e 9 estão com o certificado
           * vencido. Deixar o espaço vazio faria parecer defeito da integração.
           */
          <span className="text-on-light-muted">
            {doc.kind === 'CRONOTACOGRAFO'
              ? 'A GRU é emitida ao solicitar a renovação'
              : 'Guia não disponível na origem'}
          </span>
        )}

        {doc.digitableLine ? (
          <button
            type="button"
            onClick={onCopy}
            className="text-primary-on-light focus-visible:ring-primary inline-flex items-center gap-1 rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            <CopyIcon className="size-4" aria-hidden />
            Copiar linha digitável
          </button>
        ) : null}

        {doc.searchedAt ? (
          <span className="text-on-light-muted">Consultado em {data(doc.searchedAt)}</span>
        ) : null}
      </footer>
    </article>
  );
}

/** Por que esta linha é pendência, em uma palavra. */
function motivo(doc: VehicleDocument): string {
  if (doc.kind === 'CRONOTACOGRAFO') return 'Certificado vencido';
  if (doc.kind === 'LICENCIAMENTO') return 'Exercício atrasado';
  return 'Em aberto';
}

function moeda(valor: number | null): string {
  /* ⚠️ Zero NÃO é "sem valor": pode ser isento, pago ou não apurado, e a origem
     não diz qual. Mostrar o número é o honesto; concluir seria invenção. */
  if (valor === null) return 'Sem valor';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function data(valor: string): string {
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
}
