// app/slides/[slug]/page.tsx
"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import { Room } from "../../Room";

import { Tldraw, Editor as TLEditor, createShapeId, TLShapeId, toRichText } from "tldraw";
import "tldraw/tldraw.css";
import { toPng } from "html-to-image";
import DeckActions from "@/components/DeckActions";

import * as Y from "yjs";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

// TipTap for notes
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";

// Collect text from current slide frame
function collectSlideText(editor: TLEditor, frameId: TLShapeId) {
  const kids = editor.getSortedChildIdsForParent(frameId);
  const lines: string[] = [];
  for (const id of kids) {
    const s = editor.getShape(id);
    if (!s) continue;
    // text shapes and geo with richText
    // @ts-expect-error access props compat
    const rt = s.props?.richText;
    if (rt?.spans) {
      const t = rt.spans.map((sp: any) => sp.text ?? "").join("");
      if (t.trim()) lines.push(t.trim());
    }
  }
  return lines.join("\n");
}

// Beautify slide with AI
async function beautifyWithAI(editor: TLEditor, frameId: TLShapeId) {
  const source = collectSlideText(editor, frameId);
  const res = await fetch("/api/ai/slide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: source,
      theme: {
        palette: { bgLight: "#EDF1F4", text: "#0B1F2E", accent: "#6B849D" },
        fontScale: { title: 56, subtitle: 36, body: 28, callout: 30 }
      }
    })
  });
  if (!res.ok) throw new Error("AI layout failed");
  const layout = await res.json();

  // remove everything - give AI complete freedom to redesign
  const children = editor.getSortedChildIdsForParent(frameId);
  if (children.length > 0) {
    editor.deleteShapes(children);
  }

  const pad = 24;
  const addText = (x: number, y: number, w: number, h: number, text: string, size: "s"|"m"|"l"|"xl" = "m", align: "start"|"middle"|"end" = "start") => {
    editor.createShapes([{
      id: createShapeId(`txt_${Date.now()}`),
      type: "text",
      x, y, parentId: frameId,
      props: {
        w: Math.max(80, w - pad * 2),
        autoSize: false,
        size,
        font: "sans",
        color: "black",
        textAlign: align,
        richText: toRichText(text)
      }
    }]);
  };

  for (const el of layout.elements ?? []) {
    if (el.type === "title") addText(el.x, el.y, el.w, el.h, el.text, "xl", "start");
    if (el.type === "subtitle") addText(el.x, el.y, el.w, el.h, el.text, "l", "start");
    if (el.type === "callout") addText(el.x, el.y, el.w, el.h, el.text, "m", "start");
    if (el.type === "bullets") addText(el.x, el.y, el.w, el.h, "• " + el.items.join("\n• "), "m", "start");
  }
}

// Camera helper to fit view to frame
function fitCameraToFrame(editor: TLEditor, frameId: TLShapeId, inset = 96, leaveForNotes = 180) {
  const b = editor.getShapePageBounds(frameId);
  if (!b) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight - leaveForNotes; // leave space for notes bar
  const z = Math.min((vw - inset * 2) / b.w, (vh - inset * 2) / b.h);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  editor.setCamera({ x: cx - vw / (2 * z), y: cy - vh / (2 * z), z });
}

