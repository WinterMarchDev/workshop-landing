export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import PptxGenJS from 'pptxgenjs';

type ReqDeck = import('@/lib/deck/serializeFromTldraw').DeckExport;
type ShapeExport = import('@/lib/deck/serializeFromTldraw').ShapeExport;

const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

function pxToIn(px: number, deckW: number, deckH: number, axis: 'x'|'y'|'w'|'h'): number {
  return axis === 'x' || axis === 'w'
    ? (px / deckW) * SLIDE_W_IN
    : (px / deckH) * SLIDE_H_IN;
}

export async function POST(req: NextRequest) {
  try {
    const deck = (await req.json()) as ReqDeck;
    if (!deck?.slides?.length) return new Response('Empty deck', { status: 400 });

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'WM169', width: SLIDE_W_IN, height: SLIDE_H_IN });
    pptx.layout = 'WM169';

    const [slide0] = deck.slides;

    const slide = pptx.addSlide();

    // draw in z-order
    const sorted = [...slide0.shapes].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    for (const s of sorted) {
      await addShape(slide, s, deck.width, deck.height);
    }

    const buf = await pptx.write('nodebuffer');
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="deck.pptx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(`Export error: ${e.message ?? e}`, { status: 500 });
  }
}

async function addShape(slide: PptxGenJS.Slide, s: ShapeExport, deckW: number, deckH: number) {
  const x = pxToIn(s.x, deckW, deckH, 'x');
  const y = pxToIn(s.y, deckW, deckH, 'y');
  const w = pxToIn(s.w, deckW, deckH, 'w');
  const h = pxToIn(s.h, deckW, deckH, 'h');
  const rotate = (s as any).rotation ? ((s as any).rotation * 180) / Math.PI : 0; // rad→deg if you store radians

  const pptx = (slide as any)._slideLayout?._presLayout?._pptx || new PptxGenJS();

  if (s.kind === 'text') {
    slide.addText((s as any).text ?? '', {
      x, y, w, h, rotate,
      fontFace: (s as any).fontFamily ?? 'Calibri',
      fontSize: (s as any).fontSize ?? 22,
      bold: !!(s as any).bold,
      italic: !!(s as any).italic,
      align: (s as any).align ?? 'left',
      color: (s as any).color ?? '000000',
      valign: 'middle',
      // shrink text to fit box if AI made it tight
      fit: 'shrink',
    });
    return;
  }

  if (s.kind === 'rect') {
    const rx = (s as any).rx ?? 0;
    const hasRadius = rx > 1;
    slide.addShape(hasRadius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
      x, y, w, h, rotate,
      fill: { color: hex((s as any).fill, 'FFFFFF') },
      line: { color: hex((s as any).stroke, '111111'), width: (s as any).strokeWidth ?? 1 },
      rectRadius: hasRadius ? Math.min(0.49, rx / Math.max(s.w, s.h)) : undefined,
    } as any);
    return;
  }

  if (s.kind === 'line') {
    slide.addShape(pptx.ShapeType.line, {
      x, y, w, h, rotate,
      line: { color: hex((s as any).stroke, '111111'), width: (s as any).strokeWidth ?? 2 },
    });
    return;
  }

  if (s.kind === 'image') {
    const url = (s as any).url as string;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const arr = await resp.arrayBuffer();
        const b64 = Buffer.from(arr).toString('base64');
        const dataUri = `data:image/${inferExt(url)};base64,${b64}`;
        slide.addImage({ data: dataUri, x, y, w, h, rotate });
      }
    } catch {
      // ignore fetch failure, keep going
    }
  }
}

function inferExt(url: string): 'png' | 'jpeg' {
  return /\.jpe?g$/i.test(url) ? 'jpeg' : 'png';
}

function hex(v: string | undefined, fallback: string): string {
  if (!v) return fallback;
  if (v.startsWith('#')) return v.slice(1);
  return v.replace('#', '') || fallback;
}