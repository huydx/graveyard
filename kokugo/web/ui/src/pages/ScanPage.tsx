import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { addExercisePage, deleteExercisePage, ensureScanDraft, getExercise, parseExercise } from "../api/client";
import CameraModal from "../components/CameraModal";
import RubyHtml from "../components/RubyHtml";
import { useDraftExercise } from "../context/DraftExerciseContext";
import * as L from "../lib/uiLabelsRuby";

function imageFilesFromFileList(files: FileList | null): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}

function imageFilesFromDataTransferItems(items: DataTransferItemList | null | undefined): File[] {
  if (!items?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** Scan is always in context of one print: `/prints/:assignmentId/scan`. */
export default function ScanPage() {
  const { assignmentId: rawAid } = useParams<{ assignmentId: string }>();
  const assignmentId = rawAid ? decodeURIComponent(rawAid) : "";

  const { draftExerciseId, setDraftExerciseId } = useDraftExercise();
  const draftExerciseIdRef = useRef<string | null>(draftExerciseId);
  const [bindErr, setBindErr] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [showParse, setShowParse] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [thumbRev, setThumbRev] = useState(0);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const navigate = useNavigate();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    draftExerciseIdRef.current = draftExerciseId;
  }, [draftExerciseId]);

  useEffect(() => {
    if (!assignmentId) return;
    setBindErr("");
    setDraftExerciseId(null);
    ensureScanDraft(assignmentId)
      .then(({ exerciseId }) => {
        if (!exerciseId) {
          setBindErr(L.scanBindErr);
          return;
        }
        setDraftExerciseId(exerciseId);
      })
      .catch((e) => setBindErr(e instanceof Error ? e.message : "エラー"));
  }, [assignmentId, setDraftExerciseId]);

  useEffect(() => {
    if (!draftExerciseId) {
      setPageCount(0);
      setShowParse(false);
      return;
    }
    getExercise(draftExerciseId)
      .then((d) => {
        if (d.exercise.status !== "draft") {
          setUploadStatus(L.scanReloadHint);
          setShowParse(false);
          setPageCount(d.exercise.imagePaths?.length ?? 0);
          return;
        }
        const n = d.exercise.imagePaths?.length ?? (d.exercise.imagePath ? 1 : 0);
        setPageCount(n);
        setShowParse(true);
      })
      .catch(() => {
        /* invalid */
      });
  }, [draftExerciseId]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const exerciseId = draftExerciseIdRef.current;
    if (!exerciseId) {
      setUploadStatus(L.waitingForPrintLoad);
      return;
    }
    try {
      for (let i = 0; i < list.length; i++) {
        setUploadStatus(list.length > 1 ? L.uploading(i + 1, list.length) : L.uploadingSingle);
        const data = await addExercisePage(exerciseId, list[i]);
        const n = data.imagePaths?.length ?? 0;
        setPageCount(n);
      }
      setUploadStatus(L.uploadOk);
      setShowParse(true);
      setThumbRev((r) => r + 1);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "エラー");
    }
  }, []);

  const uploadFile = async (f: File) => {
    await uploadFiles([f]);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (cameraModalOpen) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      const files = imageFilesFromDataTransferItems(e.clipboardData?.items);
      if (files.length === 0) return;
      e.preventDefault();
      void uploadFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [cameraModalOpen, uploadFiles]);

  const onFileFromInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = imageFilesFromFileList(e.target.files);
    e.target.value = "";
    if (list.length === 0) return;
    await uploadFiles(list);
  };

  const onRemovePage = async (pageIndex: number) => {
    if (!draftExerciseId || !assignmentId) return;
    setUploadStatus(L.deletingPage);
    try {
      const data = await deleteExercisePage(draftExerciseId, pageIndex);
      if (data.exerciseDeleted) {
        draftExerciseIdRef.current = null;
        setDraftExerciseId(null);
        setPageCount(0);
        setShowParse(false);
        setUploadStatus(L.draftCleared);
        setThumbRev((r) => r + 1);
        window.setTimeout(() => {
          navigate(`/prints/${encodeURIComponent(assignmentId)}`);
        }, 400);
        return;
      }
      const n = data.imagePaths?.length ?? 0;
      setPageCount(n);
      setThumbRev((r) => r + 1);
      setUploadStatus(L.pageRemoved);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "エラー");
    }
  };

  const onParse = async () => {
    if (!draftExerciseId || !assignmentId) return;
    setParseStatus(L.geminiParsing);
    try {
      const pr = await parseExercise(draftExerciseId);
      const n = pr.exerciseCount ?? 1;
      const pageNote = pageCount > 1 ? L.parseNoteMulti : "";
      setParseStatus(
        n > 1 ? L.parseDoneSplit(n, pageNote) : L.parseDoneSingle(pageNote)
      );
      window.setTimeout(() => navigate(`/prints/${encodeURIComponent(assignmentId)}`), 500);
    } catch (err) {
      setParseStatus(err instanceof Error ? err.message : "エラー");
    }
  };

  if (!assignmentId) {
    return <Navigate to="/prints" replace />;
  }

  if (bindErr) {
    return (
      <section className="view">
        <div className="card">
          <p className="status">
            <RubyHtml html={bindErr} />
          </p>
          <Link to="/prints">
            <RubyHtml html={L.toPrintList} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <nav className="print-breadcrumb muted">
        <Link to={`/prints/${encodeURIComponent(assignmentId)}`}>
          <RubyHtml html={L.backToThisPrint} />
        </Link>
      </nav>
      <section className="view">
        <div className="card">
          <h2>
            <RubyHtml html={L.step1Head} />
          </h2>
          <p className="muted">
            <RubyHtml html={L.step1Body} />
          </p>

          <div className="scan-actions">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="file-input"
              aria-label={L.ariaCameraCapture}
              onChange={onFileFromInput}
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
              type="file"
              accept="image/*"
              multiple
              className="file-input"
              aria-label={L.ariaPickFiles}
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
          {draftExerciseId && pageCount > 0 && (
            <div className="scan-page-strip" aria-label={L.ariaUploadedPages}>
              <p className="muted scan-page-count">
                <RubyHtml html={L.scanPageStripHint(pageCount)} />
              </p>
              <div className="scan-thumbs">
                {Array.from({ length: pageCount }, (_, i) => (
                  <div key={`${draftExerciseId}-${i}`} className="scan-thumb-wrap">
                    <img
                      src={`/api/exercises/${encodeURIComponent(draftExerciseId)}/image/${i}?v=${thumbRev}`}
                      alt={`ページ ${i + 1}`}
                      className="scan-thumb"
                    />
                    <button
                      type="button"
                      className="scan-thumb-remove"
                      aria-label={L.ariaRemovePage(i)}
                      onClick={() => void onRemovePage(i)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {showParse && (
          <div className="card">
            <h2>
              <RubyHtml html={L.step2Head} />
            </h2>
            <p className="status">
              <RubyHtml html={parseStatus} />
            </p>
            <button
              type="button"
              className="btn btn-primary btn-xl"
              onClick={() => void onParse()}
              disabled={!draftExerciseId || pageCount < 1}
            >
              <RubyHtml html={pageCount > 1 ? L.parseBtnMulti(pageCount) : L.parseBtnSingle} />
            </button>
            {pageCount < 1 ? (
              <p className="muted">
                <RubyHtml html={L.needOnePage} />
              </p>
            ) : null}
          </div>
        )}
      </section>

      <CameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(file) => {
          void uploadFile(file);
        }}
      />
    </>
  );
}
