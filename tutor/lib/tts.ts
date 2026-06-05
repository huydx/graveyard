/**
 * Text-to-speech abstraction.
 *
 * v1: Web Speech API (browser-side) — SpeechSynthesis.
 * The browser converts AI response text to audio for auto-play.
 *
 * Future: ElevenLabs, Google Cloud TTS, or other cloud TTS with
 * better Japanese voice quality and speed control.
 */

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

export interface TTSOptions {
  rate?: number; // 0.5 - 2.0, default 0.85 (slightly slower for kids)
  pitch?: number;
  voice?: string;
}

export function speak(text: string, options: TTSOptions = {}): void {
  if (typeof window === "undefined") return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = options.rate ?? 0.85; // Slightly slower for 6-year-old
  utterance.pitch = options.pitch ?? 1.1; // Slightly higher, friendlier

  // Try to find a Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(
    (v) => v.lang.startsWith("ja") && v.name.includes("Google")
  );
  if (jaVoice) {
    utterance.voice = jaVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false;
  return window.speechSynthesis.speaking;
}
