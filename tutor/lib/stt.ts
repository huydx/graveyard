/**
 * Speech-to-text abstraction.
 *
 * v1: Web Speech API (browser-side). The browser captures audio,
 * runs STT locally, and sends the transcription to our API.
 *
 * Future: Gemini Live, Deepgram, or other cloud STT.
 */

export interface STTProvider {
  transcribe(audioBuffer: ArrayBuffer, language: string): Promise<string>;
}

/**
 * Browser-side STT using Web Speech API.
 * This module provides helpers for the client component to use.
 * The actual SpeechRecognition API is called in the browser, not here.
 */
export function isSTTSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window
  );
}

export function createBrowserSTT(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
  recognition.continuous = true;

  return recognition;
}
