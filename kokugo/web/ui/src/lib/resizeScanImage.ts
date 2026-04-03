/** localStorage key for max long-edge (px); "0" = no resize */
export const SCAN_CAPTURE_MAX_LONG_EDGE_KEY = "kokugo-scan-max-long-edge";

const DEFAULT_MAX_LONG_EDGE = 1024;

export const SCAN_CAPTURE_SIZE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 2048, label: "長いほう 最大 2048px" },
  { value: 1024, label: "長いほう 最大 1024px" },
  { value: 512, label: "長いほう 最大 512px" },
  { value: 0, label: "そのまま（しょうさいどおり）" },
];

export function readStoredMaxLongEdge(): number {
  try {
    const raw = localStorage.getItem(SCAN_CAPTURE_MAX_LONG_EDGE_KEY);
    if (raw == null) return DEFAULT_MAX_LONG_EDGE;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_LONG_EDGE;
    const allowed = new Set(SCAN_CAPTURE_SIZE_OPTIONS.map((o) => o.value));
    return allowed.has(n) ? n : DEFAULT_MAX_LONG_EDGE;
  } catch {
    return DEFAULT_MAX_LONG_EDGE;
  }
}

export function writeStoredMaxLongEdge(n: number): void {
  try {
    localStorage.setItem(SCAN_CAPTURE_MAX_LONG_EDGE_KEY, String(n));
  } catch {
    /* private mode / quota */
  }
}

export function scaleToMaxLongEdge(width: number, height: number, maxLongEdge: number): { width: number; height: number } {
  if (maxLongEdge <= 0) return { width, height };
  const long = Math.max(width, height);
  if (long <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const JPEG_QUALITY = 0.92;

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("画像をよみこめませんでした"));
        img.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Client-side resize before upload; `maxLongEdge <= 0` leaves the file unchanged. */
export async function resizeImageFile(file: File, maxLongEdge: number): Promise<File> {
  if (maxLongEdge <= 0 || !file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodeToBitmap(file);
    const { width: sw, height: sh } = bitmap;
    const { width: dw, height: dh } = scaleToMaxLongEdge(sw, sh, maxLongEdge);
    if (dw === sw && dh === sh) return file;

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, sw, sh, 0, 0, dw, dh);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "scan";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
