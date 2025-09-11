"use client";

import { useMemo } from "react";
import { Tldraw, createTLStore, TLStoreWithStatus, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";

import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { createClient } from "@liveblocks/client";
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";

function useLiveblocksTldrawStore(roomId: string): TLStoreWithStatus {
  // Create once
  const storeWithStatus = useMemo<TLStoreWithStatus>(() => {
    // Local store now; we'll hook it to Yjs below
    const store = createTLStore();
    return { status: "loading", store };
  }, []);

  // Attach Yjs+Liveblocks once per room id
  useMemo(() => {
    const ydoc = new Y.Doc();
    const client = createClient({ authEndpoint: "/api/liveblocks-auth" });
    const provider = new LiveblocksYjsProvider(client, roomId, ydoc);

    // Apply remote updates into tldraw store and vice-versa.
    // We serialize the tldraw store to Yjs under a single key.
    const yMap = ydoc.getMap<any>("tldraw");
    // When Y updates, load into the store
    const applyFromY = () => {
      const snap = yMap.get("document");
      if (snap) loadSnapshot(storeWithStatus.store, snap);
    };
    yMap.observeDeep(applyFromY);

    // When the store changes, push to Y
    const unsub = storeWithStatus.store.listen(
      () => {
        const { document } = getSnapshot(storeWithStatus.store);
        yMap.set("document", document);
      },
      { source: "user" }
    );

    provider.connect();
    // Mark ready
    (storeWithStatus as any).status = "synced";

    return () => {
      unsub();
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, storeWithStatus]);

  return storeWithStatus;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roomId = `wm:slides:${slug}`;

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={roomId} initialPresence={{}}>
        <ClientSideSuspense fallback={<div className="p-6">Loading slides…</div>}>
          <Editor roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function Editor({ roomId }: { roomId: string }) {
  const store = useLiveblocksTldrawStore(roomId);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw store={store} />
    </div>
  );
}