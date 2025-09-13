export type DeckExport = {
  width: number; 
  height: number;
  slides: SlideExport[];
  active: number;
};

export type SlideExport = { 
  id: string; 
  shapes: ShapeExport[]; 
  bg?: string;
};

export type Base = { 
  id: string; 
  x: number; 
  y: number; 
  w: number; 
  h: number; 
  z: number; 
  rotation?: number;
};

export type TextShape = Base & { 
  kind: "text"; 
  text: string; 
  fontSize: number; 
  align?: "left" | "center" | "right"; 
  color?: string; 
  fontFamily?: string; 
  bold?: boolean; 
  italic?: boolean;
};

export type RectShape = Base & { 
  kind: "rect"; 
  rx?: number; 
  fill?: string; 
  stroke?: string; 
  strokeWidth?: number;
};

export type LineShape = Base & { 
  kind: "line"; 
  x2: number; 
  y2: number; 
  stroke?: string; 
  strokeWidth?: number;
};

export type ImageShape = Base & { 
  kind: "image"; 
  url: string;
};

export type ShapeExport = TextShape | RectShape | LineShape | ImageShape;