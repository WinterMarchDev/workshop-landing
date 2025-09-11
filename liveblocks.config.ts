// liveblocks.config.ts
declare global {
  interface Liveblocks {
    Presence: { cursor: { x: number; y: number } | null };
    UserMeta: { id: string; info: { name: string; avatar?: string } };
    // Do NOT declare Storage unless you really need strong typing.
    // If you insist, it MUST be LSON-safe, e.g.:
    // Storage: { migrated?: boolean };
  }
}
export {};