"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// One colour per criterion (A1–A8, in order), shared by the rating page and the admin responses view.
const PALETTE = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777", "#0d9488"];
export const colorFor = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/** Perception marks: solid blue for parts that look good, dashed near-black for parts that could be better. */
export const MARK_STYLE = {
  good: { color: "#2563eb", dashed: false },
  weak: { color: "#111827", dashed: true },
} as const;

/**
 * Zoomable scan with an SVG overlay. The scan fits the width and sits in the middle of the viewer (or at the top
 * when it is taller than the viewer), so zooming stays centred on the writing; "Fit" returns there.
 * In draw mode, dragging adds a box in normalised (0–1) image coordinates.
 * With `showLabels`, each box gets a small tag (its label, plus a remove button when `onRemove` is given)
 * that stays the same size while zooming. `overlayOpacity` (0–1) fades all boxes; 0 hides them.
 * A box with `hidden` isn't drawn; one with `dim` is drawn faintly (used to bring the selected box forward).
 */
export function ImageAnnotator({
  src,
  boxes = [],
  drawMode = false,
  onDraw,
  selected,
  onSelect,
  heightClass = "h-[calc(100vh-7rem)]",
  showLabels = false,
  onRemove,
  overlayOpacity = 1,
  draftColor = "#1c1917",
  minScale = 0.5,
  fitHeightBelow,
}: {
  src: string;
  boxes?: (Box & { color: string; label?: string; dashed?: boolean; hidden?: boolean; dim?: boolean })[];
  drawMode?: boolean;
  onDraw?: (b: Box) => void;
  selected?: number | null;
  onSelect?: (i: number) => void;
  heightClass?: string;
  showLabels?: boolean;
  onRemove?: (i: number) => void;
  overlayOpacity?: number;
  draftColor?: string;
  minScale?: number;
  /** On screens narrower than this (px), the viewer is only as tall as the scan needs (plus room for the zoom buttons). */
  fitHeightBelow?: number;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const hidden = overlayOpacity <= 0;
  // A cached image can finish loading before hydration, so onLoad never reaches React.
  useEffect(() => {
    if (img.current?.complete) setLoaded(true);
  }, [src]);

  useEffect(() => {
    const el = frame.current;
    if (!fitHeightBelow || !el || !loaded) return;
    const update = () => {
      const im = img.current;
      if (window.innerWidth >= fitHeightBelow || !im?.naturalWidth) return setFitHeight(null);
      const h = (el.clientWidth * im.naturalHeight) / im.naturalWidth + 56;
      setFitHeight(Math.round(Math.min(Math.max(h, 200), window.innerHeight * 0.6)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [fitHeightBelow, loaded]);

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
    <div
      ref={frame}
      className={`relative overflow-hidden rounded-lg border border-line bg-muted ${heightClass}`}
      style={fitHeight ? { height: fitHeight } : undefined}
    >
      <TransformWrapper
        minScale={minScale}
        maxScale={8}
        limitToBounds={false}
        panning={{ disabled: drawMode, excluded: ["annot-tag"] }}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.15 }}
        centerZoomedOut
        onTransform={(_, s) => setScale(s.scale)}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              <span className="rounded-md bg-background/85 px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
                {Math.round(scale * 100)}%
              </span>
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
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!flex !h-full !w-full !flex-nowrap items-center-safe">
              <div
                ref={layer}
                className={`relative w-full select-none ${drawMode ? "cursor-crosshair" : "cursor-grab"}`}
                onPointerDown={(e) => {
                  if (!drawMode) return;
                  e.stopPropagation();
                  e.preventDefault(); // no text selection while dragging out a box
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
                  <g opacity={overlayOpacity}>
                  {boxes.map((b, i) =>
                    b.hidden ? null : (
                    <rect
                      key={i}
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={b.color}
                      opacity={b.dim ? 0.3 : 1}
                      fillOpacity={selected === i ? 0.2 : 0.06}
                      stroke={b.color}
                      strokeWidth={selected === i ? 3.5 : 2}
                      strokeDasharray={b.dashed ? "6 4" : undefined}
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: drawMode || hidden ? "none" : "auto", cursor: "pointer" }}
                      onClick={() => onSelect?.(i)}
                    >
                      {b.label && <title>{b.label}</title>}
                    </rect>
                    ),
                  )}
                  </g>
                  {draft && (
                    <rect
                      x={draft.x}
                      y={draft.y}
                      width={draft.w}
                      height={draft.h}
                      fill={draftColor}
                      fillOpacity={0.08}
                      stroke={draftColor}
                      strokeDasharray="4 3"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
                {showLabels && !hidden && (
                  <div className="pointer-events-none absolute inset-0" style={{ opacity: Math.max(overlayOpacity, 0.5) }}>
                    {boxes.map((b, i) => {
                      if (b.hidden) return null;
                      // Tags sit just above their box, or inside it when the box touches the top edge.
                      const inside = b.y < 0.08;
                      return (
                        <div
                          key={i}
                          className={`annot-tag absolute flex items-stretch overflow-hidden text-[11px] leading-none font-semibold text-white shadow-sm ${
                            inside ? "rounded-br-md" : "rounded-t-md"
                          } ${selected === i ? "ring-2 ring-white" : ""}`}
                          style={{
                            left: `${b.x * 100}%`,
                            top: `${b.y * 100}%`,
                            background: b.color,
                            opacity: b.dim ? 0.45 : 1,
                            transform: `scale(${1 / scale})${inside ? "" : " translateY(-100%)"}`,
                            transformOrigin: "top left",
                            pointerEvents: "auto",
                          }}
                          // Tags stay clickable in draw mode; don't let a press on one start a new box.
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button type="button" className="px-1.5 py-1 whitespace-nowrap" onClick={() => onSelect?.(i)}>
                            {b.label}
                          </button>
                          {onRemove && (
                            <button
                              type="button"
                              aria-label="Remove box"
                              className="border-l border-white/30 px-1 hover:bg-black/25"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemove(i);
                              }}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
