import { env } from '@/app/environment';
import { ApiError } from './http';
import { getAccessToken } from './token-store';

interface VoiceErrorPayload {
  message?: string;
}

function isVoiceErrorPayload(value: unknown): value is VoiceErrorPayload {
  return typeof value === 'object' && value !== null && 'message' in value;
}

/**
 * Pede o áudio da fala ao `Backend-web`.
 *
 * A rota vivia num plugin Node do Vite, que só era registrado em
 * desenvolvimento e preview: no build publicado ela não existiria, e a voz
 * morreria em produção. Agora atravessa a mesma API do resto da aplicação, com
 * o mesmo token e o mesmo controle de acesso.
 *
 * A resposta são bytes, não JSON: a chave da ElevenLabs fica no servidor e o
 * navegador recebe apenas o áudio pronto.
 */
export async function synthesizeAssistantSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const token = getAccessToken();

  const response = await fetch(`${env.apiBaseUrl}/v1/voice/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
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
