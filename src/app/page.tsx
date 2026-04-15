'use client';

import { useState, useRef, useEffect } from 'react';
import type { TripType, ParsedTrip } from '@/types/trip';

type AppState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

// Web Speech API type declarations (not included in standard DOM types)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export default function HomePage() {
  const [tripType, setTripType] = useState<TripType>('business');
  const [appState, setAppState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastTrip, setLastTrip] = useState<ParsedTrip | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const appStateRef = useRef<AppState>('idle');

  // Keep ref in sync so event handlers always see the latest state
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function startRecording() {
    if (appStateRef.current !== 'idle') return;

    const SpeechRecognitionClass =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage(
        'Voice input is not supported in this browser. Please use Chrome or Safari.'
      );
      setAppState('error');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setAppState('recording');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      submitTrip(text);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setErrorMessage('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        setErrorMessage(
          'Microphone access was denied. Please allow microphone access in your browser settings.'
        );
      } else {
        setErrorMessage(`Microphone error: ${event.error}`);
      }
      setAppState('error');
    };

    recognition.onend = () => {
      if (appStateRef.current === 'recording') {
        setAppState('idle');
      }
    };

    recognition.start();
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  async function submitTrip(text: string) {
    setAppState('processing');
    try {
      const res = await fetch('/api/log-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_text: text, trip_type: tripType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to log trip');
      }
      setLastTrip(data.trip);
      setAppState('success');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setAppState('error');
    }
  }

  function reset() {
    setAppState('idle');
    setTranscript('');
    setErrorMessage('');
  }

  const isIdle = appState === 'idle';
  const isRecording = appState === 'recording';
  const isProcessing = appState === 'processing';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-5 gap-7 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Mileage Tracker</h1>
        <p className="text-gray-500 text-sm mt-1">Voice-powered trip log</p>
      </div>

      {/* Trip Type Toggle — only show when not in result/error state */}
      {(isIdle || isRecording || isProcessing) && (
        <div className="flex w-full rounded-2xl overflow-hidden border-2 border-blue-600 shadow-sm">
          {(['business', 'personal'] as TripType[]).map((type) => (
            <button
              key={type}
              onClick={() => setTripType(type)}
              disabled={isRecording || isProcessing}
              className={`flex-1 py-4 text-lg font-semibold capitalize transition-colors
                ${
                  tripType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {type === 'business' ? '💼 Business' : '🏠 Personal'}
            </button>
          ))}
        </div>
      )}

      {/* Mic Button */}
      {(isIdle || isRecording) && (
        <div className="flex flex-col items-center gap-3">
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={`w-36 h-36 rounded-full text-white text-6xl shadow-xl
              transition-all active:scale-95 select-none touch-none
              ${
                isRecording
                  ? 'bg-red-500 animate-pulse scale-110 shadow-red-300'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-300'
              }`}
            aria-label={
              isRecording
                ? 'Release to stop recording'
                : 'Hold to record your trip'
            }
          >
            🎤
          </button>
          <p className="text-center text-gray-500 text-sm">
            {isRecording
              ? 'Listening… release when done'
              : 'Hold the mic and speak your trip'}
          </p>
        </div>
      )}

      {/* What to say hint */}
      {isIdle && (
        <div className="w-full bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-blue-800 text-sm font-medium mb-1">What to say:</p>
          <p className="text-blue-700 text-sm italic">
            "Started at 45,231 ended at 45,412 client meeting downtown"
          </p>
          <p className="text-blue-600 text-xs mt-2 opacity-75">
            Date is optional — today's date is used if you don't say one.
          </p>
        </div>
      )}

      {/* Processing Spinner */}
      {isProcessing && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-gray-500 text-sm">Logging your trip…</p>
          {transcript && (
            <div className="w-full bg-gray-100 rounded-xl p-3 text-sm text-gray-600 italic">
              "{transcript}"
            </div>
          )}
        </div>
      )}

      {/* Success Card */}
      {appState === 'success' && lastTrip && (
        <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-bold text-xl">
            <span>✅</span>
            <span>Trip Logged!</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{lastTrip.date}</span>

            <span className="text-gray-500">Type</span>
            <span className="font-medium capitalize">
              {lastTrip.trip_type === 'business' ? '💼 Business' : '🏠 Personal'}
            </span>

            <span className="text-gray-500">Start</span>
            <span className="font-medium">
              {lastTrip.start_miles.toLocaleString()} mi
            </span>

            <span className="text-gray-500">End</span>
            <span className="font-medium">
              {lastTrip.end_miles.toLocaleString()} mi
            </span>

            <span className="text-gray-500">Distance</span>
            <span className="font-bold text-blue-700 text-base">
              {(lastTrip.end_miles - lastTrip.start_miles).toLocaleString()} mi
            </span>

            {lastTrip.notes && (
              <>
                <span className="text-gray-500">Notes</span>
                <span className="font-medium">{lastTrip.notes}</span>
              </>
            )}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition"
          >
            Log Another Trip
          </button>
        </div>
      )}

      {/* Error Card */}
      {appState === 'error' && (
        <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-700 font-bold text-lg">
            <span>⚠️</span>
            <span>Something went wrong</span>
          </div>
          <p className="text-sm text-red-600">{errorMessage}</p>
          <button
            onClick={reset}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:scale-95 transition"
          >
            Try Again
          </button>
        </div>
      )}
    </main>
  );
}
