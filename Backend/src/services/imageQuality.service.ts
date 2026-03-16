import sharp from "sharp";

const BLUR_STDEV_THRESHOLD = 15; // Laplacian stdev below this = blurry
const GLARE_BRIGHT_RATIO = 0.12; // More than 12% pixels very bright = glare
const GLARE_BRIGHT = 250; // Pixel value threshold for "glare"
const MAX_EDGE = 500; // Resize to max 500px for speed

export interface ImageQualityResult {
  ok: boolean;
  hints: string[];
}

/**
 * Pre-upload image quality check: blur and glare.
 * Used for documents and receipts to reduce failed OCR/upload.
 */
export async function checkImageQuality(
  buffer: Buffer,
  mimeType: string,
): Promise<ImageQualityResult> {
  const hints: string[] = [];
  const supported = /^image\/(jpeg|jpg|png|webp)$/i.test(mimeType || "");
  if (!supported) {
    return { ok: true, hints: [] };
  }

  try {
    let meta: { width: number; height: number } | null = null;
    const pipeline = sharp(buffer);
    meta = await pipeline.metadata().then((m) =>
      m.width && m.height ? { width: m.width, height: m.height } : null,
    );
    if (!meta) return { ok: true, hints: [] };

    const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
    const w = Math.round(meta.width * scale);
    const h = Math.round(meta.height * scale);

    // Blur: Laplacian variance (convolve then stdev). Low = blurry.
    const lap = await sharp(buffer)
      .resize(w, h, { fit: "inside" })
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const stdev = pixelStdev(lap.data);
    if (stdev < BLUR_STDEV_THRESHOLD && stdev >= 0) {
      hints.push("Image is blurry. Retake in better light and hold the camera steady.");
    }

    // Glare: count very bright pixels in grayscale
    const gray = await sharp(buffer)
      .resize(w, h, { fit: "inside" })
      .grayscale()
      .raw()
      .toBuffer();
    const brightCount = countPixelsAbove(gray, GLARE_BRIGHT);
    const ratio = brightCount / gray.length;
    if (ratio > GLARE_BRIGHT_RATIO) {
      hints.push("Too much glare. Avoid direct light on the document and retake.");
    }

    return {
      ok: hints.length === 0,
      hints,
    };
  } catch (err: any) {
    console.warn("Image quality check failed:", err?.message);
    return { ok: true, hints: [] };
  }
}

function pixelStdev(data: Buffer): number {
  if (data.length === 0) return 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    sum += v;
    sumSq += v * v;
  }
  const n = data.length;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return variance > 0 ? Math.sqrt(variance) : 0;
}

function countPixelsAbove(data: Buffer, threshold: number): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= threshold) count++;
  }
  return count;
}
