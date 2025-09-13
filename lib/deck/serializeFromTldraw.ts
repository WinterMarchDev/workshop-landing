import { Editor, TLShape } from 'tldraw'

export type DeckExport = {
  width: number;     // canvas pixel width
  height: number;    // canvas pixel height
  slides: SlideExport[];
}

export type SlideExport = {
  index: number;
  shapes: ShapeExport[];
  background?: { color?: string; imageUrl?: string };
}

type Base = {
  id: string;
  kind: 'text' | 'image' | 'rect' | 'line';
  x: number; y: number; w: number; h: number; rotation?: number; z: number;
}

export type TextShapeExp = Base & {
  kind: 'text';
  text: string;
  fontSize: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export type ImageShapeExp = Base & {
  kind: 'image';
  url: string;
}

export type RectShapeExp = Base & {
  kind: 'rect';
  rx?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type LineShapeExp = Base & {
  kind: 'line';
  x2: number; y2: number;
  stroke?: string; strokeWidth?: number;
}

export type ShapeExport = TextShapeExp | ImageShapeExp | RectShapeExp | LineShapeExp;

const SIZE_MAP: Record<string, number> = { s: 16, m: 22, l: 28, xl: 36, xxl: 48 };

export function serializeFromTldraw(editor: Editor, slidePx = { w: 1920, h: 1080 }): DeckExport {
  const pageId = editor.getCurrentPageId();
  const shapeIds = editor.getSortedChildIdsForParent(pageId); // z-ordered
  const shapes: ShapeExport[] = [];

  for (const id of shapeIds) {
    const sh = editor.getShape(id) as TLShape | undefined;
    if (!sh) continue;
    const { x, y } = sh;
    const w = (sh as any).props?.w ?? (editor.getShapePageBounds(sh)?.w ?? 0);
    const h = (sh as any).props?.h ?? (editor.getShapePageBounds(sh)?.h ?? 0);
    const z = parseInt((sh.index as string).replace(/\D/g, ''), 10) || 0;
    const rotation = (sh as any).rotation ?? 0;

    switch (sh.type) {
      case 'text': {
        const p = (sh as any).props ?? {};
        const fontSize = typeof p.fontSize === 'number' ? p.fontSize : SIZE_MAP[p.size] ?? 22;
        shapes.push({
          id: sh.id, kind: 'text', x, y, w, h, z, rotation,
          text: p.text ?? '',
          fontSize,
          fontFamily: p.font ?? 'Calibri',
          bold: !!p.fontStyle?.includes?.('bold'),
          italic: !!p.fontStyle?.includes?.('italic'),
          align: p.align ?? 'left',
          color: cssVarToHex(editor, p.color) ?? '#0B1220',
        } as TextShapeExp);
        break;
      }
      case 'image': {
        const p = (sh as any).props ?? {};
        shapes.push({
          id: sh.id, kind: 'image', x, y, w, h, z, rotation,
          url: p.url,
        } as ImageShapeExp);
        break;
      }
      case 'geo': {
        const p = (sh as any).props ?? {};
        // treat rect-like geos as rectangles
        shapes.push({
          id: sh.id, kind: 'rect', x, y, w, h, z, rotation,
          rx: p.radius ?? (p.geo === 'rounded-rectangle' ? 12 : 0),
          fill: cssVarToHex(editor, p.fill ?? p.color) ?? '#FFFFFF',
          stroke: cssVarToHex(editor, p.stroke ?? p.color) ?? '#111111',
          strokeWidth: typeof p.strokeWidth === 'number' ? p.strokeWidth : 2,
        } as RectShapeExp);
        break;
      }
      case 'line': {
        const p = (sh as any).props ?? {};
        shapes.push({
          id: sh.id, kind: 'line', x, y, w, h, z, rotation,
          x2: x + w, y2: y + h,
          stroke: cssVarToHex(editor, p.color) ?? '#111111',
          strokeWidth: typeof p.strokeWidth === 'number' ? p.strokeWidth : 2,
        } as LineShapeExp);
        break;
      }
      default:
        // ignore draw, frame, groups for export v1
        break;
    }
  }

  return {
    width: slidePx.w,
    height: slidePx.h,
    slides: [{ index: 0, shapes: shapes.sort((a, b) => a.z - b.z) }],
  };
}

// best-effort: resolve tailwind CSS vars your theme might use to hex
function cssVarToHex(_editor: Editor, v: any): string | undefined {
  if (!v || typeof v !== 'string') return undefined;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  // add mapping if you use --wm-* variables
  const MAP: Record<string, string> = {
    'var(--wm-ink)': '#0B1220',
    'var(--wm-ice)': '#EDF1F4',
    'black': '#000000',
    'white': '#FFFFFF',
  };
  return MAP[v];
}