"use client";

import type { Scale } from "@/lib/types";

export function ScoreButtons({
  scale,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  scale: Scale;
  value: number | null;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
}) {
  const values = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1" role="radiogroup">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-9 flex-1 rounded-md border text-sm font-medium transition ${
              value === v ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary/50"
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
