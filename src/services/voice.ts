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
