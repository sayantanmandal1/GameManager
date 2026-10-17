import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
export const MAX_SAVE_BASE64_LENGTH = 16_000_000;

export interface SaveFileRequest {
  filename: string;
  mimeType: string;
  base64: string;
}

/** Validates a `save-file` message posted by the trusted GameVerse web origin. */
export function parseSaveFileRequest(value: unknown): SaveFileRequest | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SaveFileRequest>;
  if (
    typeof candidate.filename !== 'string' ||
    candidate.filename.length === 0 ||
    candidate.filename.length > 120 ||
    typeof candidate.mimeType !== 'string' ||
    !(candidate.mimeType in EXTENSIONS) ||
    typeof candidate.base64 !== 'string' ||
    candidate.base64.length === 0 ||
    candidate.base64.length > MAX_SAVE_BASE64_LENGTH ||
    candidate.base64.length % 4 !== 0 ||
    !BASE64_PATTERN.test(candidate.base64)
  ) {
    return null;
  }
  return { filename: candidate.filename, mimeType: candidate.mimeType, base64: candidate.base64 };
}

/**
 * Android WebView cannot download in-page data:/blob: URLs, so the web app
 * hands generated files to the native shell, which opens the system share
 * sheet (save to Files, Photos, Drive, or send to a friend).
 */
export async function shareGeneratedFile(request: SaveFileRequest): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const extension = EXTENSIONS[request.mimeType];
  const stem = request.filename
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'gameverse';
  const file = new File(Paths.cache, `${stem}.${extension}`);
  if (file.exists) file.delete();
  file.create();
  file.write(request.base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: request.mimeType,
    dialogTitle: 'Save or share',
  });
}
