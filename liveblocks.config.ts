// liveblocks.config.ts
// Types for presence & user metadata (names/avatars show up in cursors/comments/history)
declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null };
    Storage: { 
      snapshot: any | null;
      meta: Map<string, any>;
      notes: Map<string, any>;
      cover?: string;
    };
    UserMeta: {
      id: string;
      info: { name: string; avatar?: string };
    };
  }
}
export {};