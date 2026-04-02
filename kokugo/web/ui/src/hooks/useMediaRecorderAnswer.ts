import { useCallback, useRef } from "react";

/**
 * Records mic audio for server-side transcription (iPad / Safari where Web Speech API is weak).
 */
export function useMediaRecorderAnswer() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
    ];
    let opts: MediaRecorderOptions = {};
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) {
        opts = { mimeType: t };
        break;
      }
    }
    const rec = new MediaRecorder(stream, opts);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(250);
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; mime: string }> => {
    return new Promise((resolve, reject) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        stopTracks();
        reject(new Error("録音していません"));
        return;
      }
      rec.onstop = () => {
        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        recorderRef.current = null;
        stopTracks();
        resolve({ blob, mime });
      };
      rec.stop();
    });
  }, [stopTracks]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
  }, [stopTracks]);

  return { start, stop, cancel };
}
