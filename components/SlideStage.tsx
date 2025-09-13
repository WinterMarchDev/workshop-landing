"use client";
import { useEffect, useMemo, useState } from "react";
import { useDeck } from "@/lib/deck/store";
import { ShapeExport } from "@/lib/deck/types";

export default function SlideStage() {
  const { deck } = useDeck();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { 
        await (document as any).fonts?.ready; 
      } catch {}
      if (mounted) setReady(true);
    })();
    return () => { 
      mounted = false; 
    };
  }, []);

  if (!deck) return null;
  const slide = deck.slides[deck.active];
  
  return (
    <div className="w-full max-w-[1400px] mx-auto">
      <div className="relative w-full aspect-[16/9] rounded-xl bg-[#EDF1F4] shadow-lg overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 will-change-transform origin-center"
          style={{
            width: 1920, 
            height: 1080,
            transform: "translate(-50%,-50%) scale(var(--k))",
            // compute scale with CSS container queries
            // we set --k in parent below
          }}
        >
          {ready && slide.shapes.map(s => <Shape key={s.id} s={s} />)}
        </div>
      </div>
      <style jsx>{`
        .aspect-\\[16\\/9\\] { 
          container-type: size;
          --k: calc(min(100cqw/1920, 100cqh/1080)); 
        }
      `}</style>
    </div>
  );
}

function Shape({ s }: { s: ShapeExport }) {
  const { upsertShape } = useDeck();
  const style = {
    position: "absolute" as const,
    left: s.x, 
    top: s.y, 
    width: s.w, 
    height: s.h,
    transform: s.rotation ? `rotate(${(s.rotation * 180 / Math.PI).toFixed(3)}deg)` : undefined,
    transformOrigin: "center",
  };
  
  if (s.kind === "text") {
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        style={{
          ...style,
          display: "flex", 
          alignItems: "center",
          fontSize: (s as any).fontSize, 
          fontFamily: (s as any).fontFamily ?? "Inter, Calibri, system-ui",
          fontWeight: (s as any).bold ? 700 : 400,
          fontStyle: (s as any).italic ? "italic" : "normal",
          color: (s as any).color ?? "#0B1220",
          textAlign: (s as any).align ?? "left",
          outline: "none",
          padding: "8px",
          userSelect: "text",
          cursor: "text",
        }}
        onBlur={(e) => {
          const newText = e.currentTarget.textContent || "";
          if (newText !== (s as any).text) {
            upsertShape({
              ...s,
              text: newText
            } as any);
          }
        }}
      >
        {(s as any).text}
      </div>
    );
  }
  
  if (s.kind === "rect") {
    return (
      <div 
        style={{ 
          ...style, 
          borderRadius: (s as any).rx ?? 0, 
          background: (s as any).fill ?? "transparent", 
          border: `${(s as any).strokeWidth ?? 2}px solid ${(s as any).stroke ?? "#111"}` 
        }} 
      />
    );
  }
  
  if (s.kind === "line") {
    return (
      <div 
        style={{ 
          ...style, 
          borderTop: `${(s as any).strokeWidth ?? 2}px solid ${(s as any).stroke ?? "#111"}`,
          transformOrigin: "left center",
        }} 
      />
    );
  }
  
  if (s.kind === "image") {
    return (
      <img 
        src={(s as any).url} 
        alt="" 
        draggable={false} 
        style={{ 
          ...style, 
          objectFit: "cover",
          pointerEvents: "none",
        }} 
      />
    );
  }
  
  return null;
}