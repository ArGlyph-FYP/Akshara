"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { requestMoreBatch } from "../actions";

export function MoreButton(props: { studyId: string; label: string; fullText: string; closedText: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        className="h-10 w-full"
        disabled={busy || !!message}
        onClick={async () => {
          setBusy(true);
          const r = await requestMoreBatch(props.studyId);
          if (r.next) return router.push(r.next);
          setBusy(false);
          setMessage(r.error === "full" ? props.fullText : r.error === "closed" ? props.closedText : (r.error ?? ""));
        }}
      >
        {busy && <Loader2 className="animate-spin" />} {props.label}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
