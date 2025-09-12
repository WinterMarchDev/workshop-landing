// app/slides/[slug]/page.tsx
"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import { Room } from "../../Room";

import { Tldraw, Editor as TLEditor, createShapeId, TLShapeId, toRichText } from "tldraw";
import "tldraw/tldraw.css";
import { toPng } from "html-to-image";

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

// Rasterize fallback for empty slides
async function rasterizeSlideHTMLIntoFrame(
  editor: TLEditor,
  html: string,
  frameId: TLShapeId,
  x: number,
  y: number,
  W = 1920,
  H = 1080
) {
  const staging = document.createElement("div");
  staging.style.position = "fixed";
  staging.style.left = "-99999px";
  staging.style.top = "-99999px";
  staging.style.width = `${W}px`;
  staging.style.height = `${H}px`;
  staging.style.background = "white";
  staging.innerHTML = html;
  document.body.appendChild(staging);

  try {
    const url = await toPng(staging, { cacheBust: true });
    document.body.removeChild(staging);

    editor.createShape({
      id: createShapeId(`img_${Date.now()}`),
      type: "image",
      x,
      y,
      parentId: frameId,
      props: { w: W, h: H, url },
    });
  } catch (err) {
    console.error('Failed to rasterize slide:', err);
    document.body.removeChild(staging);
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
        fitCameraToFrame(editor, frameId);
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

    return () => editor.off("change", handler);
  }, [editor, currentFrameId]);

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
            .then(html => {
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
              
              const W = 1920;
              const H = 1080;
              const GAP = 140;
              const made: TLShapeId[] = [];
              
              for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];
                const x = 0;
                const y = i * (H + GAP);
                
                // Create a frame for each slide
                const frameId: TLShapeId = createShapeId(`frame_${i}_${Date.now()}`);
                e.createShape({
                  id: frameId,
                  type: 'frame',
                  x,
                  y,
                  props: {
                    w: W,
                    h: H,
                    name: `Slide ${i + 1}`,
                  },
                });
                
                // Extract and add text content from the slide
                const textElements = slide.querySelectorAll('h1, h2, h3, p, li');
                let yOffset = 50;
                let added = 0;
                
                textElements.forEach((elem, elemIndex) => {
                  const text = elem.textContent?.trim();
                  if (text) {
                    // Use geo shape with richText for text content
                    const textShapeId = createShapeId(`text_${i}_${elemIndex}_${Date.now()}`);
                    e.createShape({
                      id: textShapeId,
                      type: 'geo',
                      x: x + 50,
                      y: y + yOffset,
                      parentId: frameId,
                      props: {
                        geo: 'rectangle',
                        fill: 'none',
                        color: 'black',
                        size: elem.tagName === 'H1' ? 'xl' : 
                              elem.tagName === 'H2' ? 'l' : 
                              elem.tagName === 'H3' ? 'm' : 's',
                        font: 'sans',
                        align: 'start',
                        verticalAlign: 'start',
                        w: W - 100,
                        h: elem.tagName.startsWith('H') ? 80 : 60,
                        richText: toRichText(text),
                      },
                    });
                    yOffset += elem.tagName.startsWith('H') ? 100 : 70;
                    added++;
                  }
                });
                
                // If no content was added, rasterize the slide
                if (added === 0) {
                  await rasterizeSlideHTMLIntoFrame(e, slide.outerHTML || slide.innerHTML, frameId, x, y, W, H);
                }
                
                made.push(frameId);
              }
              
              // Select and focus on first slide
              if (made.length) {
                e.select(made[0]);
                setCurrentFrameId(made[0]);
                fitCameraToFrame(e, made[0]);
              }
              
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
        <Tldraw onMount={handleMount} />
        {editor && <SlidesNav editor={editor} currentFrameId={currentFrameId as TLShapeId | null} />}
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
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, frames.length, go]);

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
      StarterKit,
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