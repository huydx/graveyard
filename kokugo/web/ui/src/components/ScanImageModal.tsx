import { useEffect } from "react";

type Props = {
  exerciseId: string;
  pageIndex: number;
  totalPages: number;
  onClose: () => void;
  onChangePage: (index: number) => void;
};

export default function ScanImageModal({
  exerciseId,
  pageIndex,
  totalPages,
  onClose,
  onChangePage,
}: Props) {
  const src = `/api/exercises/${encodeURIComponent(exerciseId)}/image/${pageIndex}`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowLeft" && pageIndex > 0) {
        e.preventDefault();
        onChangePage(pageIndex - 1);
      }
      if (e.key === "ArrowRight" && pageIndex < totalPages - 1) {
        e.preventDefault();
        onChangePage(pageIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageIndex, totalPages, onClose, onChangePage]);

  return (
    <div
      className="scan-image-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`スキャン ページ ${pageIndex + 1}`}
      onClick={onClose}
    >
      <div className="scan-image-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scan-image-modal-head">
          <span className="scan-image-modal-title">
            ページ {pageIndex + 1}
            {totalPages > 1 ? ` / ${totalPages}` : ""}
          </span>
          <button type="button" className="btn btn-ghost scan-image-modal-close" onClick={onClose}>
            とじる
          </button>
        </div>
        <div className="scan-image-modal-body">
          {totalPages > 1 && (
            <button
              type="button"
              className="scan-image-modal-nav scan-image-modal-nav-prev"
              aria-label="まえのページ"
              disabled={pageIndex <= 0}
              onClick={() => onChangePage(pageIndex - 1)}
            >
              ‹
            </button>
          )}
          <img
            key={pageIndex}
            src={src}
            alt={`プリント ページ ${pageIndex + 1}`}
            className="scan-image-modal-img"
          />
          {totalPages > 1 && (
            <button
              type="button"
              className="scan-image-modal-nav scan-image-modal-nav-next"
              aria-label="つぎのページ"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => onChangePage(pageIndex + 1)}
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
