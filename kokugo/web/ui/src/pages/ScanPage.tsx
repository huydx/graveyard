import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addExercisePage, getExercise, parseExercise, uploadScan } from "../api/client";
import CameraModal from "../components/CameraModal";
import { useDraftExercise } from "../context/DraftExerciseContext";

export default function ScanPage() {
  const navigate = useNavigate();
  const { draftExerciseId, setDraftExerciseId } = useDraftExercise();
  const [uploadStatus, setUploadStatus] = useState("");
  const [parseStatus, setParseStatus] = useState("");
  const [showParse, setShowParse] = useState(!!draftExerciseId);
  const [pageCount, setPageCount] = useState(0);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = async (f: File) => {
    setUploadStatus("あっぷろーどちゅう…");
    try {
      if (draftExerciseId) {
        const data = await addExercisePage(draftExerciseId, f);
        setPageCount(data.imagePaths?.length ?? pageCount + 1);
      } else {
        const data = await uploadScan(f);
        setDraftExerciseId(data.exerciseId);
        setPageCount(data.imagePaths?.length ?? 1);
      }
      setUploadStatus("あっぷろーどOK！");
      setShowParse(true);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "エラー");
    }
  };

  const onFileFromInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await uploadFile(f);
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
            タブレットでは「カメラでとる」がおすすめ。PCでは「がめんうえでシャッター」かファイルをえらぶ。Tailscale
            のアドレスだけ（https ではない）でつないでいるとき、ブラウザによってはシャッターがつかえません。そのときは「カメラでとる」をつかってください。
          </p>

          <div className="scan-actions">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
                  <img
                    key={`${draftExerciseId}-${i}`}
                    src={`/api/exercises/${encodeURIComponent(draftExerciseId)}/image/${i}`}
                    alt={`ページ ${i + 1}`}
                    className="scan-thumb"
                  />
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
              {pageCount > 1 ? `${pageCount}ページをまとめて` : ""}よみとる（Gemini）
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
