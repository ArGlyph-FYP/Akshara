"use client";

import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Loads the next item in the background while the reader works on this one: the page itself and its scan.
 * Returns the function that moves on, so "Next" opens an already-loaded page.
 */
export function useNextItem(next: { href: string; imageSrc: string | null }) {
  const router = useRouter();
  const img = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Wait a moment so the current scan loads first.
    const page = () => router.prefetch(next.href, { kind: "full" as PrefetchKind });
    const t = setTimeout(() => {
      page();
      if (next.imageSrc) {
        img.current = new Image();
        img.current.src = next.imageSrc;
      }
    }, 1500);
    // A preloaded page is kept for 5 minutes; refresh it for readers who take longer.
    const keep = setInterval(page, 4 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(keep);
    };
  }, [router, next.href, next.imageSrc]);

  return () => router.push(next.href);
}
