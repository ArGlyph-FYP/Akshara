"use client";

import { useRef } from "react";
import type { Box } from "@/lib/form-split";
import { cn } from "@/lib/utils";

/** Which sides a drag moves: any of n/s/e/w (corners combine two), or the whole box. */
type Grip = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN = 0.02;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function applyDrag(b: Box, grip: Grip, dx: number, dy: number): Box {
  let { x, y, w, h } = b;
  if (grip === "move") {
    return { x: clamp(x + dx, 0, 1 - w), y: clamp(y + dy, 0, 1 - h), w, h };
  }
  if (grip.includes("n")) {
    const ny = clamp(y + dy, 0, y + h - MIN);
    h += y - ny;
    y = ny;
  }
  if (grip.includes("s")) h = clamp(h + dy, MIN, 1 - y);
  if (grip.includes("w")) {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w += x - nx;
    x = nx;
  }
  if (grip.includes("e")) w = clamp(w + dx, MIN, 1 - x);
  return { x, y, w, h };
}

const EDGES: { grip: Grip; className: string }[] = [
  { grip: "n", className: "inset-x-3 -top-1.5 h-3 cursor-ns-resize" },
  { grip: "s", className: "inset-x-3 -bottom-1.5 h-3 cursor-ns-resize" },
  { grip: "w", className: "inset-y-3 -left-1.5 w-3 cursor-ew-resize" },
  { grip: "e", className: "inset-y-3 -right-1.5 w-3 cursor-ew-resize" },
];
const CORNERS: { grip: Grip; className: string }[] = [
  { grip: "nw", className: "-top-1.5 -left-1.5 cursor-nwse-resize" },
  { grip: "ne", className: "-top-1.5 -right-1.5 cursor-nesw-resize" },
  { grip: "sw", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { grip: "se", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
];

type Drag = { i: number; grip: Grip; x: number; y: number; start: Box } | { i: number; draw: true; fx: number; fy: number };

/**
 * A page image with boxes (fractions 0–1 of the image). Drag a box to move it, its edges or corners to resize,
 * or drag on the page to draw the selected box again from scratch.
 */
export function BoxEditor({
  src,
  aspect,
  boxes,
  labels,
  onChange,
  selected = 0,
  onSelect,
  className,
}: {
  src: string;
  /** width / height of the image */
  aspect: number;
  boxes: Box[];
  labels: string[];
  onChange: (i: number, box: Box) => void;
  /** The box that a drag on the page redraws. */
  selected?: number;
  onSelect?: (i: number) => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const point = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { fx: clamp((e.clientX - r.left) / r.width, 0, 1), fy: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };

  function grab(e: React.PointerEvent, i: number, grip: Grip) {
    e.preventDefault();
    e.stopPropagation();
    frame.current?.setPointerCapture(e.pointerId);
    onSelect?.(i);
    drag.current = { i, grip, x: e.clientX, y: e.clientY, start: boxes[i] };
  }

  function startDraw(e: React.PointerEvent) {
    if (e.button !== 0 || !frame.current) return;
    e.preventDefault();
    frame.current.setPointerCapture(e.pointerId);
    drag.current = { i: selected, draw: true, ...point(e) };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const rect = frame.current?.getBoundingClientRect();
    if (!d || !rect) return;
    if ("draw" in d) {
      const { fx, fy } = point(e);
      const w = Math.abs(fx - d.fx);
      const h = Math.abs(fy - d.fy);
      // Ignore a plain click: only a real drag replaces the box.
      if (w < MIN && h < MIN) return;
      onChange(d.i, { x: Math.min(fx, d.fx), y: Math.min(fy, d.fy), w: Math.max(w, MIN), h: Math.max(h, MIN) });
    } else {
      onChange(d.i, applyDrag(d.start, d.grip, (e.clientX - d.x) / rect.width, (e.clientY - d.y) / rect.height));
    }
  }

  const up = () => {
    drag.current = null;
  };

  return (
    <div
      ref={frame}
      className={cn("relative cursor-crosshair touch-none select-none bg-white shadow-sm ring-1 ring-border", className)}
      style={{ aspectRatio: aspect }}
      onPointerDown={startDraw}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Scanned page" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      {boxes.map((b, i) => {
        const on = i === selected;
        return (
          <div
            key={i}
            className={cn(
              "absolute cursor-move border-2",
              on ? "z-10 border-primary bg-primary/10" : "border-dashed border-primary/50 bg-primary/5",
            )}
            style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
            onPointerDown={(e) => grab(e, i, "move")}
          >
            <span
              className={cn(
                "pointer-events-none absolute top-0 left-0 rounded-br px-1.5 py-0.5 font-mono text-[11px] leading-none",
                on ? "bg-primary text-primary-foreground" : "bg-primary/60 text-primary-foreground",
              )}
            >
              {labels[i]}
            </span>
            {EDGES.map((h) => (
              <div key={h.grip} className={cn("absolute", h.className)} onPointerDown={(e) => grab(e, i, h.grip)} />
            ))}
            {on &&
              CORNERS.map((h) => (
                <div
                  key={h.grip}
                  className={cn("absolute size-3 rounded-sm border-2 border-primary bg-white", h.className)}
                  onPointerDown={(e) => grab(e, i, h.grip)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** Shows just one region of an image, scaled up to fill the frame (used for the code box and crop previews). */
export function ZoomRegion({ src, box, aspect, className }: { src: string; box: Box; aspect: number; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-white ring-1 ring-border", className)} style={{ aspectRatio: (box.w * aspect) / box.h }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Code box"
        draggable={false}
        className="absolute max-w-none"
        style={{ width: `${100 / box.w}%`, height: `${100 / box.h}%`, left: `${(-box.x / box.w) * 100}%`, top: `${(-box.y / box.h) * 100}%` }}
      />
    </div>
  );
}
