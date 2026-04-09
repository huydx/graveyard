import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  addExercisePage,
  deleteExercisePage,
  ensureSansuScanDraft,
  getExercise,
  getSansuExerciseKotsu,
  summarizeSansuExerciseKotsu,
} from "../api/client";
import CameraModal from "../components/CameraModal";
import RubyHtml from "../components/RubyHtml";
import ScanImageModal from "../components/ScanImageModal";
import { paths } from "../lib/paths";
import { sanitizeVisualizationHtml } from "../lib/ruby";
import * as L from "../lib/uiLabelsRuby";
import type { SansuKotsuSummary } from "../types";

function imageFilesFromFileList(files: FileList | null): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}

function escXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapByRunes(s: string, max = 16): string[] {
  const chars = Array.from((s || "").trim());
  if (chars.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += max) out.push(chars.slice(i, i + max).join(""));
  return out;
}

type VisualMode = "number-line" | "groups" | "part-whole" | "steps";

function pickVisualMode(summary: SansuKotsuSummary): VisualMode {
  const text = `${summary.main_idea} ${summary.pattern} ${summary.care_points.join(" ")} ${(summary.visualization_ideas || []).join(" ")}`;
  if (/(たし算|ひき算|和|差|増える|へる|数直線)/.test(text)) return "number-line";
  if (/(かけ算|わり算|倍|等分|グループ|くり返し)/.test(text)) return "groups";
  if (/(分数|全体|部分|比べる|のこり|合計)/.test(text)) return "part-whole";
  return "steps";
}

