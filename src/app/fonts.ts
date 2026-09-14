/**
 * As fontes que um cliente pode escolher para a marca dele.
 *
 * ⚠️ **É uma lista de CHAVES, nunca um arquivo enviado pelo cliente.** Aceitar
 * upload de fonte traria licenciamento de terceiro para dentro da nossa
 * hospedagem: quem paga a licença de uma fonte comercial é quem a distribui, e
 * servir o arquivo é distribuir.
 *
 * ⚠️ **O `Backend-web` espelha esta lista.** Ele recusa qualquer chave fora
 * dela, então acrescentar uma fonte aqui sem acrescentar lá produz uma opção que
 * a gravação rejeita com 400. Mudar um lado exige mudar o outro.
 *
 * Morava em `mocks/saas.ts` e saiu de lá na Fase 9: a lista deixou de ser dado
 * de demonstração quando o serviço de marca passou a aplicá-la de verdade, e
 * tela não consome mock.
 */
export const APPROVED_FONTS: { value: string; label: string }[] = [
  { value: 'default', label: 'Padrão RookHub (Plus Jakarta Sans)' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'source-sans', label: 'Source Sans 3' },
  { value: 'ibm-plex', label: 'IBM Plex Sans' },
];

/**
 * A família de cada chave, como o Google Fonts a nomeia, e a pilha CSS.
 *
 * `default` não tem família própria de propósito: é a marca RookHub, que já vem
 * no `index.html` e não precisa de nenhum download extra.
 */
const FONTES: Record<string, { family: string; stack: string }> = {
  inter: { family: 'Inter', stack: 'Inter, system-ui, sans-serif' },
  roboto: { family: 'Roboto', stack: 'Roboto, system-ui, sans-serif' },
  'source-sans': { family: 'Source Sans 3', stack: "'Source Sans 3', system-ui, sans-serif" },
  'ibm-plex': { family: 'IBM Plex Sans', stack: "'IBM Plex Sans', system-ui, sans-serif" },
};

/** A pilha CSS da chave, ou `null` quando é a fonte padrão ou chave desconhecida. */
export function fontStack(key: string | null | undefined): string | null {
  if (!key) return null;
  return FONTES[key]?.stack ?? null;
}

/**
 * O endereço da folha do Google Fonts para a chave, ou `null` se não há o que
 * baixar.
 *
 * Os pesos são os mesmos que o `index.html` pede para a Inter: 400 a 700 cobrem
 * corpo, rótulo e título, e pedir a família inteira custa download que ninguém
 * usa.
 */
export function fontStylesheetHref(key: string | null | undefined): string | null {
  if (!key) return null;
  const familia = FONTES[key]?.family;
  if (!familia) return null;
  const nome = familia.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${nome}:wght@400;500;600;700&display=swap`;
}
