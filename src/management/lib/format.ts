/**
 * Formatação dos números da visão do dono.
 *
 * Centralizado porque o dono compara números entre quatro telas: se a DRE
 * arredonda diferente do resumo, o mesmo valor aparece com dois rostos e a tela
 * perde credibilidade.
 */

/** Valor cheio, com centavos — para R$/km e valores pequenos. */
export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor sem centavos — para totais na casa dos milhões. */
export const brlWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Valor compacto para eixo de gráfico ("R$ 4,4 mi").
 *
 * O eixo Y com o valor cheio de milhões come 120px de largura e empurra a área
 * do gráfico para fora da tela no mobile.
 */
export function brlCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  }
  return brlWhole.format(value);
}

/** Percentual com uma decimal. */
export function percent(value: number, fractionDigits = 1) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** Percentual com sinal explícito — variação só se lê com o sinal na frente. */
export function signedPercent(value: number, fractionDigits = 1) {
  return `${value > 0 ? '+' : ''}${percent(value, fractionDigits)}`;
}

/** Pontos percentuais com sinal — variação de margem não é "%", é "p.p.". */
export function signedPoints(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} p.p.`;
}

export const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Dias até a data, a partir de hoje. Negativo quando já passou.
 *
 * Meio-dia como referência de propósito: com meia-noite, um fuso a leste ou a
 * oeste muda a conta em um dia inteiro, e "vence em 60 dias" viraria 59 ou 61
 * dependendo de onde a pessoa está.
 */
export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Mês e ano — para tempo de casa, vigência, competência.
 *
 * O dia exato da admissão não muda decisão nenhuma, e a data por extenso ("01 de
 * maio de 2019") estoura a linha do cargo no cartão de equipe.
 */
export const monthYear = new Intl.DateTimeFormat('pt-BR', {
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export const dateOnly = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Duração em texto curto: "1 h 24" lê mais rápido que "84 minutos".
 *
 * Fica aqui, e não no componente que a usa, porque tempo ao volante aparece em
 * percurso, jornada e ficha do motorista. Três formatações do mesmo número é
 * como o mesmo valor ganha dois rostos.
 */
export function duration(seconds: number | undefined): string {
  if (seconds == null) return '–';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${minutes} min`;
}