function teachingSceneSvg(summary: SansuKotsuSummary): string {
  const mode = pickVisualMode(summary);
  const title = escXml(summary.pattern || "さんすうのコツ");

  const common = `
    <rect width="1080" height="1080" fill="#f8fbff"/>
    <rect x="54" y="54" width="972" height="972" rx="40" fill="#ffffff" stroke="#bfdbfe" stroke-width="4"/>
    <text x="104" y="132" font-size="42" font-family="sans-serif" font-weight="700" fill="#1d4ed8">Think Like a Math Explorer</text>
    <text x="104" y="182" font-size="30" font-family="sans-serif" font-weight="700" fill="#0f172a">${title}</text>
    <circle cx="914" cy="138" r="44" fill="#fef08a"/>
    <circle cx="914" cy="138" r="30" fill="#fde047"/>
    <circle cx="900" cy="132" r="4" fill="#334155"/>
    <circle cx="928" cy="132" r="4" fill="#334155"/>
    <path d="M900 149 Q914 161 928 149" stroke="#334155" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  `;

  const tips = `<text x="104" y="954" font-size="28" font-family="sans-serif" fill="#475569">look • group • move • check</text>`;

  if (mode === "number-line") {
    const marks = Array.from({ length: 7 }, (_, i) => 170 + i * 110);
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  ${common}
  <text x="104" y="292" font-size="30" font-family="sans-serif" fill="#334155">Number line adventure</text>
  <line x1="170" y1="430" x2="830" y2="430" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  ${marks
    .map(
      (x, i) => `
    <line x1="${x}" y1="414" x2="${x}" y2="446" stroke="#0f172a" stroke-width="4"/>
    <text x="${x - 8}" y="474" font-size="24" font-family="sans-serif" fill="#334155">${i}</text>`
    )
    .join("")}
  <path d="M170 388 Q280 306 390 388" stroke="#2563eb" stroke-width="6" fill="none"/>
  <polygon points="390,388 375,380 376,397" fill="#2563eb"/>
  <path d="M500 388 Q610 468 720 388" stroke="#ef4444" stroke-width="6" fill="none"/>
  <polygon points="500,388 515,380 514,397" fill="#ef4444"/>
  <circle cx="170" cy="430" r="14" fill="#2563eb"/>
  <circle cx="390" cy="430" r="14" fill="#10b981"/>
  <circle cx="500" cy="430" r="14" fill="#ef4444"/>
  <circle cx="720" cy="430" r="14" fill="#10b981"/>
  <rect x="130" y="560" width="820" height="300" rx="28" fill="#f8fafc" stroke="#cbd5e1"/>
  <path d="M220 700 l72 -52 l72 52 l72 -52 l72 52" stroke="#334155" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M590 648 l0 104 M642 648 l0 104 M694 648 l0 104" stroke="#94a3b8" stroke-width="7" />
  <circle cx="810" cy="700" r="48" fill="#dbeafe" stroke="#60a5fa" stroke-width="4"/>
  <path d="M789 700 l16 16 l28 -32" stroke="#2563eb" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${tips}
</svg>`;
  }

  if (mode === "groups") {
    const circles = Array.from({ length: 12 }, (_, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return { x: 190 + col * 82, y: 366 + row * 78 };
    });
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  ${common}
  <text x="104" y="292" font-size="30" font-family="sans-serif" fill="#334155">Array & groups</text>
  <rect x="140" y="320" width="380" height="280" rx="24" fill="#f0fdf4" stroke="#86efac"/>
  ${circles
    .map((c) => `<circle cx="${c.x}" cy="${c.y}" r="18" fill="#34d399" stroke="#065f46" stroke-width="2"/>`)
    .join("")}
  <text x="170" y="640" font-size="28" font-family="sans-serif" fill="#065f46">group</text>
  <rect x="620" y="330" width="320" height="160" rx="20" fill="#eff6ff" stroke="#93c5fd"/>
  <text x="670" y="392" font-size="34" font-family="sans-serif" fill="#1e3a8a">3 × 4</text>
  <text x="650" y="440" font-size="30" font-family="sans-serif" fill="#1e3a8a">equal groups</text>
  <line x1="534" y1="430" x2="610" y2="430" stroke="#0f172a" stroke-width="4"/>
  <polygon points="610,430 594,422 594,438" fill="#0f172a"/>
  <rect x="620" y="540" width="320" height="160" rx="20" fill="#fff7ed" stroke="#fdba74"/>
  <text x="644" y="608" font-size="34" font-family="sans-serif" fill="#9a3412">12 ÷ 3</text>
  <text x="650" y="654" font-size="30" font-family="sans-serif" fill="#9a3412">how many groups?</text>
  ${tips}
</svg>`;
  }

  if (mode === "part-whole") {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  ${common}
  <text x="104" y="292" font-size="30" font-family="sans-serif" fill="#334155">Part ↔ Whole map</text>
  <rect x="140" y="338" width="800" height="100" rx="20" fill="#e0f2fe" stroke="#7dd3fc"/>
  <rect x="140" y="338" width="300" height="100" rx="20" fill="#bae6fd"/>
  <rect x="440" y="338" width="220" height="100" rx="0" fill="#7dd3fc"/>
  <rect x="660" y="338" width="280" height="100" rx="20" fill="#38bdf8"/>
  <text x="184" y="398" font-size="28" font-family="sans-serif" fill="#0c4a6e">A</text>
  <text x="500" y="398" font-size="28" font-family="sans-serif" fill="#0c4a6e">B</text>
  <text x="760" y="398" font-size="28" font-family="sans-serif" fill="#0c4a6e">?</text>
  <ellipse cx="770" cy="386" rx="170" ry="70" fill="none" stroke="#ef4444" stroke-width="6" stroke-dasharray="10 8"/>
  <path d="M210 546 h620" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
  <rect x="210" y="600" width="180" height="110" rx="14" fill="#dbeafe" />
  <rect x="420" y="600" width="180" height="110" rx="14" fill="#bfdbfe" />
  <rect x="630" y="600" width="180" height="110" rx="14" fill="#93c5fd" />
  ${tips}
</svg>`;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  ${common}
  <text x="104" y="292" font-size="30" font-family="sans-serif" fill="#334155">Problem solving flow</text>
  <rect x="140" y="332" width="800" height="92" rx="18" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="170" y="388" font-size="30" font-family="sans-serif" fill="#0f172a">given</text>
  <text x="104" y="470" font-size="30" font-family="sans-serif" fill="#334155">focus → model → check</text>
  <rect x="140" y="510" width="800" height="92" rx="18" fill="#eef2ff" stroke="#a5b4fc"/>
  <text x="170" y="566" font-size="30" font-family="sans-serif" fill="#312e81">target</text>
  <circle cx="260" cy="742" r="40" fill="#c7d2fe"/><text x="246" y="752" font-size="28" font-family="sans-serif" fill="#312e81">1</text>
  <circle cx="460" cy="742" r="40" fill="#bfdbfe"/><text x="446" y="752" font-size="28" font-family="sans-serif" fill="#1e3a8a">2</text>
  <circle cx="660" cy="742" r="40" fill="#bbf7d0"/><text x="646" y="752" font-size="28" font-family="sans-serif" fill="#166534">3</text>
  <path d="M304 742 H416 M504 742 H616" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
  <polygon points="416,742 402,734 402,750" fill="#334155"/>
  <polygon points="616,742 602,734 602,750" fill="#334155"/>
  ${tips}
</svg>`;
}

function makeSummaryVisualDataUrl(summary: SansuKotsuSummary): string {
  const svg = teachingSceneSvg(summary);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export default function SansuScanPage() {
  const { assignmentId: rawAid } = useParams<{ assignmentId: string }>();
  const assignmentId = rawAid ? decodeURIComponent(rawAid) : "";
  const [draftExerciseId, setDraftExerciseId] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [bindErr, setBindErr] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [thumbRev, setThumbRev] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [scanModalIndex, setScanModalIndex] = useState<number | null>(null);
  const [summary, setSummary] = useState<SansuKotsuSummary | null>(null);
  const [visualUrl, setVisualUrl] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    draftRef.current = draftExerciseId;
  }, [draftExerciseId]);

  useEffect(() => {
    if (!assignmentId) return;
    setBindErr("");
    ensureSansuScanDraft(assignmentId)
      .then(({ exerciseId }) => {
        setDraftExerciseId(exerciseId);
        draftRef.current = exerciseId;
      })
      .catch((e) => setBindErr(e instanceof Error ? e.message : "エラー"));
  }, [assignmentId]);

  useEffect(() => {
    if (!draftExerciseId) {
      setPageCount(0);
      setSummary(null);
      setVisualUrl("");
      return;
    }
    getExercise(draftExerciseId)
      .then((d) => {
        const n = d.exercise.imagePaths?.length ?? (d.exercise.imagePath ? 1 : 0);
        setPageCount(n);
      })
      .catch(() => {
        /* ignore */
      });
    getSansuExerciseKotsu(draftExerciseId)
      .then((d) => {
        setSummary(d.summary);
        setVisualUrl(makeSummaryVisualDataUrl(d.summary));
      })
      .catch(() => {
        /* summary not created yet */
      });
  }, [draftExerciseId]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const eid = draftRef.current;
    if (!eid) return;
    try {
      for (let i = 0; i < list.length; i++) {
        setUploadStatus(list.length > 1 ? L.uploading(i + 1, list.length) : L.uploadingSingle);
        const data = await addExercisePage(eid, list[i]);
        setPageCount(data.imagePaths?.length ?? 0);
      }
      setUploadStatus(L.uploadOk);
      setThumbRev((r) => r + 1);
    } catch (e) {
      setUploadStatus(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  const onFileFromInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = imageFilesFromFileList(e.target.files);
    e.target.value = "";
    if (list.length === 0) return;
    await uploadFiles(list);
  };

  const onRemovePage = async (pageIndex: number) => {
    const eid = draftRef.current;
    if (!eid) return;
    try {
      setUploadStatus(L.deletingPage);
      const data = await deleteExercisePage(eid, pageIndex);
      if (data.exerciseDeleted) {
        setDraftExerciseId(null);
        draftRef.current = null;
        setPageCount(0);
      } else {
        setPageCount(data.imagePaths?.length ?? 0);
      }
      setThumbRev((r) => r + 1);
      setUploadStatus(L.pageRemoved);
    } catch (e) {
      setUploadStatus(e instanceof Error ? e.message : "エラー");
    }
  };

  const onAnalyze = async () => {
    const eid = draftRef.current;
    if (!eid || pageCount < 1) return;
    setParseStatus(L.sansuAnalyzing);
    try {
      const res = await summarizeSansuExerciseKotsu(eid);
      setSummary(res.summary);
      setVisualUrl(makeSummaryVisualDataUrl(res.summary));
      setParseStatus("");
    } catch (e) {
      setParseStatus(e instanceof Error ? e.message : "エラー");
    }
  };

  if (!assignmentId) return <Navigate to={paths.sansu.prints} replace />;

  if (bindErr) {
    return (
      <section className="view">
        <div className="card">
          <p className="status">{bindErr}</p>
          <Link to={paths.sansu.prints}>
            <RubyHtml html={L.toPrintList} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <nav className="print-breadcrumb muted">
        <Link to={paths.sansu.prints}>
          <RubyHtml html={L.backPrintList} />
        </Link>
      </nav>
      <section className="view">
        <div className="card">
          <h2>
            <RubyHtml html={L.sansuStep1Head} />
          </h2>
          <p className="muted">
            <RubyHtml html={L.sansuStep1Body} />
          </p>
          <div className="scan-actions">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="file-input"
              onChange={onFileFromInput}
            />
            <button type="button" className="btn btn-primary btn-xl btn-block" onClick={() => cameraInputRef.current?.click()}>
              <RubyHtml html={L.btnCameraTake} />
            </button>
            <button type="button" className="btn btn-secondary btn-xl btn-block" onClick={() => setCameraModalOpen(true)}>
              <RubyHtml html={L.btnScreenShutter} />
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="file-input"
              onChange={onFileFromInput}
            />
            <button type="button" className="btn btn-secondary btn-xl btn-block" onClick={() => galleryInputRef.current?.click()}>
              <RubyHtml html={L.btnAlbumPick} />
            </button>
          </div>
          <p className="status">
            <RubyHtml html={uploadStatus} />
          </p>
          {draftExerciseId && pageCount > 0 ? (
            <div className="scan-page-strip" aria-label={L.ariaUploadedPages}>
              <div className="scan-thumbs">
                {Array.from({ length: pageCount }, (_, i) => (
                  <div key={`${draftExerciseId}-${i}`} className="scan-thumb-wrap">
                    <button
                      type="button"
                      className="scan-thumb-btn"
                      aria-label={L.ariaEnlargePage(i)}
                      onClick={() => setScanModalIndex(i)}
                    >
                      <img
                        src={`/api/exercises/${encodeURIComponent(draftExerciseId)}/image/${i}?v=${thumbRev}`}
                        alt=""
                        className="scan-thumb"
                      />
                    </button>
                    <button type="button" className="scan-thumb-remove" onClick={() => void onRemovePage(i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="card">
          <h2>
            <RubyHtml html={L.sansuStep2Head} />
          </h2>
          <p className="status">
            <RubyHtml html={parseStatus} />
          </p>
          <button type="button" className="btn btn-primary btn-xl" onClick={() => void onAnalyze()} disabled={pageCount < 1}>
            <RubyHtml html={L.sansuAnalyze} />
          </button>
          {pageCount < 1 ? (
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
            <h3>
              <RubyHtml html={L.sansuVisualHead} />
            </h3>
            <div className="sansu-visual-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVisualUrl(makeSummaryVisualDataUrl(summary))}
              >
                <RubyHtml html={visualUrl ? L.sansuVisualRecreate : L.sansuVisualCreate} />
              </button>
            </div>
            {summary.visualization_html?.trim() ? (
              <div
                className="sansu-visual-html"
                dangerouslySetInnerHTML={{ __html: sanitizeVisualizationHtml(summary.visualization_html) }}
              />
            ) : null}
            {visualUrl ? <img src={visualUrl} alt="summary visual" className="sansu-summary-visual" /> : null}
          </div>
        ) : null}
      </section>
      <CameraModal open={cameraModalOpen} onClose={() => setCameraModalOpen(false)} onCapture={(f) => void uploadFiles([f])} />
      {scanModalIndex !== null && draftExerciseId && pageCount > 0 ? (
        <ScanImageModal
          exerciseId={draftExerciseId}
          pageIndex={scanModalIndex}
          totalPages={pageCount}
          onClose={() => setScanModalIndex(null)}
          onChangePage={setScanModalIndex}
        />
      ) : null}
    </>
  );
}
