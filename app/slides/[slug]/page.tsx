"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// --- tldraw core (v2) ---
import { Tldraw, Editor as TLEditor, TLShape, createShapeId } from "tldraw";
import "tldraw/tldraw.css";

// --- Liveblocks + Yjs sync for tldraw ---
import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { createClient } from "@liveblocks/client";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useStorage,
  useMutation,
} from "@liveblocks/react/suspense";

// --- TipTap for presenter notes (per-frame) ---
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";

// ========== Liveblocks+tldraw store hook ==========
function useTldrawStoreWithLiveblocks(roomId: string) {
  // Create a tldraw editor/store on first render
  const editorRef = useRef<TLEditor | null>(null);

  // Connect Yjs <-> Liveblocks once
  useEffect(() => {
    const ydoc = new Y.Doc();
    const client = createClient({ authEndpoint: "/api/liveblocks-auth" });
    const provider = new LiveblocksYjsProvider(client, roomId, ydoc);

    // tldraw v2 can store directly into a Yjs doc via the built-in persistence adapter:
    // we'll attach the editor to ydoc inside onMount (where we actually receive the editor)

    provider.connect();
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId]);

  return editorRef;
}

// ========== Page ==========
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const roomId = `wm:slides:${slug}`;
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={roomId} initialPresence={{}}>
        <ClientSideSuspense fallback={<div className="p-6">Loading slides…</div>}>
          <SlidesWithNotes roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

