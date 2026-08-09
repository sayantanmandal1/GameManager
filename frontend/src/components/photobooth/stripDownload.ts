import type {
  PhotoboothSlot,
  PhotoboothLayout,
  PhotoboothThemeId,
  PhotoboothFilter,
} from '@/shared';
import { LAYOUT_META, FILTER_STYLES, THEME_DOWNLOAD } from './themes';

export interface ComposeArgs {
  slots: PhotoboothSlot[];
  layout: PhotoboothLayout;
  theme: PhotoboothThemeId;
  filter: PhotoboothFilter;
  hostName: string;
  guestName: string;
}

const HALF = 320;
const HALF_GAP = 6;
const GAP = 14;
const PAD = 22;
const BOTTOM = 76;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/**
 * Bake the finished strip onto a canvas. Photos are same-origin data URLs so
 * the canvas is never tainted and `toDataURL` is safe. Returns the canvas so
 * callers can export a lossless PNG or embed a JPEG into a PDF.
 */
export async function composeStrip(
  args: ComposeArgs,
): Promise<HTMLCanvasElement | null> {
  const { slots, layout, theme, filter, hostName, guestName } = args;
  const meta = LAYOUT_META[layout];
  const { cols, rows } = meta;

  const slotW = 2 * HALF + HALF_GAP;
  const slotH = HALF;
  const innerW = cols * slotW + (cols - 1) * GAP;
  const innerH = rows * slotH + (rows - 1) * GAP;
  const W = innerW + 2 * PAD;
  const H = innerH + 2 * PAD + BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Frame background (two-stop vertical gradient approximating the theme).
  const dl = THEME_DOWNLOAD[theme];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, dl.from);
  grad.addColorStop(1, dl.to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const filterCss = FILTER_STYLES[filter].css;

  for (let i = 0; i < slots.length; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x0 = PAD + col * (slotW + GAP);
    const y0 = PAD + row * (slotH + GAP);

    const halves: Array<[string | null, number]> = [
      [slots[i]?.left ?? null, x0],
      [slots[i]?.right ?? null, x0 + HALF + HALF_GAP],
    ];

    for (const [src, x] of halves) {
      // Photo bed (so gaps read cleanly even before/without an image).
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y0, HALF, HALF);

      if (src) {
        const img = await loadImage(src);
        if (img) {
          ctx.filter = filterCss === 'none' ? 'none' : filterCss;
          ctx.drawImage(img, x, y0, HALF, HALF);
          ctx.filter = 'none';
        }
      }
    }
  }

  // Date stamp + watermark.
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(BOTTOM * 0.3)}px "Courier New", monospace`;
  ctx.fillText(today(), W / 2, H - BOTTOM * 0.62);
  ctx.font = `400 ${Math.round(BOTTOM * 0.22)}px "Courier New", monospace`;
  ctx.fillText(`${hostName} & ${guestName}`, W / 2, H - BOTTOM * 0.24);

  return canvas;
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Compose and download the strip as a lossless PNG. */
export async function downloadStripPng(args: ComposeArgs): Promise<boolean> {
  const canvas = await composeStrip(args);
  if (!canvas) return false;
  triggerDownload(canvas.toDataURL('image/png'), `photobooth-${Date.now()}.png`);
  return true;
}

/**
 * Compose and download the strip as a single-page PDF. The JPEG is embedded
 * directly as a DCTDecode image XObject — no third-party library needed.
 */
export async function downloadStripPdf(args: ComposeArgs): Promise<boolean> {
  const canvas = await composeStrip(args);
  if (!canvas) return false;
  const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = jpegUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const jpeg = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) jpeg[i] = bin.charCodeAt(i);

  const blob = jpegToPdf(jpeg, canvas.width, canvas.height);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `photobooth-${Date.now()}.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

/**
 * Build a minimal, valid single-image PDF (PDF 1.3) with the JPEG embedded as a
 * DCTDecode XObject. Byte offsets for the xref table are tracked exactly.
 */
function jpegToPdf(jpeg: Uint8Array, w: number, h: number): Blob {
  const parts: Array<string | Uint8Array> = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (chunk: string | Uint8Array) => {
    parts.push(chunk);
    length += chunk.length;
  };
  const startObject = () => offsets.push(length);

  push('%PDF-1.3\n');

  startObject();
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObject();
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  startObject();
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  startObject();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push('\nendstream\nendobj\n');

  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  startObject();
  push(
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`,
  );

  const xrefStart = length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const chunk of parts) {
    if (typeof chunk === 'string') {
      for (let i = 0; i < chunk.length; i += 1) {
        out[pos] = chunk.charCodeAt(i) & 0xff;
        pos += 1;
      }
    } else {
      out.set(chunk, pos);
      pos += chunk.length;
    }
  }
  return new Blob([out], { type: 'application/pdf' });
}
