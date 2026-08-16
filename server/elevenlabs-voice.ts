import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin } from 'vite';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io';
const VOICE_ROUTE = '/api/voice/synthesize';
const DEFAULT_VOICE_NAME = 'JARVIS 2';
const MAX_REQUEST_BYTES = 16_384;
const MAX_TEXT_LENGTH = 2_000;

interface ElevenLabsVoice {
  name: string;
  voice_id: string;
}

interface VoiceSearchResponse {
  voices: ElevenLabsVoice[];
}

interface VoicePluginOptions {
  apiKey?: string;
  voiceId?: string;
  voiceName?: string;
}

interface SpeechRequest {
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVoiceSearchResponse(value: unknown): value is VoiceSearchResponse {
  if (!isRecord(value) || !Array.isArray(value.voices)) return false;

  return value.voices.every(
    (voice) =>
      isRecord(voice) && typeof voice.name === 'string' && typeof voice.voice_id === 'string',
  );
}

function readSpeechRequest(request: IncomingMessage): Promise<SpeechRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    request.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_REQUEST_BYTES) {
        reject(new Error('request_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!isRecord(parsed) || typeof parsed.text !== 'string') {
          reject(new Error('invalid_request'));
          return;
        }

        const text = parsed.text.trim();
        if (!text || text.length > MAX_TEXT_LENGTH) {
          reject(new Error('invalid_text'));
          return;
        }

        resolve({ text });
      } catch {
        reject(new Error('invalid_json'));
      }
    });

    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, payload: object): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function findVoiceId(apiKey: string, voiceName: string): Promise<string> {
  const url = new URL('/v2/voices', ELEVENLABS_API_URL);
  url.searchParams.set('search', voiceName);
  url.searchParams.set('page_size', '100');
  url.searchParams.set('include_total_count', 'false');

  const response = await fetch(url, {
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`voice_search_failed_${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isVoiceSearchResponse(payload)) {
    throw new Error('voice_search_invalid_response');
  }

  const voice = payload.voices.find(
    (candidate) => candidate.name.localeCompare(voiceName, 'pt-BR', { sensitivity: 'base' }) === 0,
  );
  if (!voice) {
    throw new Error('voice_not_found');
  }

  return voice.voice_id;
}

async function synthesizeSpeech(apiKey: string, voiceId: string, text: string): Promise<Response> {
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, ELEVENLABS_API_URL);
  url.searchParams.set('output_format', 'mp3_44100_128');

  return fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
    }),
  });
}

export function elevenLabsVoicePlugin({
  apiKey,
  voiceId,
  voiceName = DEFAULT_VOICE_NAME,
}: VoicePluginOptions): Plugin {
  let voiceIdPromise: Promise<string> | null = voiceId ? Promise.resolve(voiceId) : null;

  const middleware = async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, { message: 'Método não permitido.' });
      return;
    }

    if (!apiKey) {
      sendJson(response, 503, { message: 'Serviço de voz não configurado.' });
      return;
    }

    try {
      const speechRequest = await readSpeechRequest(request);
      voiceIdPromise ??= findVoiceId(apiKey, voiceName);
      const resolvedVoiceId = await voiceIdPromise;
      const speechResponse = await synthesizeSpeech(apiKey, resolvedVoiceId, speechRequest.text);

      if (!speechResponse.ok) {
        voiceIdPromise = voiceId ? Promise.resolve(voiceId) : null;
        throw new Error(`speech_generation_failed_${speechResponse.status}`);
      }

      const audio = Buffer.from(await speechResponse.arrayBuffer());
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': audio.length,
        'Content-Type': speechResponse.headers.get('content-type') ?? 'audio/mpeg',
      });
      response.end(audio);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'unknown_error';
      const status = code === 'request_too_large' ? 413 : code.startsWith('invalid_') ? 400 : 502;
      sendJson(response, status, {
        message:
          status === 400
            ? 'Texto inválido para síntese.'
            : status === 413
              ? 'Texto acima do limite permitido.'
              : 'Não foi possível gerar a voz da assistente.',
      });
    }
  };

  return {
    name: 'rookhub-elevenlabs-voice',
    configureServer(server) {
      server.middlewares.use(VOICE_ROUTE, middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(VOICE_ROUTE, middleware);
    },
  };
}
