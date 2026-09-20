import { env } from '@/app/environment';
import { ApiError } from './http';
import { getAccessToken } from './token-store';

interface VoiceErrorPayload {
  message?: string;
}

function isVoiceErrorPayload(value: unknown): value is VoiceErrorPayload {
  return typeof value === 'object' && value !== null && 'message' in value;
}

export type VoiceGender = 'FEMININA' | 'MASCULINA';

export interface AssistantVoice {
  id: string;
  label: string;
  gender: VoiceGender;
}

/**
 * As vozes que o provedor ativo sabe falar.
 *
 * ⚠️ O catálogo é do servidor, e não uma lista fixa aqui. Ele muda com o
 * provedor configurado e com o que foi baixado na imagem do sintetizador: uma
 * lista no cliente ofereceria timbre que não vai sair.
 */
export async function fetchAssistantVoices(
  signal?: AbortSignal,
): Promise<{ provider: string | null; voices: AssistantVoice[] }> {
  const token = getAccessToken();

  const response = await fetch(`${env.apiBaseUrl}/v1/voice/voices`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new ApiError('Não foi possível listar as vozes da assistente.', response.status);
  }

  return (await response.json()) as { provider: string | null; voices: AssistantVoice[] };
}

/**
 * Pede o áudio da fala ao `Backend-web`.
 *
 * A rota vivia num plugin Node do Vite, que só era registrado em
 * desenvolvimento e preview: no build publicado ela não existiria, e a voz
 * morreria em produção. Agora atravessa a mesma API do resto da aplicação, com
 * o mesmo token e o mesmo controle de acesso.
 *
 * A resposta são bytes, não JSON: a chave do provedor fica no servidor e o
 * navegador recebe apenas o áudio pronto. O formato varia com o provedor (MP3
 * ou WAV), e quem toca não precisa saber: `decodeAudioData` descobre pelos
 * primeiros bytes.
 *
 * @param voice id vindo de {@link fetchAssistantVoices}. Sem ele, o servidor usa
 *   a voz padrão do provedor.
 */
export async function synthesizeAssistantSpeech(
  text: string,
  options: { voice?: string | undefined; signal?: AbortSignal | undefined } = {},
): Promise<Blob> {
  const token = getAccessToken();
  const { voice, signal } = options;

  const response = await fetch(`${env.apiBaseUrl}/v1/voice/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, ...(voice ? { voice } : {}) }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    let message = 'Não foi possível gerar a voz da assistente.';

    try {
      const payload: unknown = await response.json();
      if (isVoiceErrorPayload(payload) && typeof payload.message === 'string') {
        message = payload.message;
      }
    } catch {
      // A resposta de erro pode não ser JSON; a mensagem padrão continua válida.
    }

    throw new ApiError(message, response.status);
  }

  const audio = await response.blob();
  if (audio.size === 0) {
    throw new ApiError('O serviço de voz retornou um áudio vazio.', 502);
  }

  return audio;
}

/**
 * Transcreve no SERVIDOR o áudio gravado pelo navegador.
 *
 * <h2>⚠️ Por que a transcrição saiu do navegador</h2>
 *
 * Porque no celular ela não acontecia. A tela abria o microfone duas vezes ao
 * mesmo tempo: uma com `getUserMedia`, para medir o volume e animar a esfera, e
 * outra com a Web Speech API, para transcrever. O desktop tolera as duas; o
 * Android e o iPhone não, porque lá o reconhecedor é um serviço do sistema e
 * precisa do microfone que o `getUserMedia` já estava segurando.
 *
 * O efeito era o relatado em 19/09/2026: a pessoa falava, a transcrição vinha
 * vazia, a tela concluía que não tinha ouvido nada, dizia "não entendi" e
 * reabria o microfone, para sempre, sem nunca responder. E o erro que
 * denunciaria isso (`no-speech`) é justamente o que a Web Speech emite o tempo
 * todo numa sessão contínua, então ele era ignorado de propósito.
 *
 * Com a transcrição aqui, sobra um consumidor só do microfone no aparelho, e o
 * comportamento é o mesmo em qualquer navegador, inclusive no Safari do iPhone,
 * onde a Web Speech depende do reconhecimento da Apple.
 *
 * ⚠️ O corpo é o áudio CRU, e o `Content-Type` é o que o `MediaRecorder`
 * declarou ter gravado: é assim que o servidor sabe o formato. Não montar
 * `FormData` aqui é deliberado, porque não há campo nenhum para acompanhar o
 * arquivo.
 */
export async function transcribeAssistantAudio(
  audio: Blob,
  options: { signal?: AbortSignal | undefined } = {},
): Promise<{ text: string; confidence: number | null }> {
  const token = getAccessToken();

  const response = await fetch(`${env.apiBaseUrl}/v1/voice/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': audio.type || 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: audio,
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw new ApiError('Não foi possível entender o áudio.', response.status);
  }

  const payload = (await response.json()) as { text?: string; confidence?: number | null };
  return { text: payload.text ?? '', confidence: payload.confidence ?? null };
}

/**
 * A resposta desta pessoa ao card de microfone.
 *
 * ⚠️ `null` significa "ainda não foi perguntada", e é diferente de `NEGADO`. São
 * três estados, e tratar o primeiro como recusa esconderia o card de quem nunca
 * o viu.
 */
export type MicrophoneConsent = 'PERMITIDO' | 'NEGADO' | null;

export async function fetchMicrophoneConsent(): Promise<MicrophoneConsent> {
  const token = getAccessToken();
  const response = await fetch(`${env.apiBaseUrl}/v1/voice/microphone-consent`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { decision?: MicrophoneConsent };
  return payload.decision ?? null;
}

/**
 * Guarda a resposta ao card.
 *
 * ⚠️ Gravar `PERMITIDO` NÃO abre o microfone: quem abre é o navegador, e a tela
 * ainda precisa pedir a ele em seguida. O que fica no banco é a decisão sobre a
 * aplicação, e é ela que evita repetir o card no próximo aparelho.
 */
export async function saveMicrophoneConsent(decision: 'PERMITIDO' | 'NEGADO'): Promise<void> {
  const token = getAccessToken();
  await fetch(`${env.apiBaseUrl}/v1/voice/microphone-consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ decision }),
  });
}
