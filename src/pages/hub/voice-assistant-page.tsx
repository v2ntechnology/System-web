import {
  AiIcon,
  ArrowLeftIcon,
  AudioWaveIcon,
  MicIcon,
  MicOffIcon,
  VolumeIcon,
} from '@/components/icons';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';

import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { VoiceSphere } from '@/components/shared/voice-sphere';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ask } from '@/management/features/assistant/api';
import { useSpeechRecognition } from '@/management/features/assistant/use-speech-recognition';
import { synthesizeAssistantSpeech } from '@/services';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceStatusContent {
  title: string;
  description: string;
}

const VOICE_STATUS_CONTENT: Record<VoiceStatus, VoiceStatusContent> = {
  idle: {
    title: 'Pronto para conversar',
    description: 'Ative o microfone e fale naturalmente sobre sua operação.',
  },
  listening: {
    title: 'Estou ouvindo',
    description: 'Fale agora. A esfera reage à intensidade da sua voz.',
  },
  processing: {
    title: 'Processando solicitação',
    description: 'Organizando o contexto e preparando uma resposta objetiva.',
  },
  speaking: {
    title: 'Respondendo',
    description: 'A resposta está sendo reproduzida.',
  },
  error: {
    title: 'Microfone indisponível',
    description: 'Revise a permissão do navegador e tente novamente.',
  },
};

const WAVE_BARS = Array.from({ length: 32 }, (_, index) => index);
const ORBIT_BARS = Array.from({ length: 72 }, (_, index) => index);
/**
 * O que dizer quando o microfone não entendeu nada.
 *
 * Não é resposta de demonstração: é o pedido para repetir. Falar um resumo
 * plausível da operação sem ter ouvido pergunta nenhuma seria inventar, e o
 * usuário acreditaria, porque veio na voz do assistente.
 */
const SEM_PERGUNTA =
  'Não consegui entender a pergunta. Tente falar de novo, um pouco mais perto do microfone.';

function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const normalized = (lang: string) => lang.replace('_', '-').toLowerCase();
  const brazilian = voices.filter((voice) => normalized(voice.lang).startsWith('pt-br'));
  const pool =
    brazilian.length > 0
      ? brazilian
      : voices.filter((voice) => normalized(voice.lang).startsWith('pt'));

  return (
    pool.find((voice) => /natural|neural|online|multilingual/i.test(voice.name)) ??
    pool.find((voice) => /google/i.test(voice.name)) ??
    pool[0] ??
    null
  );
}

