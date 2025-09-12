// app/Room.tsx
"use client";

import { ReactNode } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";

export function Room({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  return (
    <LiveblocksProvider 
      authEndpoint={async (roomId) => {
        const res = await fetch('/api/liveblocks-auth', {
          method: 'POST',
          credentials: 'include', // send wm_sess cookie
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomId }),
        });
        if (!res.ok) throw new Error('Liveblocks auth failed');
        return res.json(); // token payload
      }}
      // Handle large messages by logging warnings instead of throwing
      throttle={16}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null }}
        initialStorage={() => ({})}
      >
        <ClientSideSuspense fallback={<div>Loading…</div>}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}