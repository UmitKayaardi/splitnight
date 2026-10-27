/**
 * Prepares a receipt photo in the browser before upload: applies the camera's orientation,
 * scales the long edge down to ~1600 px and re-encodes as JPEG. Re-encoding through a
 * canvas also drops all EXIF metadata, including GPS location.
 */
import { ClientApiError } from './api';

export const MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3.8 * 1024 * 1024;

export function isAcceptedImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
      'image/jpeg',
      quality,
    ),
  );
}

export async function prepareReceiptImage(file: File): Promise<Blob> {
  if (!isAcceptedImage(file)) throw new ClientApiError('UNSUPPORTED_TYPE');
  if (file.size > MAX_INPUT_BYTES) throw new ClientApiError('TOO_LARGE');

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new ClientApiError('UNSUPPORTED_TYPE');
  }
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const size = scaledSize(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ClientApiError('UNSUPPORTED_TYPE');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, 0, 0, size.width, size.height);
  if ('close' in source) source.close();

  let blob = await toBlob(canvas, 0.8);
  if (blob.size > MAX_OUTPUT_BYTES) blob = await toBlob(canvas, 0.6);
  if (blob.size > MAX_OUTPUT_BYTES) throw new ClientApiError('TOO_LARGE');
  return blob;
}
