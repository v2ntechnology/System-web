import type { AssistantVoice, VoiceGender } from '@/services';

/**
 * A preferência de voz de quem usa a assistente.
 *
 * <h2>Por que o gênero fica gravado e a voz não</h2>
 *
 * Decisão do usuário em 05/09/2026: quem escolheu voz feminina volta a ouvir voz
 * feminina na próxima visita, mas **não a mesma voz de sempre**. Gravar a voz
 * exata daria o efeito contrário do pedido, que é justamente não repetir. Então
 * o que persiste é o gênero e um contador, e a voz da vez sai do rodízio.
 *
 * <h2>Por que não é dado sensível</h2>
 *
 * `localStorage` guarda preferência de interface, e nada além disso: as regras
 * do projeto proíbem dado sensível aqui, e timbre de voz não é dado de ninguém.
 */

const CHAVE_GENERO = 'rookhub.voz.genero';
const CHAVE_RODIZIO = 'rookhub.voz.rodizio';

function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    /* Navegador em modo privado ou com armazenamento bloqueado: a tela funciona
       sem preferência guardada, só não lembra da escolha. */
    return null;
  }
}

function gravar(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* Ver acima: não lembrar é aceitável, quebrar a conversa não é. */
  }
}

export function lerGeneroPreferido(): VoiceGender | null {
  const valor = ler(CHAVE_GENERO);
  return valor === 'FEMININA' || valor === 'MASCULINA' ? valor : null;
}

export function gravarGeneroPreferido(genero: VoiceGender): void {
  gravar(CHAVE_GENERO, genero);
}

/** Quais gêneros o provedor ativo consegue falar. */
export function generosDisponiveis(vozes: AssistantVoice[]): VoiceGender[] {
  const encontrados = new Set(vozes.map((voz) => voz.gender));
  return (['FEMININA', 'MASCULINA'] as const).filter((genero) => encontrados.has(genero));
}

/**
 * O passo desta visita, e já deixa o próximo gravado.
 *
 * ⚠️ **Chamar só de fora do render.** Ela lê e ESCREVE no navegador, e função
 * impura durante o render é erro de lint neste projeto, com razão: o React pode
 * renderizar duas vezes e o rodízio andaria dois passos. O lugar dela é o
 * `queryFn` da busca do catálogo, que roda uma vez por visita.
 */
export function proximoPassoDoRodizio(): number {
  const anterior = Number.parseInt(ler(CHAVE_RODIZIO) ?? '0', 10);
  const passo = Number.isFinite(anterior) && anterior >= 0 ? anterior : 0;
  /* O módulo evita o número crescer para sempre no navegador de quem usa a tela
     todo dia; 1000 é múltiplo de nada que importe aqui, e qualquer catálogo
     pequeno continua girando parelho. */
  gravar(CHAVE_RODIZIO, String((passo + 1) % 1000));
  return passo;
}

/**
 * A voz da vez: pura, para poder ser calculada no render.
 *
 * ⚠️ Devolve `null` quando o gênero pedido não existe no provedor ativo, e quem
 * chama decide o que fazer. Hoje só existe uma voz feminina em pt-BR nos modelos
 * locais (`pf_dora`), então escolher feminina devolve sempre ela: é limite do
 * catálogo, não da tela.
 */
export function escolherVoz(
  vozes: AssistantVoice[],
  genero: VoiceGender,
  passo: number,
): AssistantVoice | null {
  const candidatas = vozes.filter((voz) => voz.gender === genero);
  if (candidatas.length === 0) return null;
  return candidatas[passo % candidatas.length] ?? candidatas[0] ?? null;
}
