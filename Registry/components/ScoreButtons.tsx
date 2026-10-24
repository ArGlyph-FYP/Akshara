"use client";

import type { Scale } from "@/lib/types";

export function ScoreButtons({
  scale,
  value,
  onChange,
  lowLabel,
  highLabel,
  compact = false,
}: {
  scale: Scale;
  value: number | null;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
  /** Tighter buttons, e.g. for ten 1–10 buttons on a phone. */
  compact?: boolean;
}) {
  const values = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  return (
    <div className="mt-1.5">
      <div className={`flex ${compact ? "gap-0.5" : "gap-1"}`} role="radiogroup">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`${compact ? "h-8 min-w-0 text-[13px]" : "h-9 text-sm"} flex-1 rounded-md border font-medium tabular-nums transition ${
              value === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
