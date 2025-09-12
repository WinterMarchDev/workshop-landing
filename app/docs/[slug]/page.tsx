// app/docs/[slug]/page.tsx
"use client";

import { use, useEffect, useRef } from "react";
import { Room } from "../../Room";

// TipTap imports
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useLiveblocksExtension, FloatingToolbar, FloatingThreads, FloatingComposer } from "@liveblocks/react-tiptap";
import { useThreads, ClientSideSuspense } from "@liveblocks/react/suspense";

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const roomId = `wm:docs:${slug}`;
  return (
    <Room roomId={roomId}>
      <EditorShell />
    </Room>
  );
}

function EditorShell() {
  const liveblocks = useLiveblocksExtension({
    field: "body",
    initialContent: "<h1>Vendor Advance</h1><p>Paste or type…</p>",
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start typing…" }),
      liveblocks,
    ],
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[70vh] p-6 bg-white rounded-2xl shadow-sm outline-none",
      },
    },
  });

  // Guard so we don't run the seeding more than once per mount
  const seededRef = useRef(false);

  useEffect(() => {
    if (!editor || seededRef.current) return;

    // If the Liveblocks-backed doc is empty, seed from the static HTML once
    const isEmpty =
      editor.state.doc.childCount === 1 &&
      editor.state.doc.firstChild?.type.name === "paragraph" &&
      editor.state.doc.firstChild.content.size === 0;

    if (!isEmpty) return;

    seededRef.current = true;

    // Pull the legacy content from /public/vendor-advance-slides.html
    fetch("/vendor-advance-slides.html")
      .then((r) => r.text())
      .then((html) => {
        // Insert as the initial collaborative content
        // false = do not create a separate history step for the seed
        editor.commands.setContent(html, false);
      })
      .catch((err) => {
        console.error("Seed fetch failed:", err);
      });
  }, [editor]);

  const { threads } = useThreads({ query: { resolved: false } });

  return (
    <div className="mx-auto max-w-5xl py-8">
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
      <div className="mt-4 flex gap-4">
        <FloatingComposer editor={editor} style={{ width: 360 }} />
        <ClientSideSuspense fallback={null}>
          <FloatingThreads editor={editor} threads={threads} style={{ width: 360 }} />
        </ClientSideSuspense>
      </div>
    </div>
  );
}