"use client";

import { useMemo, useEffect } from "react";
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import { useLiveblocksExtension, FloatingToolbar, FloatingThreads, FloatingComposer } from "@liveblocks/react-tiptap";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

function Editor({ roomId }: { roomId: string }) {
  // Important: let Liveblocks own persistence; do NOT put a static `content` here.
  // If you want default content for a *new* doc, use the extension's initialContent option below.
  const liveblocks = useLiveblocksExtension({
    field: "body", // supports multiple editors per room if needed
    // Will only apply if the doc has never been edited:
    initialContent: `<h1>Vendor Advance</h1><p>Paste or type. Everything syncs in real time.</p>`,
    // offlineSupport_experimental: true, // optional: cached local load
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: true }),
      Placeholder.configure({ placeholder: "Start typing…" }),
      liveblocks, // Liveblocks + TipTap integration
    ],
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[70vh] p-6 bg-white rounded-2xl shadow-sm outline-none",
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl py-8">
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
      <div className="mt-4 flex gap-4">
        <FloatingComposer editor={editor} style={{ width: 360 }} />
        <FloatingThreads editor={editor} style={{ width: 360 }} />
      </div>
    </div>
  );
}

export default function Page({ params }: { params: { slug: string } }) {
  const roomId = useMemo(() => `wm:docs:${params.slug}`, [params.slug]);

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={<div className="p-6 text-gray-500">Loading editor…</div>}>
          <Editor roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}