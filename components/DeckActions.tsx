'use client';

import { useState } from 'react';
import { useEditor } from 'tldraw';
import { serializeFromTldraw } from '@/lib/deck/serializeFromTldraw';
import { beautifyDeck } from '@/lib/deck/applyBeautify';

export default function DeckActions() {
  const editor = useEditor();
  const [busy, setBusy] = useState<'beautify' | 'export' | null>(null);

  async function onBeautify() {
    setBusy('beautify');
    try {
      const deck = serializeFromTldraw(editor);
      await beautifyDeck(editor, deck);
    } catch (e) {
      alert(`Beautify failed: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  async function onExport() {
    setBusy('export');
    try {
      // serialize after beautify is applied
      const deck = serializeFromTldraw(editor);
      const res = await fetch('/api/pptx/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'deck.pptx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBeautify}
        disabled={busy !== null}
        className="rounded-xl px-4 py-2 bg-black text-white hover:bg-black/80 disabled:opacity-50"
      >
        {busy === 'beautify' ? 'Beautifying…' : 'AI Beautify'}
      </button>
      <button
        onClick={onExport}
        disabled={busy !== null}
        className="rounded-xl px-4 py-2 bg-black text-white hover:bg-black/80 disabled:opacity-50"
      >
        {busy === 'export' ? 'Exporting…' : 'Export .pptx'}
      </button>
    </div>
  );
}