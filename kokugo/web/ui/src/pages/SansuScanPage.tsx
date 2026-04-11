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
import SansuKotsuVisualSection from "../components/SansuKotsuVisualSection";
import ScanImageModal from "../components/ScanImageModal";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { SansuKotsuSummary } from "../types";

function imageFilesFromFileList(files: FileList | null): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
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
  const [kotsuPages, setKotsuPages] = useState<SansuKotsuSummary[] | null>(null);
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
      setKotsuPages(null);
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
        setKotsuPages(Array.isArray(d.pages) ? d.pages : []);
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
      setKotsuPages(Array.isArray(res.pages) ? res.pages : []);
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
        {kotsuPages && kotsuPages.length > 0
          ? kotsuPages.map((pg, pageIdx) => (
              <div key={pageIdx} className="card sansu-kotsu-result sansu-kotsu-page-block">
                {kotsuPages.length > 1 ? (
                  <h2 className="sansu-kotsu-page-title">
                    <RubyHtml html={L.sansuKotsuPageTitle(pageIdx + 1)} />
                  </h2>
                ) : null}
                <h3>
                  <RubyHtml html={L.sansuMainIdeaHead} />
                </h3>
                <p>{pg.main_idea}</p>
                <h3>
                  <RubyHtml html={L.sansuPatternHead} />
                </h3>
                <p>{pg.pattern}</p>
                <h3>
                  <RubyHtml html={L.sansuCareHead} />
                </h3>
                <ul className="sansu-care-list">
                  {pg.care_points.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
                <SansuKotsuVisualSection summary={pg} />
              </div>
            ))
          : null}
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
