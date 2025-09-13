import { Editor } from 'tldraw'
import { DeckExport } from './serializeFromTldraw'

type ShapePatch = { 
  id: string; 
  props: Partial<{ 
    x: number; 
    y: number; 
    w: number; 
    h: number; 
    rotation: number; 
    fontSize: number; 
    align: 'left' | 'center' | 'right'; 
    color: string; 
    rx: number;
  }> 
}

type BeautifyResponse = { patches: ShapePatch[] }

export async function beautifyDeck(editor: Editor, deck: DeckExport) {
  const res = await fetch('/api/beautify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deck),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as BeautifyResponse;

  editor.batch(() => {
    for (const p of data.patches) {
      const sh = editor.getShape(p.id);
      if (!sh) continue;
      const next = structuredClone(sh) as any;
      // map generic patches onto either root or props as appropriate
      for (const [k, v] of Object.entries(p.props)) {
        if (k === 'x' || k === 'y' || k === 'rotation') {
          (next as any)[k] = v;
        } else if (k === 'w' || k === 'h' || k === 'rx' || k === 'fontSize' || k === 'align' || k === 'color') {
          next.props = { ...next.props, [k]: v };
        }
      }
      editor.updateShapes([next]);
    }
  });
}