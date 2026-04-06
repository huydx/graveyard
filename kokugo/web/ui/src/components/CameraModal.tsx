import { useCallback, useEffect, useRef, useState } from "react";
import RubyHtml from "./RubyHtml";
import * as L from "../lib/uiLabelsRuby";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export default function CameraModal({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        setErr(L.cameraErr);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, stopStream]);

  const shutter = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        stopStream();
        onClose();
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const close = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-label={L.cameraModalAria}>
      <div className="camera-modal">
        <div className="camera-modal-head">
          <h3>
            <RubyHtml html={L.cameraShootTitle} />
          </h3>
          <button type="button" className="btn btn-ghost camera-close" onClick={close}>
            <RubyHtml html={L.closeJa} />
          </button>
        </div>
        {err ? (
          <p className="status camera-err">
            <RubyHtml html={err} />
          </p>
        ) : (
          <>
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <p className="muted camera-hint">
              <RubyHtml html={ready ? L.shutterPress : L.cameraLoading} />
            </p>
            <button
              type="button"
              className="btn btn-primary btn-xl btn-block camera-shutter"
              onClick={shutter}
              disabled={!ready}
            >
              <RubyHtml html={L.shutterBtn} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
