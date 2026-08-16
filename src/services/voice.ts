import { ApiError } from './http';

interface VoiceErrorPayload {
  message?: string;
}

function isVoiceErrorPayload(value: unknown): value is VoiceErrorPayload {
  return typeof value === 'object' && value !== null && 'message' in value;
}

export async function synthesizeAssistantSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