export default function VoiceAssistantPage() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * A última resposta, para a tela mostrar em texto o que foi falado.
   *
   * Voz sem texto obriga a decorar. O gestor que ouviu "dois caminhões passaram
   * do limite" precisa poder reler quais eram, e ler é mais rápido que pedir de
   * novo.
   */
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  /* Ref além do estado: o fallback de voz do dispositivo lê fora do render. */
  const lastAnswerRef = useRef<string | null>(null);
  useEffect(() => {
    lastAnswerRef.current = lastAnswer;
  }, [lastAnswer]);

  /* A transcrição chega por callback e é lida ao encerrar a escuta. Estado aqui
     provocaria render a cada palavra reconhecida, sem nada mudar na tela. */
  const transcriptRef = useRef('');
  const speech = useSpeechRecognition({
    onResult: (texto: string) => {
      transcriptRef.current = texto;
      setLastQuestion(texto);
    },
  });
  const waveformRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  /** Nível de áudio entregue à esfera sem passar por estado do React. */
  const voiceLevelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingFrameRef = useRef<number | null>(null);
  const responseAbortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Mantida apenas como contingência quando o serviço ElevenLabs estiver fora.
  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    const load = () => {
      voicesRef.current = synthesis.getVoices();
    };
    load();
    synthesis.addEventListener('voiceschanged', load);

    return () => synthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    return () => {
      responseAbortRef.current?.abort();

      if (speakingFrameRef.current !== null) {
        cancelAnimationFrame(speakingFrameRef.current);
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      playbackSourceRef.current?.stop();
      playbackSourceRef.current?.disconnect();
      if (inputAudioContextRef.current) {
        void inputAudioContextRef.current.close();
      }
      if (playbackAudioContextRef.current) {
        void playbackAudioContextRef.current.close();
      }

      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  function resetVoiceVisuals() {
    const bars = waveformRef.current?.children;
    if (bars) {
      Array.from(bars).forEach((bar) => {
        (bar as HTMLElement).style.removeProperty('transform');
      });
    }

    orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar) => {
      bar.style.removeProperty('--voice-scale');
    });
    voiceLevelRef.current = 0;
  }

  function stopAudioCapture() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (inputAudioContextRef.current) {
      void inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    resetVoiceVisuals();
  }

  function stopSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
      speakingFrameRef.current = null;
    }
    resetVoiceVisuals();
  }

  function clearPlaybackSource(stop = false) {
    const source = playbackSourceRef.current;
    if (!source) return;

    source.onended = null;
    if (stop) {
      try {
        source.stop();
      } catch {
        // A fonte pode já ter encerrado naturalmente.
      }
    }
    source.disconnect();
    playbackSourceRef.current = null;
  }

  function finishSpeaking() {
    utteranceRef.current = null;
    clearPlaybackSource();
    stopSpeakingAnimation();
    setErrorMessage(null);
    setStatus('idle');
  }

  function applySpectrum(frequencyData: Uint8Array<ArrayBuffer>) {
    const waveformBars = waveformRef.current?.children;
    let total = 0;

    if (waveformBars) {
      Array.from(waveformBars).forEach((bar, index) => {
        const frequencyIndex = Math.min(
          frequencyData.length - 1,
          2 + Math.floor((index / waveformBars.length) * Math.min(42, frequencyData.length - 2)),
        );
        const level = (frequencyData[frequencyIndex] ?? 0) / 255;
        total += level;
        (bar as HTMLElement).style.transform = `scaleY(${0.22 + level * 1.45})`;
      });
      voiceLevelRef.current = Math.min((total / waveformBars.length) * 3.1, 1);
    }

    const orbitBars = orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar');
    if (!orbitBars) return;

    const half = orbitBars.length / 2;
    orbitBars.forEach((bar, index) => {
      const mirroredIndex = index < half ? index : orbitBars.length - index - 1;
      const frequencyIndex = Math.min(
        frequencyData.length - 1,
        2 + Math.floor((mirroredIndex / half) * Math.min(38, frequencyData.length - 2)),
      );
      const level = (frequencyData[frequencyIndex] ?? 0) / 255;
      bar.style.setProperty('--voice-scale', (0.32 + level * 1.85).toFixed(3));
    });
  }

  function startAudioAnalysis(analyser: AnalyserNode) {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const sample = () => {
      analyser.getByteFrequencyData(frequencyData);
      applySpectrum(frequencyData);
      speakingFrameRef.current = requestAnimationFrame(sample);
    };
    sample();
  }

  function startSyntheticSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    let phase = 0;
    const animate = () => {
      phase += 0.12;
      voiceLevelRef.current = 0.3 + Math.abs(Math.sin(phase)) * 0.35;

      const waveformBars = waveformRef.current?.children;
      if (waveformBars) {
        Array.from(waveformBars).forEach((bar, index) => {
          const level = 0.3 + Math.abs(Math.sin(phase + index * 0.37)) * 0.85;
          (bar as HTMLElement).style.transform = `scaleY(${level})`;
        });
      }

      orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar, index) => {
        const level = 0.38 + Math.abs(Math.sin(phase + index * 0.2)) * 1.25;
        bar.style.setProperty('--voice-scale', level.toFixed(3));
      });

      speakingFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }

  function speakWithSystemFallback() {
    setErrorMessage(
      'O serviço de voz está indisponível; usando temporariamente a voz do dispositivo.',
    );

    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      stopSpeakingAnimation();
      setStatus('error');
      return;
    }

    setStatus('speaking');
    startSyntheticSpeakingAnimation();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(lastAnswerRef.current || SEM_PERGUNTA);
    const voice = pickNaturalVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Transcreve, pergunta e fala.
   *
   * A pergunta vai para a MESMA rota do assistente de texto, e não para um
   * caminho paralelo: voz é outra forma de entrada, não outro produto. O
   * escopo por papel, a auditoria e a recusa de inventar valem igual.
   */
  async function speakResponse(question: string) {
    responseAbortRef.current?.abort();
    const controller = new AbortController();
    responseAbortRef.current = controller;

    try {
      const pergunta = question.trim();
      const resposta = pergunta ? (await ask(pergunta)).text : SEM_PERGUNTA;
      if (controller.signal.aborted) return;

      setLastAnswer(resposta);
      const audio = await synthesizeAssistantSpeech(resposta, controller.signal);
      const context = playbackAudioContextRef.current;
      if (!context) {
        throw new Error('audio_context_unavailable');
      }

      const audioBuffer = await context.decodeAudioData(await audio.arrayBuffer());
      if (controller.signal.aborted) return;

      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(context.destination);
      source.onended = finishSpeaking;
      playbackSourceRef.current = source;

      setStatus('speaking');
      setErrorMessage(null);
      startAudioAnalysis(analyser);
      source.start();
    } catch {
      if (!controller.signal.aborted) {
        speakWithSystemFallback();
      }
    } finally {
      if (responseAbortRef.current === controller) {
        responseAbortRef.current = null;
      }
    }
  }

  function finishListening() {
    stopAudioCapture();
    speech.stop();
    setStatus('processing');
    /* O texto vem do reconhecimento, que corre em paralelo à captura de áudio:
       a captura alimenta a animação da esfera, a transcrição alimenta a
       pergunta. São duas leituras do mesmo microfone, e nenhuma substitui a
       outra. */
    void speakResponse(transcriptRef.current);
    transcriptRef.current = '';
  }

  async function startListening() {
    setErrorMessage(null);
    setLastAnswer(null);
    setLastQuestion(null);
    transcriptRef.current = '';
    window.speechSynthesis?.cancel();

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Este navegador não oferece captura de áudio para esta experiência.');
      setStatus('error');
      return;
    }

    try {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext();
      }
      void playbackAudioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      inputAudioContextRef.current = audioContext;

      /*
       * Duas leituras do mesmo microfone, e nenhuma substitui a outra: a captura
       * de áudio alimenta a animação da esfera, e o reconhecimento alimenta a
       * pergunta. Sem o reconhecimento a esfera reagiria lindamente a uma
       * pergunta que ninguém leu.
       */
      if (speech.supported) {
        speech.start();
      } else {
        setErrorMessage(
          'Este navegador não transcreve fala. A esfera responde à sua voz, mas a pergunta não chega ao assistente.',
        );
      }

      setStatus('listening');

      function sampleVoice() {
        analyser.getByteFrequencyData(frequencyData);
        const bars = waveformRef.current?.children;
        let total = 0;

        if (bars) {
          Array.from(bars).forEach((bar, index) => {
            const frequencyIndex = Math.floor((index / bars.length) * frequencyData.length);
            const level = (frequencyData[frequencyIndex] ?? 0) / 255;
            total += level;
            (bar as HTMLElement).style.transform = `scaleY(${0.2 + level * 1.55})`;
          });
          voiceLevelRef.current = Math.min((total / bars.length) * 2.4, 1);
        }

        animationFrameRef.current = requestAnimationFrame(sampleVoice);
      }

      sampleVoice();
    } catch {
      stopAudioCapture();
      setErrorMessage('Não foi possível acessar o microfone. Autorize o uso nas configurações.');
      setStatus('error');
    }
  }

  function stopSpeaking() {
    responseAbortRef.current?.abort();
    responseAbortRef.current = null;

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis?.cancel();
    clearPlaybackSource(true);
    stopSpeakingAnimation();
    setErrorMessage(null);
    setStatus('idle');
  }

  function handlePrimaryAction() {
    if (status === 'listening') {
      finishListening();
      return;
    }
    if (status === 'speaking') {
      stopSpeaking();
      return;
    }
    if (status !== 'processing') {
      void startListening();
    }
  }

  const content = VOICE_STATUS_CONTENT[status];
  const actionLabel =
    status === 'listening'
      ? 'Concluir comando'
      : status === 'speaking'
        ? 'Interromper resposta'
        : status === 'error'
          ? 'Tentar novamente'
          : 'Iniciar conversa';

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-background">
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1500px] flex-col px-4 py-4 sm:px-7 sm:py-6 lg:px-10">
        <header className="flex items-center gap-4 border-b border-border/60 pb-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Voltar">
            <Link to="/painel" aria-label="Voltar para a escolha de acesso">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Link to="/painel" aria-label="RookHub — início">
            <BrandLogo className="hidden h-8 sm:block" />
            <RookMark className="h-8 w-8 sm:hidden" />
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-8 lg:py-10">
          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="voice-core" aria-hidden>
              <VoiceSphere levelRef={voiceLevelRef} status={status} className="voice-core-sphere" />
              <div ref={orbitRef} className={cn('voice-orbit', `voice-orbit--${status}`)}>
                {ORBIT_BARS.map((bar) => (
                  <span
                    key={bar}
                    className="voice-orbit-bar"
                    style={
                      {
                        '--orbit-angle': `${bar * (360 / ORBIT_BARS.length)}deg`,
                        '--orbit-delay': `${bar * -11}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="voice-orbit-arc voice-orbit-arc--outer" />
                <span className="voice-orbit-arc voice-orbit-arc--inner" />
              </div>
            </div>

            <div className="mt-3 min-h-[92px]" aria-live="polite" aria-atomic="true">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                {content.title}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {errorMessage ?? content.description}
              </p>
            </div>

            {/* A resposta em texto abaixo da falada.
                Voz sem texto obriga a decorar: quem ouviu "dois caminhões
                passaram do limite" precisa poder reler quais eram, e ler é mais
                rápido que perguntar de novo. */}
            {lastAnswer ? (
              <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur">
                {lastQuestion ? (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {lastQuestion}
                  </p>
                ) : null}
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line sm:text-base">
                  {lastAnswer}
                </p>
              </div>
            ) : null}

            <div
              ref={waveformRef}
              className={cn('voice-waveform', `voice-waveform--${status}`)}
              aria-hidden
            >
              {WAVE_BARS.map((bar) => (
                <span
                  key={bar}
                  className="voice-wave-bar"
                  style={{
                    height: `${18 + ((bar * 7) % 30)}px`,
                    animationDelay: `${bar * -43}ms`,
                  }}
                />
              ))}
            </div>

            <Button
              type="button"
              variant={status === 'speaking' ? 'outline' : 'brand'}
              size="lg"
              onClick={handlePrimaryAction}
              disabled={status === 'processing'}
              className="mt-7 h-12 min-w-52 rounded-full px-7"
              aria-label={actionLabel}
            >
              {status === 'listening' ? (
                <AudioWaveIcon className="h-4 w-4" />
              ) : status === 'speaking' ? (
                <VolumeIcon className="h-4 w-4" />
              ) : status === 'error' ? (
                <MicOffIcon className="h-4 w-4" />
              ) : status === 'processing' ? (
                <AiIcon className="h-4 w-4 animate-pulse" />
              ) : (
                <MicIcon className="h-4 w-4" />
              )}
              {status === 'processing' ? 'Processando…' : actionLabel}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
