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
      authEndpoint="/api/liveblocks-auth"
      // Handle large messages by logging warnings instead of throwing
      throttle={16}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null }}
        initialStorage={() => ({})}
        // Increase the max message size for large slide data
        unstable_options={{
          largeMessageThreshold: 1024 * 1024, // 1MB threshold
        }}
      >
        <ClientSideSuspense fallback={<div>Loading…</div>}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}