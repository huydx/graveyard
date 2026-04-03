import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addExercisePage, deleteExercisePage, getExercise, parseExercise, uploadScan } from "../api/client";
import CameraModal from "../components/CameraModal";
import { useDraftExercise } from "../context/DraftExerciseContext";

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

export default function ScanPage() {
  const navigate = useNavigate();
  const { draftExerciseId, setDraftExerciseId } = useDraftExercise();
  const draftExerciseIdRef = useRef<string | null>(draftExerciseId);
  const [uploadStatus, setUploadStatus] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [showParse, setShowParse] = useState(!!draftExerciseId);
  const [pageCount, setPageCount] = useState(0);
  const [thumbRev, setThumbRev] = useState(0);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    draftExerciseIdRef.current = draftExerciseId;
  }, [draftExerciseId]);

  useEffect(() => {
    if (!draftExerciseId) {
      setPageCount(0);
      setUploadStatus("");
      setParseStatus("");
      setShowParse(false);
      return;
    }
    getExercise(draftExerciseId)
      .then((d) => {
        const n = d.exercise.imagePaths?.length ?? (d.exercise.imagePath ? 1 : 0);
        setPageCount(n);
        setShowParse(true);
      })
      .catch(() => {
        /* invalid draft */
      });
  }, [draftExerciseId]);

  /** Upload images in order to one draft; server parse runs OCR per page then merges into one exercise. */
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      let exerciseId: string | null = draftExerciseIdRef.current;
      try {
        for (let i = 0; i < list.length; i++) {
          setUploadStatus(
            list.length > 1 ? `あっぷろーどちゅう… (${i + 1}/${list.length})` : "あっぷろーどちゅう…"
          );
          const f = list[i];
          if (exerciseId) {
            const data = await addExercisePage(exerciseId, f);
            const n = data.imagePaths?.length ?? 0;
            setPageCount(n);
          } else {
            const data = await uploadScan(f);
            exerciseId = data.exerciseId;
            draftExerciseIdRef.current = data.exerciseId;
            setDraftExerciseId(data.exerciseId);
            setPageCount(data.imagePaths?.length ?? 1);
          }
        }
        setUploadStatus("あっぷろーどOK！");
        setShowParse(true);
        setThumbRev((r) => r + 1);
      } catch (err) {
        setUploadStatus(err instanceof Error ? err.message : "エラー");
      }
    },
    [setDraftExerciseId]
  );

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
    if (!draftExerciseId) return;
    setUploadStatus("ページをけしています…");
    try {
      const data = await deleteExercisePage(draftExerciseId, pageIndex);
      if (data.exerciseDeleted) {
        draftExerciseIdRef.current = null;
        setDraftExerciseId(null);
        setPageCount(0);
        setShowParse(false);
        setUploadStatus("ぜんぶけしました。また画像をえらんでください。");
        setThumbRev((r) => r + 1);
        return;
      }
      const n = data.imagePaths?.length ?? 0;
      setPageCount(n);
      setThumbRev((r) => r + 1);
      setUploadStatus("ページをけしました");
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "エラー");
    }
  };

  const onParse = async () => {
    if (!draftExerciseId) return;
    setParseStatus("Gemini がよみとっています…");
    try {
      await parseExercise(draftExerciseId);
      setParseStatus("よみとりました！れんしゅうへいきます。");
      setTimeout(() => navigate(`/exercise/${encodeURIComponent(draftExerciseId)}`), 600);
    } catch (err) {
      setParseStatus(err instanceof Error ? err.message : "エラー");
    }
  };

  return (
    <>
      <section className="view">
        <div className="card">
          <h2>ステップ1: プリントをとる</h2>
          <p className="muted">
            タブレットでは「カメラでとる」がおすすめ。PCでは「がめんうえでシャッター」かファイルをえらぶ。複数ページはアルバムでまとめてえらぶか、Ctrl+V / ⌘V
            でクリップボードの画像をいちどに追加（じゅんばんに同じれんしゅうのページになります）。Tailscale のアドレスだけ（https ではない）でつないでいるとき、ブラウザによってはシャッターがつかえません。そのときは「カメラでとる」をつかってください。
          </p>

          <div className="scan-actions">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="file-input"
              aria-label="カメラで撮影"
              onChange={onFileFromInput}
            />
            <button
              type="button"
              className="btn btn-primary btn-xl btn-block"
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 カメラでとる
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-xl btn-block"
              onClick={() => setCameraModalOpen(true)}
            >
              がめんうえでシャッター
            </button>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="file-input"
              aria-label="アルバムやファイルから選ぶ"
              onChange={onFileFromInput}
            />
            <button
              type="button"
              className="btn btn-secondary btn-xl btn-block"
              onClick={() => galleryInputRef.current?.click()}
            >
              アルバム／ファイルからえらぶ
            </button>
          </div>

          <p className="status">{uploadStatus}</p>
          {draftExerciseId && pageCount > 0 && (
            <div className="scan-page-strip" aria-label="あっぷろーどしたページ">
              <p className="muted scan-page-count">
                {pageCount}{" "}
                まいのページ（つづきのページがあれば、もういちど「カメラ」や「アルバム」からついかできます）
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
                      aria-label={`ページ ${i + 1} を削除`}
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
            <h2>ステップ2: AIでよみとる</h2>
            <p className="status">{parseStatus}</p>
            <button type="button" className="btn btn-primary btn-xl" onClick={onParse} disabled={!draftExerciseId}>
              {pageCount > 1
                ? `${pageCount}ページをページごとによみとってまとめて よみとる（Gemini）`
                : "よみとる（Gemini）"}
            </button>
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
