"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useStorage,
  useMutation,
  useOthers,
  useMyPresence,
} from "@liveblocks/react/suspense";
import {
  Tldraw,
  Editor,
  TLStoreSnapshot,
  createTLStore,
  defaultShapeUtils,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

function TldrawEditor({ roomId }: { roomId: string }) {
  const [myPresence, updateMyPresence] = useMyPresence();
  const others = useOthers();
  
  // Get the stored tldraw document from Liveblocks Storage
  const storedSnapshot = useStorage((root) => root.snapshot);
  
  // Mutation to update the stored snapshot
  const updateSnapshot = useMutation(({ storage }, snapshot: TLStoreSnapshot) => {
    storage.set("snapshot", snapshot);
  }, []);

  // Initialize tldraw store
  const store = useMemo(() => {
    const store = createTLStore({ shapeUtils: defaultShapeUtils });
    
    // Load initial snapshot if it exists
    if (storedSnapshot) {
      store.loadSnapshot(storedSnapshot as TLStoreSnapshot);
    }
    
    return store;
  }, []);

  // Handle editor mount and changes
  const handleMount = useCallback((editor: Editor) => {
    // Load the stored snapshot if available and not already loaded
    if (storedSnapshot && editor.store) {
      editor.store.loadSnapshot(storedSnapshot as TLStoreSnapshot);
    }

    // Listen for changes and save to Liveblocks
    const unsubscribe = editor.store.listen(() => {
      const snapshot = editor.store.getSnapshot();
      updateSnapshot(snapshot);
    }, { source: "user", scope: "document" });

    // Update presence with cursor position
    editor.on("pointer-move", () => {
      const { x, y } = editor.inputs.currentPagePoint;
      updateMyPresence({ cursor: { x, y } });
    });

    // Clear cursor when leaving
    editor.on("pointer-leave", () => {
      updateMyPresence({ cursor: null });
    });

    return () => {
      unsubscribe();
    };
  }, [storedSnapshot, updateSnapshot, updateMyPresence]);

  // Render other users' cursors
  const renderOthersCursors = useCallback(() => {
    return others.map((other) => {
      const cursor = other.presence?.cursor;
      if (!cursor) return null;
      
      return (
        <div
          key={other.connectionId}
          style={{
            position: "absolute",
            left: cursor.x,
            top: cursor.y,
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: `hsl(${other.connectionId * 137.5 % 360}, 70%, 50%)`,
            border: "2px solid white",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
          }}
        />
      );
    });
  }, [others]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Tldraw
        store={store}
        onMount={handleMount}
      />
      {renderOthersCursors()}
    </div>
  );
}

export default function Page({ params }: { params: { slug: string } }) {
  const roomId = useMemo(() => `wm:slides:${params.slug}`, [params.slug]);

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider 
        id={roomId} 
        initialPresence={{ cursor: null }}
        initialStorage={{ snapshot: null }}
      >
        <ClientSideSuspense fallback={<div className="p-6 text-gray-500">Loading canvas…</div>}>
          <TldrawEditor roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}