// Helper to create high-DPI background image for slide
async function putRasterBackground(
  editor: TLEditor,
  html: string,
  frameId: TLShapeId,
  x: number,
  y: number,
  W = 1920,
  H = 1080
) {
  const staging = document.createElement("div");
  Object.assign(staging.style, {
    position: "fixed", left: "-99999px", top: "-99999px",
    width: `${W}px`, height: `${H}px`, background: "white"
  });
  staging.innerHTML = html;
  document.body.appendChild(staging);
  
  try {
    const dataUrl = await toPng(staging, { cacheBust: true, pixelRatio: 2 });
    document.body.removeChild(staging);

    // upload to Supabase to avoid giant base64 in the doc
    const r = await fetch("/api/slides/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl,
        key: `vendor-advance/slide-${Date.now()}-${Math.random()
          .toString(36).slice(2)}.png`,
      }),
    });
    
    if (!r.ok) {
      const msg = await r.text().catch(() => String(r.status));
      throw new Error(`Upload failed: ${r.status} ${msg}`);
    }
    
    const { url } = await r.json();
    if (!url) throw new Error("Upload returned no URL");

    editor.createShapes([{
      id: createShapeId(`bg_${crypto.randomUUID()}`),
      type: "image",
      x, y, parentId: frameId,
      props: { w: W, h: H, url },
    }]);
  } catch (err) {
    console.error('Failed to rasterize slide:', err);
    if (staging.parentNode) document.body.removeChild(staging);
    throw err; // Re-throw so migration can handle it
  }
}

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
  const [showImportButton, setShowImportButton] = useState(false);

  // Track selection for notes and camera
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      const sel = editor.getSelectedShapes();
      let frameId: TLShapeId | null = null;
      
      if (sel.length) {
        const frame = sel.find((s) => s.type === "frame");
        if (frame) {
          frameId = frame.id as TLShapeId;
        } else {
          const pId = sel[0].parentId;
          if (pId) {
            const p = editor.getShape(pId);
            if (p && p.type === "frame") frameId = p.id as TLShapeId;
          }
        }
      }
      
      if (frameId) {
        setCurrentFrameId(frameId);
        // Don't fit camera on every change - only on explicit navigation
      }
    };

    editor.on("change", handler);

    // If we already have frames, center the first one at mount
    const frames = editor.getCurrentPageShapes().filter((s) => s.type === "frame");
    if (frames.length && !currentFrameId) {
      const first = frames.sort((a, b) => ((a.y as number) - (b.y as number)) || ((a.x as number) - (b.x as number)))[0];
      editor.select(first.id);
      setCurrentFrameId(first.id as TLShapeId);
      fitCameraToFrame(editor, first.id as TLShapeId);
    }

    return () => {
      editor.off("change", handler);
    };
  }, [editor, currentFrameId]);

  // Sync tldraw with Yjs for persistence
  useEffect(() => {
    if (!editor || !room) return;
    const yProvider = getYjsProviderForRoom(room);
    const ydoc = yProvider.getYDoc();
    const yMap = ydoc.getMap<any>("tldraw");

    let syncing = true;       // true while migration runs
    let raf = 0;
    let unsub: (() => void) | null = null;
    let unobserve: (() => void) | null = null;

    (async () => {
      const { getSnapshot, loadSnapshot } = await import("tldraw");

      const applyFromY = () => {
        if (syncing) return;
        const snap = yMap.get("document");
        if (snap) loadSnapshot(editor.store, snap);
      };
      yMap.observeDeep(applyFromY);
      unobserve = () => yMap.unobserveDeep(applyFromY);

      const push = () => {
        if (syncing) return;                          // don't send during import
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const { document } = getSnapshot(editor.store);
          yMap.set("document", document);
        });
      };

      // subscribe only AFTER migration finishes
      (window as any).__wm_end_migration__ = () => {
        syncing = false;
        if (!unsub) {
          unsub = editor.store.listen(push, { source: "user" });
        }
        push();                                       // one initial commit
      };
    })();

    return () => {
      if (unsub) unsub();
      if (unobserve) unobserve();
      cancelAnimationFrame(raf);
    };
  }, [editor, room]);

  const importSlides = useCallback((e: TLEditor) => {
        // Check if deck is empty or only has minimal content
        const shapes = e.getCurrentPageShapes();
        const hasFrames = shapes.some(s => s.type === 'frame');
        
        if (!hasFrames || shapes.length < 5) {
          console.log('Importing vendor-advance slides...', { shapes: shapes.length, hasFrames });
          
          // Fetch and parse the static HTML to seed the deck
          // Using .txt extension to avoid Next.js routing issues
          console.log('Starting fetch of /vendor-advance-slides.txt');
          fetch('/vendor-advance-slides.txt')
            .then(r => {
              console.log('Fetch response:', r.status, r.statusText);
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.text();
            })
            .then(async html => {
              console.log('HTML fetched successfully, length:', html.length);
              
              // If HTML is too short, something's wrong
              if (html.length < 1000) {
                console.error('HTML seems too short:', html);
                throw new Error('HTML file appears to be empty or truncated');
              }
              
              // Parse HTML and create tldraw shapes
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              
              // Debug: show what we parsed
              console.log('Parsed document body children:', doc.body?.children.length);
              console.log('Body innerHTML sample:', doc.body?.innerHTML?.substring(0, 500));
              
              // Look for slides with multiple approaches
              let slides: Element[] = Array.from(doc.querySelectorAll('div.slide'));
              console.log(`Method 1 - div.slide: found ${slides.length}`);
              
              if (slides.length === 0) {
                // Try without the div qualifier
                slides = Array.from(doc.querySelectorAll('.slide'));
                console.log(`Method 2 - .slide: found ${slides.length}`);
              }
              
              if (slides.length === 0) {
                // Look in the presentation container
                const container = doc.querySelector('.presentation-container');
                if (container) {
                  slides = Array.from(container.querySelectorAll('.slide'));
                  console.log(`Method 3 - .presentation-container .slide: found ${slides.length}`);
                }
              }
              
              if (slides.length === 0) {
                // Just find any element with slide in the class
                const allElements = doc.querySelectorAll('*');
                const slideElements = Array.from(allElements).filter(el => 
                  el.className && typeof el.className === 'string' && el.className.includes('slide')
                );
                console.log(`Method 4 - any element with 'slide' class: found ${slideElements.length}`);
                slides = slideElements.filter(el => !el.className.includes('slide-number'));
              }
              
              console.log(`Final: Processing ${slides.length} slides`);
              
              // Clear existing shapes if needed
              if (shapes.length > 0) {
                e.deleteShapes(shapes.map(s => s.id));
              }
              
              const W = 1920, H = 1080, GAP = 140;
              const made: TLShapeId[] = [];

              for (let i = 0; i < slides.length; i++) {
                const x = 0, y = i * (H + GAP);
                const frameId: TLShapeId = createShapeId(`frame_${crypto.randomUUID()}`);

                e.createShapes([{
                  id: frameId, type: "frame", x, y,
                  props: { w: W, h: H, name: `Slide ${i + 1}` }
                }]);

                try {
                  // Always put high-DPI background first
                  await putRasterBackground(e, slides[i].outerHTML || slides[i].innerHTML, frameId, x, y);
                } catch (uploadErr) {
                  console.error(`Failed to upload slide ${i + 1} background:`, uploadErr);
                  // Continue with other slides, frame will exist but without background
                }

                // overlay minimal editable text (optional)
                const tmp = document.createElement("div");
                tmp.innerHTML = slides[i].outerHTML || slides[i].innerHTML;
                const blocks = Array.from(tmp.querySelectorAll("h1,h2,ul>li"));
                let textY = y + 180;
                
                for (const el of blocks.slice(0, 4)) {  // limit to 4 text overlays
                  const text = el.tagName === "LI"
                    ? `• ${(el as HTMLElement).innerText}`
                    : (el as HTMLElement).innerText;
                  
                  if (text && text.trim()) {
                    e.createShapes([{
                      id: createShapeId(`txt_${crypto.randomUUID()}`),
                      type: "geo",
                      x: x + 120,
                      y: textY,
                      parentId: frameId,
                      props: {
                        geo: 'rectangle',
                        fill: 'none',
                        w: 1680,
                        h: el.tagName === "H1" || el.tagName === "H2" ? 80 : 60,
                        size: el.tagName === "H1" ? "xl" : el.tagName === "H2" ? "l" : "m",
                        font: "sans",
                        color: "black",
                        align: "start",
                        verticalAlign: "start",
                        richText: toRichText(text),
                      },
                    }]);
                    textY += el.tagName === "H1" || el.tagName === "H2" ? 100 : 70;
                  }
                }

                made.push(frameId);
              }
              
              // Select and focus on first slide
              if (made.length) {
                e.select(made[0]);
                setCurrentFrameId(made[0]);
                fitCameraToFrame(e, made[0]);
              }
              
              // End migration mode to enable syncing
              (window as any).__wm_end_migration__?.();
              
              console.log('Import complete!');
            })
            .catch(err => {
              console.error('Failed to seed deck from HTML:', err);
              console.error('Error details:', err.message, err.stack);
              
              // Fallback: Create some basic slides manually
              console.log('Using fallback slide creation...');
              const fallbackSlides = [
                { title: 'Vendor Advance Partnership', content: 'Strategic Vendor Behavior Management Through Financial Innovation' },
                { title: 'The Challenge', content: 'Your vendors face serious cash flow challenges with Net 60-90 payment terms' },
                { title: 'The Solution', content: 'Support vendors while driving performance with 3% advance rates' },
                { title: 'How It Works', content: 'Vendors submit invoices and receive 97% payment within 24 hours' },
                { title: 'Benefits for CheckSammy', content: '34% after-tax returns through partnership structure' },
              ];
              
              // Clear any existing shapes
              const currentShapes = e.getCurrentPageShapes();
              if (currentShapes.length > 0) {
                e.deleteShapes(currentShapes.map(s => s.id));
              }
              
              const W = 1920;
              const H = 1080;
              const GAP = 140;
              
              fallbackSlides.forEach((slide, index) => {
                const frameId: TLShapeId = createShapeId(`frame_${index}`);
                e.createShape({
                  id: frameId,
                  type: 'frame',
                  x: 0,
                  y: index * (H + GAP),
                  props: {
                    w: W,
                    h: H,
                    name: `Slide ${index + 1}`,
                  },
                });
                
                // Add title using geo shape with richText
                e.createShape({
                  id: createShapeId(`title_${index}`),
                  type: 'geo',
                  x: 50,
                  y: index * (H + GAP) + 50,
                  parentId: frameId,
                  props: {
                    geo: 'rectangle',
                    fill: 'none',
                    color: 'black',
                    size: 'xl',
                    font: 'sans',
                    align: 'start',
                    verticalAlign: 'start',
                    w: 1000,
                    h: 80,
                    richText: toRichText(slide.title),
                  },
                });
                
                // Add content using geo shape with richText
                e.createShape({
                  id: createShapeId(`content_${index}`),
                  type: 'geo',
                  x: 50,
                  y: index * (H + GAP) + 150,
                  parentId: frameId,
                  props: {
                    geo: 'rectangle',
                    fill: 'none',
                    color: 'black',
                    size: 'm',
                    font: 'sans',
                    align: 'start',
                    verticalAlign: 'start',
                    w: 1000,
                    h: 200,
                    richText: toRichText(slide.content),
                  },
                });
              });
              
              e.zoomToFit();
              console.log('Fallback slides created successfully');
            });
        } else {
          console.log('Deck already has content, skipping import');
        }
  }, []);

  const runMigrationOnce = useCallback((e: TLEditor) => {
    const slug = window.location.pathname.split('/').pop();
    if (slug === 'vendor-advance') {
      // Add a small delay to ensure the editor is fully initialized
      setTimeout(() => {
        const shapes = e.getCurrentPageShapes();
        const hasFrames = shapes.some(s => s.type === 'frame');
        
        if (!hasFrames || shapes.length < 5) {
          importSlides(e);
        } else {
          // Show manual import button if deck has content
          setShowImportButton(true);
        }
      }, 100);
    }
  }, [importSlides]);

  const handleMount = useCallback((e: TLEditor) => {
    setEditor(e);
    runMigrationOnce(e);
  }, [runMigrationOnce]);

  return (
    <div className="grid grid-rows-[1fr_auto] h-screen">
      <div className="relative">
        <Tldraw onMount={handleMount}>
          {editor && <DeckActions />}
        </Tldraw>
        {editor && <SlidesNav editor={editor} currentFrameId={currentFrameId as TLShapeId | null} />}
        {editor && <AIToolbar editor={editor} currentFrameId={currentFrameId as TLShapeId | null} />}
        {showImportButton && window.location.pathname.includes('vendor-advance') && (
          <button
            onClick={() => {
              if (editor) {
                if (confirm('This will replace all existing content. Continue?')) {
                  // Clear all shapes first
                  const shapes = editor.getCurrentPageShapes();
                  if (shapes.length > 0) {
                    editor.deleteShapes(shapes.map(s => s.id));
                  }
                  importSlides(editor);
                  setShowImportButton(false);
                }
              }
            }}
            className="absolute top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Import Vendor Advance Slides
          </button>
        )}
      </div>
      <div className="border-t bg-white">
        <NotesPanel frameId={currentFrameId} />
      </div>
    </div>
  );
}

