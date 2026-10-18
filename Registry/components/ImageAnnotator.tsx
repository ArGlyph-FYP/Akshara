"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PALETTE = ["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777"];
export const colorFor = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/** Perception marks: solid blue for parts that look good, dashed near-black for parts that could be better. */
export const MARK_STYLE = {
  good: { color: "#2563eb", dashed: false },
  weak: { color: "#111827", dashed: true },
} as const;

/**
 * Zoomable scan with an SVG overlay, starting fit-to-width at the top of the page ("Fit" returns there).
 * In draw mode, dragging adds a box in normalised (0–1) image coordinates.
 */
export function ImageAnnotator({
  src,
  boxes = [],
  drawMode = false,
  onDraw,
  selected,
  onSelect,
  heightClass = "h-[calc(100vh-7rem)]",
}: {
  src: string;
  boxes?: (Box & { color: string; label?: string; dashed?: boolean })[];
  drawMode?: boolean;
  onDraw?: (b: Box) => void;
  selected?: number | null;
  onSelect?: (i: number) => void;
  heightClass?: string;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [loaded, setLoaded] = useState(false);
  // A cached image can finish loading before hydration, so onLoad never reaches React.
  useEffect(() => {
    if (img.current?.complete) setLoaded(true);
  }, [src]);

  const point = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const boxFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  return (
    <div className={`relative overflow-hidden rounded-lg border border-line bg-muted ${heightClass}`}>
      <TransformWrapper
        minScale={0.5}
        maxScale={8}
        limitToBounds={false}
        panning={{ disabled: drawMode }}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.15 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomIn()}>
                <ZoomIn />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => zoomOut()}>
                <ZoomOut />
              </Button>
              <Button variant="outline" size="sm" onClick={() => resetTransform()}>
                Fit
              </Button>
            </div>
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full">
              <div
                ref={layer}
                className={`relative w-full select-none ${drawMode ? "cursor-crosshair" : "cursor-grab"}`}
                onPointerDown={(e) => {
                  if (!drawMode) return;
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  const p = point(e);
                  setStart(p);
                  setDraft({ ...p, w: 0, h: 0 });
                }}
                onPointerMove={(e) => {
                  if (!drawMode || !start) return;
                  setDraft(boxFrom(start, point(e)));
                }}
                onPointerUp={(e) => {
                  if (!drawMode || !start) return;
                  const b = boxFrom(start, point(e));
                  setStart(null);
                  setDraft(null);
                  if (b.w > 0.004 && b.h > 0.004) onDraw?.(b);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={img} src={src} alt="Handwriting sample" draggable={false} className="block w-full" onLoad={() => setLoaded(true)} />
                {!loaded && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading scan…</div>}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                  {boxes.map((b, i) => (
                    <rect
                      key={i}
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={b.color}
                      fillOpacity={selected === i ? 0.22 : 0.1}
                      stroke={b.color}
                      strokeWidth={selected === i ? 3 : 2}
                      strokeDasharray={b.dashed ? "6 4" : undefined}
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: drawMode ? "none" : "auto", cursor: "pointer" }}
                      onClick={() => onSelect?.(i)}
                    >
                      {b.label && <title>{b.label}</title>}
                    </rect>
                  ))}
                  {draft && (
                    <rect
                      x={draft.x}
                      y={draft.y}
                      width={draft.w}
                      height={draft.h}
                      fill="none"
                      stroke="#1c1917"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
