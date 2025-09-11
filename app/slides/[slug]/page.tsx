"use client";

import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import { createClient } from "@liveblocks/client";
import { Tldraw, TldrawApp } from "@tldraw/tldraw";
import { LiveblocksSync } from "@tldraw/sync";
import "@tldraw/tldraw/tldraw.css";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

export default function SlidePage({ params }: { params: { slug: string } }) {
  const roomId = `wm:slides:${params.slug}`;

  return (
    <LiveblocksProvider client={client}>
      <RoomProvider id={roomId} initialPresence={{}}>
        <ClientSideSuspense fallback={<div>Loading slides…</div>}>
          <Editor roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function Editor({ roomId }: { roomId: string }) {
  return (
    <div className="h-screen w-screen">
      <Tldraw
        persistenceKey={roomId}
        onMount={(app: TldrawApp) => {
          app.replacePageContent([]); // start with a blank page if empty
          app.registerPersistenceMiddleware(new LiveblocksSync(app, { roomId }));
        }}
      />
    </div>
  );
}