// AI Toolbar component
function AIToolbar({ editor, currentFrameId }: { editor: TLEditor; currentFrameId: TLShapeId | null }) {
  const [loading, setLoading] = useState(false);
  
  if (!editor || !currentFrameId) return null;
  
  return (
    <div className="fixed top-6 right-6 z-50 flex gap-2">
      <button
        onClick={async () => {
          setLoading(true);
          try {
            await beautifyWithAI(editor, currentFrameId);
          } catch (err) {
            console.error('Beautify failed:', err);
            alert('Failed to beautify slide. Please try again.');
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="rounded-lg border px-3 py-1 bg-white shadow hover:bg-gray-50 disabled:opacity-50"
        title="AI: Beautify this slide"
      >
        {loading ? 'Processing...' : 'AI Beautify'}
      </button>
    </div>
  );
}

// Navigation component for slides
function SlidesNav({ editor, currentFrameId }: { editor: TLEditor; currentFrameId: TLShapeId | null }) {
  const frames = useMemo(
    () =>
      editor
        .getCurrentPageShapes()
        .filter((s) => s.type === "frame")
        .sort((a, b) => ((a.y as number) - (b.y as number)) || ((a.x as number) - (b.x as number))),
    [editor, currentFrameId]
  );

  const idx = Math.max(0, frames.findIndex((f) => f.id === currentFrameId));
  const go = (delta: number) => {
    const n = frames[idx + delta];
    if (!n) return;
    editor.select(n.id);
    fitCameraToFrame(editor, n.id as TLShapeId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        const n = frames[idx + 1];
        if (n) {
          editor.select(n.id);
          fitCameraToFrame(editor, n.id as TLShapeId);
        }
      }
      if (e.key === "ArrowLeft") {
        const n = frames[idx - 1];
        if (n) {
          editor.select(n.id);
          fitCameraToFrame(editor, n.id as TLShapeId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, frames, editor]);

  return (
    <div className="fixed bottom-[190px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-white/90 px-4 py-2 shadow">
      <button onClick={() => go(-1)} className="px-3 py-1 rounded border">Prev</button>
      <div className="text-sm">{frames.length ? idx + 1 : 0} / {frames.length}</div>
      <button onClick={() => go(1)} className="px-3 py-1 rounded border">Next</button>
    </div>
  );
}

function NotesPanel({ frameId }: { frameId: string | null }) {
  if (!frameId) {
    return (
      <div className="p-4 text-sm text-gray-600">
        Select a slide to edit its presenter notes. Notes sync in real time.
      </div>
    );
  }
  
  return <NotesEditor frameId={frameId} />;
}

function NotesEditor({ frameId }: { frameId: string }) {
  const field = `notes:${frameId}`;
  const liveblocksExt = useLiveblocksExtension({
    field,
    initialContent: "<p>Presenter notes…</p>"
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      Placeholder.configure({ placeholder: "Presenter notes…" }),
      liveblocksExt,
    ],
    editorProps: { attributes: { class: "prose max-w-none p-4 outline-none" } },
  });

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="px-4 pt-3 text-xs text-gray-500">Notes for {frameId}</div>
      <EditorContent editor={editor} />
    </div>
  );
}