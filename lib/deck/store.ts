"use client";
import { create } from "zustand";
import { DeckExport, SlideExport, ShapeExport } from "./types";

type State = {
  deck: DeckExport | null;
  rev: number;
  saving: boolean;
  lockedBy?: string | null; // optional "single editor" lock holder
  setDeck: (d: DeckExport) => void;
  setActive: (i: number) => void;
  upsertShape: (s: ShapeExport) => void;
  deleteShape: (id: string) => void;
  loadFromServer: (deckId: string) => Promise<void>;
  saveToServer: (deckId: string) => Promise<void>;
  tryLock: (deckId: string, who: string) => Promise<boolean>;
  releaseLock: (deckId: string, who: string) => Promise<void>;
};

function debounce<T extends(...a:any[])=>void>(fn:T, ms:number) {
  let h: any; 
  return (...args:any[]) => { 
    clearTimeout(h); 
    h = setTimeout(() => fn(...args), ms); 
  };
}

export const useDeck = create<State>((set, get) => {
  const autosave = debounce(async (deckId:string) => {
    await get().saveToServer(deckId);
  }, 600);

  return {
    deck: null,
    rev: 0,
    saving: false,
    lockedBy: null,

    setDeck: (d) => set({ deck: d }),
    
    setActive: (i) => set(state => 
      state.deck ? { deck: { ...state.deck, active: i } } : state
    ),

    upsertShape: (s) => set(state => {
      if (!state.deck) return state;
      const slides = [...state.deck.slides];
      const slide = { ...slides[state.deck.active] };
      const idx = slide.shapes.findIndex(x => x.id === s.id);
      const shapes = [...slide.shapes];
      if (idx >= 0) shapes[idx] = s; 
      else shapes.push(s);
      slides[state.deck.active] = { ...slide, shapes: shapes.sort((a,b)=>a.z-b.z) };
      return { deck: { ...state.deck, slides } };
    }),

    deleteShape: (id) => set(state => {
      if (!state.deck) return state;
      const slides = [...state.deck.slides];
      const slide = { ...slides[state.deck.active] };
      slide.shapes = slide.shapes.filter(x => x.id !== id);
      slides[state.deck.active] = slide;
      return { deck: { ...state.deck, slides } };
    }),

    loadFromServer: async (deckId) => {
      const res = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
      if (!res.ok) throw new Error(await res.text());
      const row = await res.json();
      if (row.doc) set({ deck: row.doc, rev: row.rev ?? 0 });
    },

    saveToServer: async (deckId) => {
      const { deck, rev } = get();
      if (!deck) return;
      set({ saving: true });
      const res = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: deck, rev }),
      });
      if (res.status === 409) { 
        // someone else wrote, reload
        await get().loadFromServer(deckId); 
        set({ saving:false }); 
        return; 
      }
      if (!res.ok) { 
        set({ saving:false }); 
        throw new Error(await res.text()); 
      }
      const next = await res.json();
      set({ rev: next.rev, saving: false });
    },

    tryLock: async (deckId, who) => {
      // simplest possible lock: a row in decks acts as the lock holder via doc.meta.lockedBy
      const cur = get().deck;
      const mine = { 
        ...(cur ?? { width:1920, height:1080, slides:[], active:0 }), 
        meta: { ...(cur as any)?.meta, lockedBy: who } 
      };
      set({ deck: mine as any });
      await get().saveToServer(deckId);
      set({ lockedBy: who });
      return true;
    },

    releaseLock: async (deckId, who) => {
      const cur = get().deck as any;
      if (!cur) return;
      if ((cur.meta?.lockedBy ?? who) !== who) return;
      const mine = { ...cur, meta: { ...cur.meta, lockedBy: null } };
      set({ deck: mine });
      await get().saveToServer(deckId);
      set({ lockedBy: null });
    },
  };
});