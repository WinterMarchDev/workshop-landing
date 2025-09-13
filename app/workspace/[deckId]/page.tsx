"use client";

import SlideStage from "@/components/SlideStage";
import { useEffect } from "react";
import { useDeck } from "@/lib/deck/store";
import type { DeckExport, SlideExport, ShapeExport } from "@/lib/deck/types";

export default function Page({ params }: { params: { deckId: string } }) {
  const { deck, setDeck, loadFromServer, saveToServer, setActive } = useDeck();

  useEffect(() => {
    (async () => {
      await loadFromServer(params.deckId);
      // If no deck exists, import from HTML
      if (!useDeck.getState().deck) {
        try {
          const html = await fetch("/vendor-advance-slides.txt").then(r => r.text());
          const parsed = parseHtmlIntoDeck(html);
          setDeck(parsed);
          await saveToServer(params.deckId);
        } catch (err) {
          console.error("Failed to import slides:", err);
          // Create empty deck as fallback
          setDeck({
            width: 1920,
            height: 1080,
            slides: [{
              id: crypto.randomUUID(),
              shapes: []
            }],
            active: 0
          });
        }
      }
    })();
  }, [params.deckId, loadFromServer, saveToServer, setDeck]);

  if (!deck) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading deck...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="px-6 py-4 space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-lg">Slide Editor</h1>
            <div className="text-sm text-gray-600">
              Slide {deck.active + 1} of {deck.slides.length}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActive(Math.max(0, deck.active - 1))} 
              disabled={deck.active === 0}
              className="rounded-lg px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <button 
              onClick={() => setActive(Math.min(deck.slides.length - 1, deck.active + 1))} 
              disabled={deck.active === deck.slides.length - 1}
              className="rounded-lg px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Slide Stage */}
        <SlideStage />

        {/* Slide Thumbnails */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {deck.slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setActive(idx)}
                className={`relative flex-shrink-0 w-32 h-18 rounded border-2 transition-all ${
                  idx === deck.active 
                    ? 'border-blue-500 shadow-md' 
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="absolute inset-0 bg-gray-100 rounded flex items-center justify-center text-sm font-medium">
                  {idx + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseHtmlIntoDeck(html: string): DeckExport {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const slides: SlideExport[] = [];
  const slideElements = dom.querySelectorAll(".slide");
  
  if (slideElements.length === 0) {
    console.warn("No slides found in HTML");
    return {
      width: 1920,
      height: 1080,
      slides: [{ id: crypto.randomUUID(), shapes: [] }],
      active: 0
    };
  }

  slideElements.forEach((slideEl, slideIdx) => {
    const shapes: ShapeExport[] = [];
    let z = 1;
    let yOffset = 100;

    // Process all text elements in the slide
    slideEl.querySelectorAll("h1, h2, h3, p, li, hr, img, div.subtitle").forEach((element) => {
      if (element.tagName === "IMG") {
        const img = element as HTMLImageElement;
        shapes.push({
          id: crypto.randomUUID(),
          kind: "image",
          z: z++,
          x: 160,
          y: yOffset,
          w: 1600,
          h: 800,
          url: img.src
        });
        yOffset += 850;
      } else if (element.tagName === "HR") {
        shapes.push({
          id: crypto.randomUUID(),
          kind: "line",
          z: z++,
          x: 160,
          y: yOffset,
          w: 1600,
          h: 2,
          x2: 1760,
          y2: yOffset,
          stroke: "#333333",
          strokeWidth: 2
        });
        yOffset += 40;
      } else {
        const text = element.textContent?.trim() || "";
        if (!text) return;

        // Determine font size based on element type
        let fontSize = 24;
        let bold = false;
        let color = "#0B1220";
        
        if (element.tagName === "H1") {
          fontSize = 48;
          bold = true;
        } else if (element.tagName === "H2") {
          fontSize = 36;
          bold = true;
        } else if (element.tagName === "H3") {
          fontSize = 28;
          bold = true;
        } else if (element.classList.contains("subtitle")) {
          fontSize = 22;
          color = "#666666";
        } else if (element.tagName === "LI") {
          fontSize = 24;
        }

        // Calculate height based on text length and font size
        const estimatedLines = Math.ceil(text.length / 80);
        const height = Math.max(60, estimatedLines * (fontSize + 10));

        shapes.push({
          id: crypto.randomUUID(),
          kind: "text",
          z: z++,
          x: element.tagName === "LI" ? 200 : 160,
          y: yOffset,
          w: 1600,
          h: height,
          text: element.tagName === "LI" ? `• ${text}` : text,
          fontSize,
          align: element.tagName === "H1" || element.tagName === "H2" ? "center" : "left",
          color,
          fontFamily: "Inter, Calibri, system-ui",
          bold,
          italic: false
        });
        
        yOffset += height + 20;
      }
    });

    slides.push({
      id: `slide-${slideIdx}`,
      shapes
    });
  });

  console.log(`Parsed ${slides.length} slides from HTML`);
  return { 
    width: 1920, 
    height: 1080, 
    slides, 
    active: 0 
  };
}