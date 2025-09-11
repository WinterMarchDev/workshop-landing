// app/slides/[slug]/page.tsx
"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import { Room } from "../../Room";

import { Tldraw, Editor as TLEditor, createShapeId, TLShapeId } from "tldraw";
import "tldraw/tldraw.css";

import * as Y from "yjs";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

// TipTap for notes
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const roomId = useMemo(() => `wm:slides:${slug}`, [slug]);
  return (
    <Room roomId={roomId}>
      <SlidesWithNotes />
    </Room>
  );
}

function SlidesWithNotes() {
  const room = useRoom();
  const [editor, setEditor] = useState<TLEditor | null>(null);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);

  // Track selection for notes
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      const sel = editor.getSelectedShapes();
      let frameId: string | null = null;

      if (sel.length) {
        const frame = sel.find((s) => s.type === "frame");
        if (frame) {
          frameId = frame.id;
        } else {
          const pId = sel[0].parentId;
          if (pId) {
            const p = editor.getShape(pId);
            if (p && p.type === "frame") frameId = p.id;
          }
        }
      }

      setCurrentFrameId(frameId);
    };

    editor.on("change", handler);
    handler(); // set initial state

    return () => {
      editor.off("change", handler);
    };
  }, [editor]);

  // Sync tldraw with Yjs for persistence
  useEffect(() => {
    if (!editor || !room) return;
    const yProvider = getYjsProviderForRoom(room);
    const ydoc = yProvider.getYDoc();
    const yMap = ydoc.getMap<any>("tldraw");

    // Lazy import to avoid ESM issues
    const { getSnapshot, loadSnapshot } = require("tldraw");

    const applyFromY = () => {
      const snap = yMap.get("document");
      if (snap) loadSnapshot(editor.store, snap);
    };
    yMap.observeDeep(applyFromY);

    const unsub = editor.store.listen(
      () => {
        const { document } = getSnapshot(editor.store);
        yMap.set("document", document);
      },
      { source: "user" }
    );

    return () => {
      unsub();
      yMap.unobserveDeep(applyFromY);
    };
  }, [editor, room]);

  const runMigrationOnce = useCallback((e: TLEditor) => {
    const slug = window.location.pathname.split('/').pop();
    if (slug === 'vendor-advance') {
      // Check if deck is empty (only has default content)
      const shapes = e.getCurrentPageShapes();
      if (shapes.length === 0) {
        // Fetch and parse the static HTML to seed the deck
        fetch('/vendor-advance-slides.html')
          .then(r => r.text())
          .then(html => {
            // Parse HTML and create tldraw shapes
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const slides = doc.querySelectorAll('.slide');
            
            slides.forEach((slide, index) => {
              // Create a frame for each slide
              const frameId: TLShapeId = createShapeId(`frame_${index}_${Date.now()}`);
              e.createShapes([{
                id: frameId,
                type: 'frame',
                x: index * 1200,
                y: 0,
                props: {
                  w: 1100,
                  h: 700,
                  name: `Slide ${index + 1}`,
                },
              }]);
              
              // Extract and add text content from the slide
              const textElements = slide.querySelectorAll('h1, h2, h3, p, li');
              let yOffset = 50;
              
              textElements.forEach((elem, elemIndex) => {
                const text = elem.textContent?.trim();
                if (text) {
                  e.createShapes([{
                    id: createShapeId(`text_${index}_${elemIndex}_${Date.now()}`),
                    type: 'text',
                    x: (index * 1200) + 50,
                    y: yOffset,
                    parentId: frameId,
                    props: {
                      text,
                      size: elem.tagName === 'H1' ? 'xl' : 
                            elem.tagName === 'H2' ? 'l' : 
                            elem.tagName === 'H3' ? 'm' : 's',
                      w: 1000,
                    },
                  }]);
                  yOffset += elem.tagName.startsWith('H') ? 80 : 40;
                }
              });
            });
            
            // Center view on first slide
            e.zoomToFit();
          })
          .catch(err => {
            console.error('Failed to seed deck from HTML:', err);
          });
      }
    }
  }, []);

  const handleMount = useCallback((e: TLEditor) => {
    setEditor(e);
    runMigrationOnce(e);
  }, [runMigrationOnce]);

  return (
    <div className="grid grid-rows-[1fr_auto] h-screen">
      <Tldraw onMount={handleMount} />
      <div className="border-t bg-white">
        <NotesPanel frameId={currentFrameId} />
      </div>
    </div>
  );
}

function NotesPanel({ frameId }: { frameId: string | null }) {
  const field = frameId ? `notes:${frameId}` : null;
  const liveblocksExt = useLiveblocksExtension(
    field ? { field, initialContent: "<p>Presenter notes…</p>" } : undefined
  );

  const editor = useEditor(
    field
      ? {
          extensions: [
            Document,
            Paragraph,
            Text,
            StarterKit.configure({ document: false, paragraph: false, text: false }),
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Placeholder.configure({ placeholder: "Presenter notes…" }),
            liveblocksExt!,
          ],
          editorProps: { attributes: { class: "prose max-w-none p-4 outline-none" } },
        }
      : undefined
  );

  if (!frameId) {
    return (
      <div className="p-4 text-sm text-gray-600">
        Select a slide to edit its presenter notes. Notes sync in real time.
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="px-4 pt-3 text-xs text-gray-500">Notes for {frameId}</div>
      <EditorContent editor={editor!} />
    </div>
  );
}