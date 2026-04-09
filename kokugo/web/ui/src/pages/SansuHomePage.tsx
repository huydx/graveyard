import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { summarizeSansuKotsu } from "../api/client";
import CameraModal from "../components/CameraModal";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { SansuKotsuSummary } from "../types";

function imageFilesFromFileList(files: FileList | null): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}

export default function SansuHomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [summary, setSummary] = useState<SansuKotsuSummary | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const onPickFile = (next: File | null) => {
    setFile(next);
    setErr("");
    setUploadStatus(next ? L.sansuUploadOk : L.sansuImageRemoved);
    setSummary(null);
  };

  const onFileFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = imageFilesFromFileList(e.target.files);
    e.target.value = "";
    if (list.length === 0) return;
    onPickFile(list[0]);
  };

  const onRemoveImage = () => onPickFile(null);

  const onAnalyze = async () => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const res = await summarizeSansuKotsu(file);
      setSummary(res.summary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sansu-placeholder">
      <RubyHtml as="h2" className="sansu-placeholder-title" html={L.sansuPageTitle} />
      <p className="sansu-placeholder-lead">
        <RubyHtml html={L.sansuPageLead} />
      </p>
      <div className="card sansu-kotsu-card">
        <h2>
          <RubyHtml html={L.sansuStep1Head} />
        </h2>
        <p className="muted">
          <RubyHtml html={L.sansuStep1Body} />
        </p>
        <div className="scan-actions">
          <input
            id="sansu-kotsu-file"
            ref={cameraInputRef}
            className="sansu-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn btn-primary btn-xl btn-block"
            onClick={() => cameraInputRef.current?.click()}
          >
            <RubyHtml html={L.btnCameraTake} />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xl btn-block"
            onClick={() => setCameraModalOpen(true)}
          >
            <RubyHtml html={L.btnScreenShutter} />
          </button>
          <input
            ref={galleryInputRef}
            className="sansu-file-input"
            type="file"
            accept="image/*"
            onChange={onFileFromInput}
          />
          <button
            type="button"
            className="btn btn-secondary btn-xl btn-block"
            onClick={() => galleryInputRef.current?.click()}
          >
            <RubyHtml html={L.btnAlbumPick} />
          </button>
        </div>
        <p className="status">
          <RubyHtml html={uploadStatus} />
        </p>
        {previewUrl ? (
          <div className="scan-page-strip" aria-label={L.sansuThumbLabel}>
            <div className="scan-thumbs">
              <div className="scan-thumb-wrap">
                <img src={previewUrl} alt="" className="scan-thumb sansu-preview" />
                <button
                  type="button"
                  className="scan-thumb-remove"
                  aria-label="えらんだ画像を削除"
                  onClick={onRemoveImage}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {err ? <p className="status">{err}</p> : null}
      </div>
      <div className="card sansu-kotsu-card">
        <h2>
          <RubyHtml html={L.sansuStep2Head} />
        </h2>
        <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={onAnalyze}>
          <RubyHtml html={busy ? L.sansuAnalyzing : L.sansuAnalyze} />
        </button>
        {!file ? (
          <p className="muted">
            <RubyHtml html={L.sansuNeedOnePage} />
          </p>
        ) : null}
      </div>
      {summary ? (
        <div className="card sansu-kotsu-result">
          <h3>
            <RubyHtml html={L.sansuMainIdeaHead} />
          </h3>
          <p>{summary.main_idea}</p>
          <h3>
            <RubyHtml html={L.sansuPatternHead} />
          </h3>
          <p>{summary.pattern}</p>
          <h3>
            <RubyHtml html={L.sansuCareHead} />
          </h3>
          <ul className="sansu-care-list">
            {summary.care_points.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link to={paths.home} className="btn btn-ghost sansu-back">
        <RubyHtml html={L.backToAppHub} />
      </Link>
      <CameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(captured) => {
          onPickFile(captured);
        }}
      />
    </div>
  );
}
