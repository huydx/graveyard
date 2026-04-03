import { useCallback, useEffect, useRef, useState } from "react";
import { SCAN_CAPTURE_SIZE_OPTIONS, scaleToMaxLongEdge } from "../lib/resizeScanImage";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  maxLongEdge: number;
  onMaxLongEdgeChange: (n: number) => void;
};

export default function CameraModal({ open, onClose, onCapture, maxLongEdge, onMaxLongEdgeChange }: Props) {
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
        setErr("カメラをつかえません。https:// または「カメラでとる」をためしてください。");
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
    const { width: tw, height: th } = scaleToMaxLongEdge(vw, vh, maxLongEdge);
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, vw, vh, 0, 0, tw, th);
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
    <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-label="カメラ">
      <div className="camera-modal">
        <div className="camera-modal-head">
          <h3>プリントをうつす</h3>
          <button type="button" className="btn btn-ghost camera-close" onClick={close}>
            とじる
          </button>
        </div>
        {err ? (
          <p className="status camera-err">{err}</p>
        ) : (
          <>
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <p className="muted camera-hint">{ready ? "シャッターをおす" : "カメラをよみこみちゅう…"}</p>
            <div className="camera-capture-size">
              <label htmlFor="camera-capture-size-select">しゃしんのおおきさ（ブラウザでちぢめる）</label>
              <select
                id="camera-capture-size-select"
                className="input-select"
                value={maxLongEdge}
                onChange={(e) => onMaxLongEdgeChange(Number.parseInt(e.target.value, 10))}
              >
                {SCAN_CAPTURE_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-xl btn-block camera-shutter"
              onClick={shutter}
              disabled={!ready}
            >
              📷 シャッター
            </button>
          </>
        )}
      </div>
    </div>
  );
}
