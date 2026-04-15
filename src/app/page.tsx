'use client';

import { useState, useRef, useEffect } from 'react';
import type { TripType, ActiveTrip, ParsedTrip } from '@/types/trip';

// Which phase the user is in
type Phase = 'start' | 'in-trip' | 'success';
// State of the microphone within a phase
type MicState = 'idle' | 'recording' | 'processing' | 'error';

const STORAGE_KEY = 'mileageTracker_activeTrip';

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
  const [phase, setPhase] = useState<Phase>('start');
  const [tripType, setTripType] = useState<TripType>('business');
  const [micState, setMicState] = useState<MicState>('idle');
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [completedTrip, setCompletedTrip] = useState<ParsedTrip | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const micStateRef = useRef<MicState>('idle');

  // Keep ref in sync so speech event handlers always see current state
  useEffect(() => {
    micStateRef.current = micState;
  }, [micState]);

  // Restore any in-progress trip from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const trip: ActiveTrip = JSON.parse(saved);
        setActiveTrip(trip);
        setTripType(trip.trip_type);
        setPhase('in-trip');
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  // ── Voice helpers ────────────────────────────────────────────────────────

  function startRecording(onResult: (text: string) => void) {
    if (micStateRef.current !== 'idle') return;

    const SpeechRecognitionClass =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage(
        'Voice input is not supported in this browser. Please use Chrome or Safari.'
      );
      setMicState('error');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setMicState('recording');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      onResult(text);
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
      setMicState('error');
    };

    recognition.onend = () => {
      if (micStateRef.current === 'recording') setMicState('idle');
    };

    recognition.start();
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  function clearError() {
    setErrorMessage('');
    setMicState('idle');
  }

  // ── Phase 1: Start trip ──────────────────────────────────────────────────

  function handleStartMicDown() {
    startRecording(handleStartMiles);
  }

  async function handleStartMiles(text: string) {
    setMicState('processing');
    try {
      const res = await fetch('/api/parse-miles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_text: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to read miles');

      const todayDate = new Date().toISOString().split('T')[0];
      const trip: ActiveTrip = {
        trip_type: tripType,
        start_miles: data.miles as number,
        start_date: todayDate,
        notes: (data.notes as string) ?? '',
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
      setActiveTrip(trip);
      setPhase('in-trip');
      setMicState('idle');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setMicState('error');
    }
  }

  // ── Phase 2: End trip ────────────────────────────────────────────────────

  function handleEndMicDown() {
    startRecording(handleEndMiles);
  }

  async function handleEndMiles(text: string) {
    if (!activeTrip) return;
    setMicState('processing');
    try {
      // Parse ending odometer
      const parseRes = await fetch('/api/parse-miles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_text: text }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.success)
        throw new Error(parseData.error ?? 'Failed to read miles');

      const endMiles = parseData.miles as number;
      const endNotes = (parseData.notes as string) ?? '';

      // Combine notes from start and end (if both exist)
      const combinedNotes = [activeTrip.notes, endNotes]
        .filter(Boolean)
        .join(' — ');

      // Write the completed trip to Google Sheets
      const logRes = await fetch('/api/log-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_miles: activeTrip.start_miles,
          end_miles: endMiles,
          trip_type: activeTrip.trip_type,
          date: activeTrip.start_date,
          notes: combinedNotes,
        }),
      });
      const logData = await logRes.json();
      if (!logRes.ok || !logData.success)
        throw new Error(logData.error ?? 'Failed to save trip');

      localStorage.removeItem(STORAGE_KEY);
      setActiveTrip(null);
      setCompletedTrip(logData.trip as ParsedTrip);
      setPhase('success');
      setMicState('idle');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setMicState('error');
    }
  }

  function cancelTrip() {
    localStorage.removeItem(STORAGE_KEY);
    setActiveTrip(null);
    setPhase('start');
    setMicState('idle');
    setErrorMessage('');
  }

  function startNewTrip() {
    setCompletedTrip(null);
    setPhase('start');
    setMicState('idle');
    setErrorMessage('');
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const isRecording = micState === 'recording';
  const isProcessing = micState === 'processing';
  const isMicBusy = isRecording || isProcessing;

  function MicButton({
    onDown,
    label,
    color = 'blue',
  }: {
    onDown: () => void;
    label: string;
    color?: 'blue' | 'green';
  }) {
    const baseColor =
      color === 'green'
        ? 'bg-green-600 hover:bg-green-700 shadow-green-300'
        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-300';

    return (
      <div className="flex flex-col items-center gap-3">
        <button
          onPointerDown={onDown}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          disabled={isProcessing}
          className={`w-36 h-36 rounded-full text-white text-6xl shadow-xl
            transition-all select-none touch-none
            ${
              isRecording
                ? 'bg-red-500 animate-pulse scale-110 shadow-red-300'
                : baseColor
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isRecording ? 'Release to stop' : label}
        >
          🎤
        </button>
        <p className="text-center text-gray-500 text-sm">
          {isRecording
            ? 'Listening… release when done'
            : isProcessing
            ? 'Processing…'
            : label}
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-5 gap-7 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Mileage Tracker</h1>
        <p className="text-gray-500 text-sm mt-1">Voice-powered trip log</p>
      </div>

      {/* ── PHASE: Start trip ── */}
      {phase === 'start' && (
        <>
          {/* Trip type toggle */}
          <div className="flex w-full rounded-2xl overflow-hidden border-2 border-blue-600 shadow-sm">
            {(['business', 'personal'] as TripType[]).map((type) => (
              <button
                key={type}
                onClick={() => setTripType(type)}
                disabled={isMicBusy}
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

          {/* Mic button */}
          {micState !== 'error' && (
            <MicButton onDown={handleStartMicDown} label="Hold to speak starting miles" />
          )}

          {/* Hint */}
          {micState === 'idle' && (
            <div className="w-full bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-blue-800 text-sm font-medium mb-1">What to say:</p>
              <p className="text-blue-700 text-sm italic">"45,231"</p>
              <p className="text-blue-700 text-sm italic mt-1">
                "45,231 — heading to client meeting"
              </p>
            </div>
          )}

          {/* Processing spinner */}
          {isProcessing && (
            <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          )}

          {/* Error */}
          {micState === 'error' && (
            <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
              <p className="text-red-700 font-semibold">⚠️ Could not read miles</p>
              <p className="text-sm text-red-600">{errorMessage}</p>
              <button
                onClick={clearError}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </>
      )}

      {/* ── PHASE: Trip in progress ── */}
      {phase === 'in-trip' && activeTrip && (
        <>
          {/* Active trip banner */}
          <div className="w-full bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-2">
            <p className="text-amber-800 font-bold text-lg">Trip in progress</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">
                {activeTrip.trip_type === 'business' ? '💼 Business' : '🏠 Personal'}
              </span>
              <span className="text-gray-500">Started</span>
              <span className="font-medium">{activeTrip.start_date}</span>
              <span className="text-gray-500">Odometer</span>
              <span className="font-medium">
                {activeTrip.start_miles.toLocaleString()} mi
              </span>
              {activeTrip.notes && (
                <>
                  <span className="text-gray-500">Notes</span>
                  <span className="font-medium">{activeTrip.notes}</span>
                </>
              )}
            </div>
          </div>

          {/* End trip mic */}
          {micState !== 'error' && (
            <MicButton
              onDown={handleEndMicDown}
              label="Hold to speak ending miles"
              color="green"
            />
          )}

          {/* Hint */}
          {micState === 'idle' && (
            <div className="w-full bg-green-50 rounded-2xl p-4 border border-green-100">
              <p className="text-green-800 text-sm font-medium mb-1">What to say:</p>
              <p className="text-green-700 text-sm italic">"45,412"</p>
              <p className="text-green-700 text-sm italic mt-1">
                "45,412 — picked up parts at warehouse"
              </p>
            </div>
          )}

          {/* Processing spinner */}
          {isProcessing && (
            <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
          )}

          {/* Error */}
          {micState === 'error' && (
            <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
              <p className="text-red-700 font-semibold">⚠️ Could not read miles</p>
              <p className="text-sm text-red-600">{errorMessage}</p>
              <button
                onClick={clearError}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Cancel trip */}
          {micState === 'idle' && (
            <button
              onClick={cancelTrip}
              className="text-sm text-gray-400 underline hover:text-gray-600 transition"
            >
              Cancel this trip
            </button>
          )}
        </>
      )}

      {/* ── PHASE: Success ── */}
      {phase === 'success' && completedTrip && (
        <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-bold text-xl">
            <span>✅</span>
            <span>Trip Logged!</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{completedTrip.date}</span>

            <span className="text-gray-500">Type</span>
            <span className="font-medium">
              {completedTrip.trip_type === 'business' ? '💼 Business' : '🏠 Personal'}
            </span>

            <span className="text-gray-500">Start</span>
            <span className="font-medium">
              {completedTrip.start_miles.toLocaleString()} mi
            </span>

            <span className="text-gray-500">End</span>
            <span className="font-medium">
              {completedTrip.end_miles.toLocaleString()} mi
            </span>

            <span className="text-gray-500">Distance</span>
            <span className="font-bold text-blue-700 text-base">
              {(
                completedTrip.end_miles - completedTrip.start_miles
              ).toLocaleString()}{' '}
              mi
            </span>

            {completedTrip.notes && (
              <>
                <span className="text-gray-500">Notes</span>
                <span className="font-medium">{completedTrip.notes}</span>
              </>
            )}
          </div>

          <button
            onClick={startNewTrip}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition"
          >
            Start New Trip
          </button>
        </div>
      )}
    </main>
  );
}
