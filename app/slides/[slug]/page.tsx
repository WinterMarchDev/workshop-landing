"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@tldraw/tldraw/tldraw.css";
import { Tldraw, TldrawApp, TLUiEventHandler } from "@tldraw/tldraw";
import { LiveblocksSync } from "@tldraw/sync";
import { createClient } from "@liveblocks/client";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useMutation,
  useStorage,
} from "@liveblocks/react/suspense";

// TipTap + Liveblocks for the notes area
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";

const client = createClient({ authEndpoint: "/api/liveblocks-auth" });

export default function SlidePage({ params }: { params: { slug: string } }) {
  const roomId = useMemo(() => `wm:slides:${params.slug}`, [params.slug]);
  return (
    <LiveblocksProvider client={client}>
      <RoomProvider id={roomId} initialPresence={{}}>
        <ClientSideSuspense fallback={<div className="p-6">Loading slides…</div>}>
          <SlidesWithNotes roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function SlidesWithNotes({ roomId }: { roomId: string }) {
  const appRef = useRef<TldrawApp | null>(null);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);

  // Liveblocks Storage layout:
  // storage.root.get("meta").get("migrated") => boolean
  // storage.root.get("notes").get(frameId) => richtext state for TipTap
  // storage.root.get("cover") => optional cover slide id
  const storage = useStorage((root) => ({
    migrated: root.get("meta")?.get("migrated") ?? false,
  }));

  // Mark migration complete
  const setMigrated = useMutation(
    ({ storage }) => {
      if (!storage.get("meta")) storage.set("meta", new Map());
      storage.get("meta")!.set("migrated", true);
    },
    []
  );

  // Helper: parse your legacy HTML into an array of per-slide HTML strings.
  const splitLegacyHtmlIntoSlides = (html: string): string[] => {
    if (html.includes("data-slide")) {
      return html
        .split(/<hr[^>]*data-slide[^>]*>/gi)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const sectionMatches = html.match(
      /<section[^>]*class=["'][^"']*slide[^"']*["'][^>]*>[\s\S]*?<\/section>/gi
    );
    if (sectionMatches && sectionMatches.length) return sectionMatches;
    return html
      .split(/<h1[\s>]/i)
      .map((chunk, i) => (i === 0 ? chunk : `<h1 ${chunk}`))
      .filter((s) => s.trim());
  };

  // Utility to coerce CSS color strings to hex when possible
  const cssColorToString = (color: string | null) => {
    if (!color) return "#000000";
    // tldraw accepts css strings; keep as-is
    return color;
  };

  // Turn one offscreen DOM slide into tldraw shapes within a frame
  async function domSlideToTldrawShapes(
    app: TldrawApp,
    slideHtml: string,
    originX: number,
    originY: number
  ) {
    // stage offscreen at 1920x1080 to compute layout boxes
    const W = 1920;
    const H = 1080;
    const staging = document.createElement("div");
    staging.style.position = "fixed";
    staging.style.left = "-99999px";
    staging.style.top = "-99999px";
    staging.style.width = `${W}px`;
    staging.style.height = `${H}px`;
    staging.style.background = "white";
    staging.style.padding = "0";
    staging.style.margin = "0";
    staging.style.zIndex = "-1";
    staging.innerHTML = slideHtml;
    document.body.appendChild(staging);

    // Use computed background if present
    const slideBg = getComputedStyle(staging).backgroundColor;

    const frameId = `frame_${crypto.randomUUID()}`;
    app.createShapes([
      {
        id: frameId,
        type: "frame",
        x: originX,
        y: originY,
        props: { w: W, h: H, name: "Slide" },
      } as any,
    ]);

    // Background rectangle to carry background color
    app.createShapes([
      {
        id: `bg_${crypto.randomUUID()}`,
        type: "rectangle",
        x: originX,
        y: originY,
        props: {
          w: W,
          h: H,
          color: "black",
          fill: "solid",
          dash: "draw",
          size: "m",
          opacity: 1,
          // tldraw uses theme tokens; we'll just set style on the shape after create
        },
        parentId: frameId,
      } as any,
    ]);
    // Set style override for background if supported by your version
    // Otherwise, you can create a geo shape with fill color applied via style prop
    const bgEl = getComputedStyle(staging);
    const bgColor = cssColorToString(slideBg);

    // Walk simple blocks: headings, paragraphs, list items, images, figures
    const allowedSelectors =
      "h1,h2,h3,h4,h5,h6,p,li,blockquote,img,figure,figcaption,div[data-block]";
    const nodes = Array.from(staging.querySelectorAll(allowedSelectors));

    // Helper to compute rect in slide coordinates
    const toSlideRect = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const s = staging.getBoundingClientRect();
      return {
        x: r.left - s.left,
        y: r.top - s.top,
        w: r.width,
        h: r.height,
      };
    };

    for (const el of nodes) {
      const tag = el.tagName.toLowerCase();

      // Skip invisible or zero-sized
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.display === "none" || cs.visibility === "hidden") continue;

      const { x, y, w, h } = toSlideRect(el);
      if (w < 2 || h < 2) continue;

      if (tag === "img") {
        const src = (el as HTMLImageElement).getAttribute("src");
        if (!src) continue;

        // Absolute/relative URLs: if relative, assume /public path
        const url =
          src.startsWith("http://") || src.startsWith("https://")
            ? src
            : src.startsWith("/")
            ? src
            : `/${src}`;

        app.createShapes([
          {
            id: `img_${crypto.randomUUID()}`,
            type: "image",
            x: originX + x,
            y: originY + y,
            props: {
              w,
              h,
              url,
            },
            parentId: frameId,
          } as any,
        ]);
        continue;
      }

      // Treat text-like elements as text boxes
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
        tag === "figcaption" ||
        ((el as HTMLElement).dataset && (el as HTMLElement).dataset["block"] === "text");

      if (isText) {
        // Get plain text, preserving list bullets crudely
        let text = (el as HTMLElement).innerText || "";
        if (tag === "li" && text && !/^[•\-]/.test(text)) text = `• ${text}`;

        const fontSizePx = parseFloat(cs.fontSize || "16");
        const fontWeight = cs.fontWeight || "400";
        const color = cssColorToString(cs.color);
        const align =
          cs.textAlign === "center"
            ? "middle"
            : cs.textAlign === "right"
            ? "end"
            : "start";

        app.createShapes([
          {
            id: `txt_${crypto.randomUUID()}`,
            type: "text",
            x: originX + x,
            y: originY + y,
            props: {
              w,
              h,
              text,
              align, // "start" | "middle" | "end"
              // tldraw text props vary by version; store style hints in meta if needed
              // You can tune font/size via style system or themes; here's a light-touch approach:
            },
            meta: {
              css: {
                fontSizePx,
                fontWeight,
                color,
              },
            },
            parentId: frameId,
          } as any,
        ]);
        continue;
      }

      // Generic non-text block: represent as a rectangle placeholder
      app.createShapes([
        {
          id: `rect_${crypto.randomUUID()}`,
          type: "rectangle",
          x: originX + x,
          y: originY + y,
          props: {
            w,
            h,
            color: "black",
            fill: "none",
            dash: "solid",
            size: "s",
            opacity: 1,
          },
          parentId: frameId,
        } as any,
      ]);
    }

    document.body.removeChild(staging);
    return frameId;
  }

  // One-time migration on first open: parse HTML and create vector shapes
  const migrateIfNeeded = useCallback(async () => {
    if (!appRef.current) return;
    if (storage.migrated) return;

    const resp = await fetch("/vendor-advance-slides.html");
    if (!resp.ok) return;
    const legacyHtml = await resp.text();
    const slides = splitLegacyHtmlIntoSlides(legacyHtml);
    if (!slides.length) return;

    const app = appRef.current!;
    const createdFrameIds: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      const x = (i % 3) * 2200;
      const y = Math.floor(i / 3) * 1300;
      const frameId = await domSlideToTldrawShapes(app, slides[i], x, y);
      createdFrameIds.push(frameId);
      // You can rename the frame after create if desired:
      const shape = app.getShapeById(frameId) as any;
      if (shape?.props) {
        app.updateShapes([
          {
            id: frameId,
            type: "frame",
            props: { ...shape.props, name: `Slide ${i + 1}` },
          } as any,
        ]);
      }
    }

    setMigrated();
    if (createdFrameIds.length) {
      app.select(createdFrameIds[0]);
      setCurrentFrameId(createdFrameIds[0]);
    }
  }, [storage.migrated, setMigrated]);

  // Mount tldraw and Liveblocks sync
  const handleMount = useCallback((app: TldrawApp) => {
    appRef.current = app;
    app.registerPersistenceMiddleware(new LiveblocksSync(app, { roomId }));
  }, [roomId]);

  // Track current selected frame to bind notes editor
  const onUiEvent = useCallback<TLUiEventHandler>((name, data) => {
    if (name === "select") {
      const app = appRef.current;
      if (!app) return;
      const sel = app.getSelectedShapes();
      // Prefer a selected frame; else find the parent frame of a selected shape
      let frameId: string | null = null;
      if (sel.length) {
        const f = sel.find(s => s.type === "frame");
        if (f) frameId = f.id as string;
        else {
          const candidate = sel[0];
          const parent = candidate?.parentId ? app.getShapeById(candidate.parentId) : null;
          if (parent && parent.type === "frame") frameId = parent.id as string;
        }
      }
      setCurrentFrameId(frameId);
    }
  }, []);

  // Kick off one-time migration after mount and sync ready
  useEffect(() => {
    // Defer slightly so LiveblocksSync attaches before creating shapes
    const t = setTimeout(() => { migrateIfNeeded(); }, 300);
    return () => clearTimeout(t);
  }, [migrateIfNeeded]);

  return (
    <div className="grid grid-rows-[1fr_auto] h-screen">
      <Tldraw
        onMount={handleMount}
        onUiEvent={onUiEvent}
        // You can customize UI here to feel more "slide deck"
      />
      <div className="border-t bg-white">
        <NotesPanel frameId={currentFrameId} />
      </div>
    </div>
  );
}

// TipTap notes bound to the currently selected frame.
// Each frame gets its own collaborative rich-text document at storage.notes[frameId].
function NotesPanel({ frameId }: { frameId: string | null }) {
  const field = useMemo(() => (frameId ? `notes:${frameId}` : null), [frameId]);

  // Liveblocks TipTap extension needs a field name; render read-only message when no frame selected
  const liveblocksExt = useLiveblocksExtension(
    field
      ? { field, initialContent: "<p>Presenter notes for this slide…</p>" }
      : null
  );

  const editor = useEditor(
    field
      ? {
          extensions: [
            StarterKit.configure({ history: true }),
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Placeholder.configure({ placeholder: "Presenter notes…" }),
            liveblocksExt!,
          ],
          editorProps: {
            attributes: {
              class:
                "prose max-w-none p-4 outline-none",
            },
          },
        }
      : undefined
  );

  if (!frameId) {
    return <div className="p-4 text-sm text-gray-600">Select a slide to edit its presenter notes. Notes are collaborative and auto-saved.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="px-4 pt-3 text-xs text-gray-500">Notes for frame {frameId}</div>
      <EditorContent editor={editor!} />
    </div>
  );
}