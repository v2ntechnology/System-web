import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tipos mínimos da Web Speech API.
 *
 * O TypeScript não traz os tipos de `SpeechRecognition` porque a API nunca saiu
 * de rascunho no W3C. Declaramos só o que usamos — melhor que espalhar `any`
 * pelo hook e perder a checagem no resto dele.
 */
interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor | undefined;
  webkitSpeechRecognition?: SpeechRecognitionConstructor | undefined;
}

function getConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mensagens de erro da API traduzidas para o que o usuário pode fazer. */
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere o acesso no navegador para falar.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz nesta página.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  'audio-capture': 'Nenhum microfone encontrado neste dispositivo.',
  network: 'Sem conexão para transcrever o áudio. Você pode digitar a pergunta.',
};

export interface UseSpeechRecognitionOptions {
  /** Chamado quando a fala termina e há uma transcrição final. */
  onResult: (transcript: string) => void;
}

/**
 * Ditado por voz sobre a Web Speech API.
 *
 * ⚠️ `supported` é falso em boa parte dos navegadores — a API é de rascunho e
 * o Firefox não a implementa. Quem consome **precisa** oferecer o caminho por
 * texto: um microfone que não faz nada é pior que microfone nenhum.
 *
 * O reconhecimento roda no navegador; para o backend chega texto, exatamente
 * como uma pergunta digitada.
 */
export function useSpeechRecognition({ onResult }: UseSpeechRecognitionOptions) {
  const [supported] = useState(() => Boolean(getConstructor()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /* Ref para o callback: trocar de `onResult` não pode reiniciar a escuta. */
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const Constructor = getConstructor();
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let partial = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += text;
        else partial += text;
      }

      setInterim(partial);

      if (finalText.trim()) {
        setInterim('');
        onResultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      /* `aborted` é o nosso próprio stop() — não é erro para mostrar. */
      if (event.error === 'aborted') return;
      setError(ERROR_MESSAGES[event.error] ?? 'Não consegui captar o áudio. Tente novamente.');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      /* `start()` numa sessão já ativa lança — estado já é o desejado. */
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}
