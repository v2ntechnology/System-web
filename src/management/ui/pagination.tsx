import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

import { cn } from './lib/cn';

/** Quantos registros cabem numa página. Uma constante, não um número solto. */
export const PAGE_SIZE = 30;

export interface PaginationProps {
  /** Página atual, começando em 1. */
  page: number;
  /** Total de registros **depois** dos filtros, e não o total da base. */
  total: number;
  onPageChange: (page: number) => void;
  /** Substantivo no plural, para a contagem: "motoristas", "veículos". */
  label?: string | undefined;
  pageSize?: number | undefined;
  className?: string | undefined;
}

/**
 * Paginação das listas do painel.
 *
 * <h2>Por que ela existe</h2>
 *
 * Decisão do usuário em 30/08/2026. As listas do painel renderizavam tudo de uma
 * vez: o cadastro de motoristas montava 132 linhas com avatar, chip e dois
 * botões cada. Não é só peso de render, é de leitura: uma lista sem fim não dá
 * noção de tamanho nem lugar para voltar depois de rolar.
 *
 * <h2>Onde a conta é feita</h2>
 *
 * ⚠️ O corte é no cliente, e o `total` que entra aqui é o **de depois dos
 * filtros**. Passar o total da base faria a barra prometer páginas que o filtro
 * esvaziou. Quando a paginação virar server-side, é esta prop que troca de
 * origem, e a barra não muda.
 *
 * <h2>A janela de páginas</h2>
 *
 * Nunca mais de sete botões, com reticências quando há salto. Com 132 registros
 * são 5 páginas e cabe tudo, mas o mesmo componente atende a lista de posições,
 * onde passaria de cem botões e a barra viraria um parágrafo de números.
 */
export function Pagination({
  page,
  total,
  onPageChange,
  label = 'registros',
  pageSize = PAGE_SIZE,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* Uma página só não é paginação: a barra some em vez de mostrar um botão
     desabilitado de cada lado, que ocupa altura sem oferecer nada. */
  if (totalPages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginação"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      {/*
       * O intervalo, e não só o número da página. "31 a 60 de 132" responde
       * onde estou E quanto falta; "página 2 de 5" responde só a primeira, e
       * quem procura alguém pelo nome precisa da segunda.
       */}
      <p className="text-on-surface-muted text-label-md tabular normal-case">
        {first} a {last} de {total} {label}
      </p>

      <div className="flex items-center gap-1">
        <Passo rotulo="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon size={16} aria-hidden="true" />
        </Passo>

        {janela(page, totalPages).map((item, i) =>
          item === '…' ? (
            /* A reticência não é botão: sem `key` estável ela repetiria índice
               com os números, então a chave carrega a posição. */
            <span
              key={`salto-${i}`}
              aria-hidden="true"
              className="text-on-surface-muted flex size-9 items-center justify-center"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`Página ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'rounded-pill text-body-md focus-visible:ring-secondary tabular flex size-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2',
                /* Pastilha preta na página atual, igual ao item ativo do menu e
                   da aba: é o mesmo conceito de "você está aqui" e precisa ser
                   o mesmo objeto em toda a aplicação. */
                item === page
                  ? 'bg-bright text-on-bright font-medium'
                  : 'text-on-surface-variant hover:bg-on-surface/[0.06] hover:text-on-surface',
              )}
            >
              {item}
            </button>
          ),
        )}

        <Passo
          rotulo="Próxima página"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon size={16} aria-hidden="true" />
        </Passo>
      </div>
    </nav>
  );
}

function Passo({
  rotulo,
  disabled,
  onClick,
  children,
}: {
  rotulo: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
      className="acao-neutra rounded-pill focus-visible:ring-secondary flex size-9 items-center justify-center focus-visible:outline-none focus-visible:ring-2"
    >
      {children}
    </button>
  );
}

/**
 * As páginas que aparecem, com reticências onde há salto.
 *
 * Primeira e última são sempre visíveis, mais a atual e uma vizinha de cada
 * lado. Esconder a última tira a única forma de saber o tamanho da lista sem
 * clicar em "próxima" até o fim.
 */
function janela(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const visiveis = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const saida: (number | '…')[] = [];
  let anterior = 0;

  for (const p of visiveis) {
    /* Só entra reticência quando há de fato um buraco. Com um número pulado, a
       reticência ocuparia a mesma largura do número que ela esconde. */
    if (anterior && p - anterior > 1) saida.push('…');
    saida.push(p);
    anterior = p;
  }

  return saida;
}