// ========== Slides + Notes layout ==========
function SlidesWithNotes({ roomId }: { roomId: string }) {
  const editorRef = useTldrawStoreWithLiveblocks(roomId);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);

  // Shared "has the migration run?" flag in Liveblocks Storage
  const migrated = useStorage((root) => root.get("meta")?.get("migrated") ?? false);

  const setMigrated = useMutation(
    ({ storage }) => {
      if (!storage.get("meta")) storage.set("meta", new Map());
      storage.get("meta")!.set("migrated", true);
    },
    []
  );

  // --- Helpers: legacy HTML -> slides array; simple vectorizer ---
  const splitLegacyHtmlIntoSlides = useCallback((html: string): string[] => {
    if (html.includes("data-slide")) {
      return html
        .split(/<hr[^>]*data-slide[^>]*>/gi)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const sectionMatches = html.match(
      /<section[^>]*class=["'][^"']*slide[^"']*["'][^>]*>[\s\S]*?<\/section>/gi
    );
    if (sectionMatches?.length) return sectionMatches;
    return html
      .split(/<h1[\s>]/i)
      .map((chunk, i) => (i === 0 ? chunk : `<h1 ${chunk}`))
      .filter((s) => s.trim());
  }, []);

  const cssColor = (c: string | null) => (c && c !== "rgba(0, 0, 0, 0)" ? c : undefined);

  async function createVectorSlideFromHtml(
    editor: TLEditor,
    slideHtml: string,
    originX: number,
    originY: number,
    index: number
  ) {
    const W = 1920;
    const H = 1080;

    // Stage offscreen to compute layout boxes and styles
    const staging = document.createElement("div");
    staging.style.position = "fixed";
    staging.style.left = "-99999px";
    staging.style.top = "-99999px";
    staging.style.width = `${W}px`;
    staging.style.height = `${H}px`;
    staging.style.background = "white";
    staging.style.padding = "0";
    staging.style.margin = "0";
    staging.innerHTML = slideHtml;
    document.body.appendChild(staging);

    const sRect = staging.getBoundingClientRect();
    const toSlideRect = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.left - sRect.left, y: r.top - sRect.top, w: r.width, h: r.height };
    };

    // Create a frame (the "slide")
    const frameId = createShapeId(`frame_${crypto.randomUUID()}`);
    editor.createShapes([
      {
        id: frameId,
        type: "frame",
        x: originX,
        y: originY,
        props: { w: W, h: H, name: `Slide ${index + 1}` },
      } as TLShape,
    ]);

    // Optional background rectangle to carry background color
    const bgColor = cssColor(getComputedStyle(staging).backgroundColor);
    if (bgColor) {
      editor.createShapes([
        {
          id: createShapeId(`bg_${crypto.randomUUID()}`),
          type: "geo",
          x: originX,
          y: originY,
          props: {
            w: W,
            h: H,
            geo: "rectangle",
            fill: "solid",
            color: "black",
          },
          parentId: frameId,
          meta: { css: { bgColor } },
        } as TLShape,
      ]);
    }

    // Walk allowed nodes and map to shapes
    const nodes = Array.from(
      staging.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,img")
    );

    for (const el of nodes) {
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.display === "none" || cs.visibility === "hidden") continue;

      const { x, y, w, h } = toSlideRect(el);
      if (w < 2 || h < 2) continue;

      const tag = el.tagName.toLowerCase();

      if (tag === "img") {
        const src = (el as HTMLImageElement).getAttribute("src");
        if (!src) continue;
        const url =
          src.startsWith("http://") || src.startsWith("https://")
            ? src
            : src.startsWith("/")
            ? src
            : `/${src}`;
        editor.createShapes([
          {
            id: createShapeId(`img_${crypto.randomUUID()}`),
            type: "image",
            x: originX + x,
            y: originY + y,
            props: { w, h, url },
            parentId: frameId,
          } as TLShape,
        ]);
        continue;
      }

      // Text-like
      const isText =
        tag === "h1" ||
        tag === "h2" ||
        tag === "h3" ||
        tag === "h4" ||
        tag === "h5" ||
        tag === "h6" ||
        tag === "p" ||
        tag === "li" ||
        tag === "blockquote" ||
        tag === "figcaption";

      if (isText) {
        let text = (el as HTMLElement).innerText || "";
        if (tag === "li" && text && !/^[•\-]/.test(text)) text = `• ${text}`;

        const align =
          cs.textAlign === "center" ? "middle" : cs.textAlign === "right" ? "end" : "start";

        editor.createShapes([
          {
            id: createShapeId(`txt_${crypto.randomUUID()}`),
            type: "text",
            x: originX + x,
            y: originY + y,
            props: {
              w,
              h,
              text,
              align, // start | middle | end
            },
            parentId: frameId,
            meta: {
              css: {
                color: cssColor(cs.color),
                fontSizePx: parseFloat(cs.fontSize || "16"),
                fontWeight: cs.fontWeight || "400",
              },
            },
          } as TLShape,
        ]);
        continue;
      }

      // Fallback: generic box
      editor.createShapes([
        {
          id: createShapeId(`rect_${crypto.randomUUID()}`),
          type: "geo",
          x: originX + x,
          y: originY + y,
          props: { w, h, geo: "rectangle", fill: "none", color: "black" },
          parentId: frameId,
        } as TLShape,
      ]);
    }

    document.body.removeChild(staging);
    return frameId;
  }

  // One-time migration after editor mounts
  const runMigrationOnce = useCallback(
    async (editor: TLEditor) => {
      if (migrated) return;

      const resp = await fetch("/vendor-advance-slides.html");
      if (!resp.ok) return;
      const html = await resp.text();
      const slides = splitLegacyHtmlIntoSlides(html);
      if (!slides.length) {
        setMigrated(); // avoid retry loops
        return;
      }

      const made: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        const x = (i % 3) * 2200;
        const y = Math.floor(i / 3) * 1300;
        const frameId = await createVectorSlideFromHtml(editor, slides[i], x, y, i);
        if (frameId) made.push(frameId);
      }

      setMigrated();
      if (made.length) {
        editor.select(made[0]);
        setCurrentFrameId(made[0]);
      }
    },
    [migrated, setMigrated, splitLegacyHtmlIntoSlides]
  );

  // Mount tldraw, attach listeners, then migrate if needed
  const handleMount = useCallback(
    (editor: TLEditor) => {
      editorRef.current = editor;

      // Track selection to bind notes to the selected frame
      editor.on("change", () => {
        const sel = editor.getSelectedShapes();
        let frameId: string | null = null;
        if (sel.length) {
          const frame = sel.find((s) => s.type === "frame");
          if (frame) frameId = frame.id;
          else {
            const parent = sel[0].parentId ? editor.getShape(sel[0].parentId!) : null;
            if (parent && parent.type === "frame") frameId = parent.id;
          }
        }
        setCurrentFrameId(frameId);
      });

      // Kick migration once mounted
      runMigrationOnce(editor);
    },
    [editorRef, runMigrationOnce]
  );

  return (
    <div className="grid grid-rows-[1fr_auto] h-screen">
      <Tldraw onMount={handleMount} />
      <div className="border-t bg-white">
        <NotesPanel frameId={currentFrameId} />
      </div>
    </div>
  );
}

// ========== Presenter Notes (per selected frame) ==========
function NotesPanel({ frameId }: { frameId: string | null }) {
  const field = useMemo(() => (frameId ? `notes:${frameId}` : null), [frameId]);
  const liveblocksExt = useLiveblocksExtension(
    field ? { field, initialContent: "<p>Presenter notes…</p>" } : null
  );

  const editor = useEditor(
    field
      ? {
          extensions: [
            StarterKit.configure({}), // history enabled by default
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Placeholder.configure({ placeholder: "Presenter notes…" }),
            liveblocksExt!,
          ],
          editorProps: {
            attributes: { class: "prose max-w-none p-4 outline-none" },
          },
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