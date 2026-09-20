/**
 * Máscaras de digitação, e os conversores que as desfazem.
 *
 * <h2>Por que formatar enquanto a pessoa digita</h2>
 *
 * Campo de número sem máscara aceita letra, aceita ponto no lugar errado e
 * mostra `36000` onde o documento do caminhão diz `36.000`. Quem confere um
 * cadastro compara com um papel na mão: o que está na tela precisa se parecer
 * com o que está no papel.
 *
 * <h2>⚠️ Formatar e converter andam SEMPRE em par</h2>
 *
 * Este é o erro que o arquivo existe para impedir. Com a máscara de milhar, o
 * campo passa a guardar `"8.500"`, e `Number("8.500")` é **8,5**: o caminhão de
 * oito toneladas e meia viraria um de oito quilos e meio, sem nada falhar e sem
 * ninguém perceber até alguém somar. Quem exibe com `maskInteger` converte com
 * `parseInteger`, e o mesmo vale para o decimal.
 *
 * <h2>Vírgula é o separador decimal</h2>
 *
 * O teclado é brasileiro e o documento também. O ponto continua sendo aceito na
 * digitação, porque quem vem do teclado numérico o encontra primeiro, mas ele é
 * traduzido na hora: o valor que fica no campo tem vírgula, e o que vai para a
 * API tem ponto.
 */

/** Só os dígitos, com teto opcional de tamanho. */
export function onlyDigits(value: string, max?: number): string {
  const digits = value.replace(/\D/g, '');
  return max == null ? digits : digits.slice(0, max);
}

/** Agrupa o milhar com ponto: `36000` vira `36.000`. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Inteiro com separador de milhar, para quilo, litro e quilômetro.
 *
 * ⚠️ O teto é de DÍGITOS, e não de caracteres: contar os pontos deixaria o campo
 * travar antes do número que a pessoa precisa digitar.
 */
export function maskInteger(value: string, max = 9): string {
  const digits = onlyDigits(value, max);
  return digits === '' ? '' : groupThousands(digits);
}

/**
 * Decimal com vírgula, para metro cúbico, km/l e quilo com casas.
 *
 * ⚠️ **A vírgula sozinha não é apagada**: quem digita "92," está no meio do
 * número, e devolver "92" faria a tecla de vírgula parecer quebrada.
 */
export function maskDecimal(value: string, decimals = 2, maxIntegerDigits = 9): string {
  const limpo = value.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [inteiro = '', ...resto] = limpo.split(',');
  const cabeca = onlyDigits(inteiro, maxIntegerDigits);

  if (resto.length === 0) return cabeca === '' ? '' : groupThousands(cabeca);

  /* Tudo que veio depois da primeira vírgula é uma casa decimal só: digitar
     "1,2,3" não pode virar dois separadores. */
  const cauda = onlyDigits(resto.join(''), decimals);
  return `${groupThousands(cabeca)},${cauda}`;
}

/** Dinheiro, sempre com as duas casas que a moeda tem. */
export function maskCurrency(value: string): string {
  return maskDecimal(value, 2);
}

/**
 * CNPJ, no formato do documento: `00.000.000/0000-00`.
 *
 * ⚠️ A pontuação é aplicada por FAIXA de dígitos, e não por posição fixa: assim
 * o campo acompanha quem ainda está digitando, em vez de mostrar `..-/` num
 * campo com três números dentro.
 */
export function maskCnpj(value: string): string {
  const d = onlyDigits(value, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * De volta ao número, desfazendo `maskInteger`.
 *
 * Devolve `null` para campo vazio, que é o que o backend espera de um opcional
 * em branco: zero seria um número que ninguém informou.
 */
export function parseInteger(masked: string): number | null {
  const digits = onlyDigits(masked);
  return digits === '' ? null : Number(digits);
}

/** De volta ao número, desfazendo `maskDecimal` ou `maskCurrency`. */
export function parseDecimal(masked: string): number | null {
  const limpo = masked.replace(/\./g, '').replace(',', '.').trim();
  if (limpo === '' || limpo === '.') return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Do número gravado para o campo, na abertura do formulário.
 *
 * ⚠️ Existe porque o caminho de volta também precisa da máscara: sem ele a ficha
 * abre com `36000` e, ao salvar sem tocar no campo, a comparação com o valor
 * formatado acusa mudança onde não houve.
 */
export function integerToMask(value: number | null | undefined): string {
  return value == null ? '' : maskInteger(String(Math.round(value)));
}

export function decimalToMask(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '';
  return maskDecimal(value.toFixed(decimals).replace('.', ','), decimals);
}
