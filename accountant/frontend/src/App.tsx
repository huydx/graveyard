import { useCallback, useEffect, useRef, useState } from "react";
import type { ParseResponse, ReceiptRecord } from "./types";
import "./App.css";

function formatApiError(data: Record<string, unknown>, res: Response): string {
  const d = data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((x: { msg?: string }) => x.msg ?? "").filter(Boolean).join("; ");
  }
  return JSON.stringify(d ?? data) || res.statusText;
}

function LoadingPanel({
  title,
  body,
  id,
}: {
  title: string;
  body: string;
  id: string;
}) {
  return (
    <div className="loading-panel" role="status" aria-live="polite" aria-busy="true" id={id}>
      <span className="spinner" aria-hidden />
      <div className="loading-text">
        <p className="loading-title">{title}</p>
        <p className="loading-body">{body}</p>
      </div>
    </div>
  );
}

export function App() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<ReceiptRecord | null>(null);
  const [dupHint, setDupHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showForce, setShowForce] = useState(false);

  const resetBanners = useCallback(() => {
    setErr(null);
    setOk(null);
    setDupHint(null);
  }, []);

  const clearFileInputs = useCallback(() => {
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    const el = e.target;
    if (cameraRef.current && el !== cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current && el !== galleryRef.current) galleryRef.current.value = "";
    setFile(f);
    setRecord(null);
    setShowForce(false);
    resetBanners();
  };

  const parseReceipt = async () => {
    if (!file) return;
    resetBanners();
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as ParseResponse & Record<string, unknown>;
      if (!res.ok) throw new Error(formatApiError(data, res));
      setRecord(data.record);
      setShowForce(Boolean(data.duplicate));
      setDupHint(
        data.duplicate && data.existing_date
          ? `Same place and total already on ${data.existing_date}.`
          : null,
      );
    } catch (e) {
      setRecord(null);
      setShowForce(false);
      setErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  };

  const appendSheet = async (force: boolean) => {
    if (!record) return;
    resetBanners();
    setSaving(true);
    try {
      const q = force ? "?force=true" : "";
      const res = await fetch(`/api/append${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const data = (await res.json().catch(() => ({}))) as {
        existing_date?: string;
        detail?: unknown;
      };
      if (res.status === 409) {
        setShowForce(true);
        setDupHint(
          `Duplicate: already logged on ${data.existing_date ?? "?"}. Use “Add anyway”.`,
        );
        return;
      }
      if (!res.ok) throw new Error(formatApiError(data as Record<string, unknown>, res));
      setOk("Row added to your sheet.");
      setRecord(null);
      setShowForce(false);
      setFile(null);
      clearFileInputs();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not append");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <h1>Receipt parser</h1>
      <p className="sub">Photo from your phone → check fields → add a row to your Google Sheet.</p>

      <div className="card">
        <p className="pick-label">Add a receipt photo</p>
        <div className="pick-grid">
          <input
            ref={cameraRef}
            type="file"
            className="visually-hidden"
            accept="image/*"
            capture="environment"
            aria-label="Take photo with camera"
            onChange={onFilePicked}
          />
          <input
            ref={galleryRef}
            type="file"
            className="visually-hidden"
            accept="image/*"
            aria-label="Choose existing photo"
            onChange={onFilePicked}
          />
          <button type="button" className="pick-btn" onClick={() => cameraRef.current?.click()}>
            <span className="pick-title">Camera</span>
            <span className="pick-sub">Scan or snap the receipt</span>
          </button>
          <button type="button" className="pick-btn" onClick={() => galleryRef.current?.click()}>
            <span className="pick-title">Photos</span>
            <span className="pick-sub">Gallery or files</span>
          </button>
        </div>

        {file ? (
          <div className="file-meta">
            <div className="thumb-wrap">
              {previewUrl ? <img className="thumb" src={previewUrl} alt="" /> : null}
            </div>
            <p className="file-name">{file.name}</p>
            <button type="button" className="linkish" onClick={() => { setFile(null); clearFileInputs(); setRecord(null); resetBanners(); }}>
              Remove
            </button>
          </div>
        ) : null}

        <div className="row-actions">
          <button type="button" className="primary touch-btn" disabled={!file || parsing} onClick={parseReceipt}>
            {parsing ? "Working…" : "Read receipt"}
          </button>
        </div>

        {parsing ? (
          <LoadingPanel
            id="loading-parse"
            title="Reading your receipt"
            body="Gemini is extracting place, total, and category from the image. The server then checks Google Sheets for a duplicate of that amount."
          />
        ) : null}

        <div className={`preview ${record ? "" : "hidden"}`}>
          <hr className="divider" />
          <dl className="fields">
            <dt>Place</dt>
            <dd>{record?.place}</dd>
            <dt>Total (¥)</dt>
            <dd>{record != null ? record.total.toLocaleString("ja-JP") : ""}</dd>
            <dt>Payment</dt>
            <dd>{record?.paymentMethod}</dd>
            <dt>Category</dt>
            <dd>{record?.category}</dd>
          </dl>
          <div className="row-actions stack-mobile">
            <button type="button" className="primary touch-btn" disabled={saving} onClick={() => appendSheet(false)}>
              {saving ? "Working…" : "Add to sheet"}
            </button>
            {showForce ? (
              <button type="button" className="touch-btn" disabled={saving} onClick={() => appendSheet(true)}>
                Add anyway (duplicate)
              </button>
            ) : null}
          </div>
          {saving ? (
            <LoadingPanel
              id="loading-append"
              title="Saving to Google Sheets"
              body="Appending a new row to your linked Google Sheet."
            />
          ) : null}
        </div>

        <div className={`banner warn ${dupHint ? "" : "hidden"}`}>{dupHint}</div>
        <div className={`banner err ${err ? "" : "hidden"}`}>{err}</div>
        <div className={`banner ok ${ok ? "" : "hidden"}`}>{ok}</div>
      </div>
    </main>
  );
}
