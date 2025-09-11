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
import { toPng } from "html-to-image";

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
  // Adjust the splitting rule to match your file:
  //   Option A: slides delimited by <hr data-slide>
  //   Option B: treat each <section class="slide"> as one slide
  //   Option C: split by top-level <h1>/<h2> etc.
  const splitLegacyHtmlIntoSlides = (html: string): string[] => {
    // Try data-slide <hr> delimiter first:
    if (html.includes('data-slide')) {
      return html.split(/<hr[^>]*data-slide[^>]*>/gi).map(s => s.trim()).filter(Boolean);
    }
    // Fallback: split on <section class="slide">…</section>
    const sectionMatches = html.match(/<section[^>]*class=["'][^"']*slide[^"']*["'][^>]*>[\s\S]*?<\/section>/gi);
    if (sectionMatches && sectionMatches.length) return sectionMatches;

    // Last resort: split on <h1> as slide header
    return html.split(/<h1[\s>]/i).map((chunk, i) => (i === 0 ? chunk : `<h1 ${chunk}`)).filter(s => s.trim());
  };

  // One-time migration on first open: render each slide's HTML to a PNG and insert into tldraw frames.
  const migrateIfNeeded = useCallback(async () => {
    if (!appRef.current) return;
    if (storage.migrated) return;

    // fetch legacy file from /public
    const resp = await fetch("/vendor-advance-slides.html");
    if (!resp.ok) return; // graceful no-op if file missing
    const legacyHtml = await resp.text();
    const slides = splitLegacyHtmlIntoSlides(legacyHtml);
    if (!slides.length) return;

    // Hidden staging node for rasterization
    const staging = document.createElement("div");
    staging.style.position = "fixed";
    staging.style.left = "-99999px";
    staging.style.top = "-99999px";
    staging.style.width = "1920px";     // slide width
    staging.style.height = "1080px";    // slide height
    staging.style.background = "white";
    staging.style.padding = "0";
    staging.style.margin = "0";
    staging.style.zIndex = "-1";
    document.body.appendChild(staging);

    const app = appRef.current!;
    const createdFrameIds: string[] = [];

    for (let i = 0; i < slides.length; i++) {
      staging.innerHTML = slides[i];

      // Ensure layout fits 1920x1080 for consistent slide export
      // If your HTML uses external CSS, include it here or inline styles in the legacy file.

      // Rasterize to PNG
      const dataUrl = await toPng(staging, { cacheBust: true });

      // Create a frame and an image bound to it
      const x = (i % 3) * 2200;      // lay frames on a grid to start
      const y = Math.floor(i / 3) * 1300;

      // Create frame
      const frameId = `frame_${crypto.randomUUID()}`;
      app.createShapes([
        {
          id: frameId,
          type: "frame",
          x,
          y,
          props: {
            w: 1920,
            h: 1080,
            name: `Slide ${i + 1}`,
          },
        } as any,
      ]);

      // Create image inside frame
      app.createShapes([
        {
          id: `img_${crypto.randomUUID()}`,
          type: "image",
          x,
          y,
          props: {
            w: 1920,
            h: 1080,
            url: dataUrl,
          },
          parentId: frameId,
        } as any,
      ]);

      createdFrameIds.push(frameId);

      // Seed a blank notes doc per frame; we'll allow editing below
      // We keep notes in Liveblocks Storage under root.notes[frameId]
      // (no-op here; notes are created lazily when the editor opens a frame)
    }

    document.body.removeChild(staging);
    setMigrated();
    // Optionally focus first frame
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