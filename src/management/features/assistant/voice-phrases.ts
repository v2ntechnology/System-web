/**
 * As falas que são da TELA, e não do modelo.
 *
 * <h2>Por que elas existem aqui e não no prompt</h2>
 *
 * "Só um segundo, deixa eu verificar" precisa ser dito ENQUANTO a consulta
 * acontece. Se viesse do modelo, só sairia junto com a resposta, que é
 * exatamente o momento em que ela não serve mais para nada. O silêncio de três
 * segundos entre a pergunta e a resposta é o que faz a conversa parecer travada.
 *
 * <h2>Por que várias de cada</h2>
 *
 * ⚠️ Ouvir a mesma frase toda vez denuncia a gravação e cansa em cinco minutos.
 * Numa conversa falada isso pesa muito mais que num chat, porque quem ouve não
 * pode passar os olhos: a frase inteira é tempo gasto.
 */

/**
 * Enquanto a consulta corre.
 *
 * ⚠️ São muitas de propósito (pedido do usuário em 05/09/2026). Com seis, quem
 * conversa dez minutos ouve a mesma frase três vezes e percebe a gravação; o
 * sorteio sem repetir a anterior resolve o par seguido, mas não o ciclo curto.
 * Vinte frases fazem o ciclo durar mais que a paciência de qualquer conversa.
 */
const AGUARDE = [
  'Só um segundo, estou verificando isso.',
  'Deixa eu olhar aqui.',
  'Um momento, estou consultando os dados.',
  'Já vejo isso para você.',
  'Certo, só um instante.',
  'Estou buscando aqui, um momentinho.',
  'Peraí que eu confiro.',
  'Deixa eu conferir no sistema.',
  'Um instantinho, estou puxando a informação.',
  'Já te falo, só estou olhando aqui.',
  'Boa pergunta, deixa eu buscar.',
  'Estou dando uma olhada nisso agora.',
  'Aguenta um pouquinho que eu já respondo.',
  'Deixa eu ver o que tem aqui.',
  'Estou analisando os dados, um segundo.',
  'Já estou vendo isso, é rapidinho.',
  'Só localizar aqui e eu te digo.',
  'Deixa comigo, estou procurando.',
  'Um segundinho enquanto eu consulto.',
  'Estou puxando isso agora mesmo.',
];

/** Quando a captação não trouxe nada. */
const NAO_OUVI = [
  'Não consegui ouvir. Pode falar de novo?',
  'Desculpa, não peguei o que você disse.',
  'Acho que não captei nada. Tenta de novo, por favor.',
  'Não entendi. Pode repetir?',
  'Não chegou nada aqui. Pode falar mais uma vez?',
  'Me perdi agora. Repete, por favor?',
  'Ficou meio abafado. Fala de novo?',
  'Não consegui entender direito. Como é mesmo?',
  'Passou batido aqui. Pode repetir?',
  'Desculpa, se perdeu no caminho. O que você disse?',
];

/** Quando a resposta não veio, por falha de rede ou do provedor. */
const FALHOU = [
  'Não consegui consultar agora. Tenta de novo daqui a pouco.',
  'Deu um problema aqui na consulta. Pode repetir a pergunta?',
  'Não obtive resposta agora. Vamos tentar de novo?',
  'A consulta não voltou. Tenta mais uma vez?',
  'Alguma coisa travou do meu lado. Pergunta de novo, por favor.',
  'Não deu certo dessa vez. Quer tentar outra vez?',
  'Fiquei sem resposta aqui. Repete que eu tento de novo.',
  'Falhou a busca agora. Daqui a pouco deve voltar.',
];

/** Abertura da conversa, quando a pessoa começa a falar. */
const SAUDACAO = [
  'Oi! Pode falar.',
  'Estou ouvindo.',
  'Oi, o que você quer saber?',
  'Pode perguntar.',
  'Oi, como você está?',
  'Olá! Tudo certo por aí?',
  'Bom te ouvir. O que você precisa?',
  'E aí, como vão as coisas?',
  'Oi, em que posso te ajudar hoje?',
  'Prontinho, pode mandar.',
  'Oi! Diga aí.',
  'Estou aqui. O que você quer ver?',
];

/**
 * Sorteia sem repetir a anterior.
 *
 * ⚠️ O sorteio puro repete: com seis frases, a chance de ouvir a mesma duas
 * vezes seguidas é de uma em seis, e é justamente a repetição seguida que a
 * pessoa nota. Guardar a última resolve com uma linha.
 */
function sorteador(frases: string[]): () => string {
  let anterior = -1;
  return () => {
    if (frases.length === 0) return '';
    let indice = Math.floor(Math.random() * frases.length);
    if (indice === anterior) indice = (indice + 1) % frases.length;
    anterior = indice;
    return frases[indice] ?? '';
  };
}

export const proximaEspera = sorteador(AGUARDE);
export const proximoNaoOuvi = sorteador(NAO_OUVI);
export const proximaFalha = sorteador(FALHOU);
export const proximaSaudacao = sorteador(SAUDACAO);

/** Todas as frases da tela, para o áudio delas ser preparado uma vez só. */
export const FRASES_DA_TELA = [...AGUARDE, ...NAO_OUVI, ...FALHOU, ...SAUDACAO];
