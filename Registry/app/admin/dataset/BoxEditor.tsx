"use client";

import { useRef } from "react";
import type { Box } from "@/lib/form-split";
import { cn } from "@/lib/utils";

type Edge = "n" | "s" | "e" | "w" | "move";

const MIN = 0.02;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function applyDrag(b: Box, edge: Edge, dx: number, dy: number): Box {
  let { x, y, w, h } = b;
  if (edge === "move") {
    x = clamp(x + dx, 0, 1 - w);
    y = clamp(y + dy, 0, 1 - h);
  } else if (edge === "n") {
    const ny = clamp(y + dy, 0, y + h - MIN);
    h += y - ny;
    y = ny;
  } else if (edge === "s") {
    h = clamp(h + dy, MIN, 1 - y);
  } else if (edge === "w") {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w += x - nx;
    x = nx;
  } else {
    w = clamp(w + dx, MIN, 1 - x);
  }
  return { x, y, w, h };
}

const HANDLES: { edge: Exclude<Edge, "move">; className: string }[] = [
  { edge: "n", className: "inset-x-2 -top-1.5 h-3 cursor-ns-resize" },
  { edge: "s", className: "inset-x-2 -bottom-1.5 h-3 cursor-ns-resize" },
  { edge: "w", className: "inset-y-2 -left-1.5 w-3 cursor-ew-resize" },
  { edge: "e", className: "inset-y-2 -right-1.5 w-3 cursor-ew-resize" },
];

/** A page image with boxes that can be moved, and resized by their edges. Boxes are fractions (0–1) of the image. */
export function BoxEditor({
  src,
  aspect,
  boxes,
  labels,
  onChange,
  className,
}: {
  src: string;
  /** width / height of the image */
  aspect: number;
  boxes: Box[];
  labels: string[];
  onChange: (i: number, box: Box) => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; edge: Edge; x: number; y: number; start: Box } | null>(null);

  function down(e: React.PointerEvent, i: number, edge: Edge) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { i, edge, x: e.clientX, y: e.clientY, start: boxes[i] };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const rect = frame.current?.getBoundingClientRect();
    if (!d || !rect) return;
    onChange(d.i, applyDrag(d.start, d.edge, (e.clientX - d.x) / rect.width, (e.clientY - d.y) / rect.height));
  }

  const up = () => {
    drag.current = null;
  };

  return (
    <div ref={frame} className={cn("relative select-none bg-white shadow-sm ring-1 ring-border", className)} style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Scanned page" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      {boxes.map((b, i) => (
        <div
          key={i}
          className="absolute cursor-move border-2 border-primary bg-primary/5 touch-none"
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
          onPointerDown={(e) => down(e, i, "move")}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <span className="pointer-events-none absolute top-0 left-0 rounded-br bg-primary px-1.5 py-0.5 font-mono text-[11px] leading-none text-primary-foreground">
            {labels[i]}
          </span>
          {HANDLES.map((h) => (
            <div
              key={h.edge}
              className={cn("absolute touch-none", h.className)}
              onPointerDown={(e) => down(e, i, h.edge)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shows just one region of an image, scaled up to fill the frame (used for the code box). */
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
