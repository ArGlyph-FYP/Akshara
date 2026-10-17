"use client";

import { Check, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/admin/Confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { act } from "@/lib/client-action";
import type { Participant, Script } from "@/lib/types";
import { issueCodes, purge, registerCode, reinstate, setConsent, setPhase, withdraw } from "./writers-actions";

const day = (t: number | null) => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

export function WritersSheet({
  script,
  writers,
  scanCount,
}: {
  script: Script;
  writers: Participant[];
  scanCount: Record<string, number>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [count, setCount] = useState(10);
  const [phase, setNewPhase] = useState<"main" | "pilot">("main");
  const [code, setCode] = useState("");
  const [consent, setConsentFlag] = useState(true);
  const refresh = () => router.refresh();
  const [confirmDialog, ask] = useConfirm();

  const shown = useMemo(() => {
    const s = q.trim().toUpperCase();
    return writers.filter((w) => !s || w.code.includes(s));
  }, [writers, q]);
  const consented = writers.filter((w) => w.consentReceivedAt && w.status === "active").length;
  const waiting = writers.filter((w) => !w.consentReceivedAt && w.status === "active").length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <UserRound /> Writers
          <span className="text-xs text-muted-foreground tabular-nums">{writers.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-2xl!">
        <SheetHeader className="border-b">
          <SheetTitle>Writers & consent</SheetTitle>
          <SheetDescription>
            Participant codes only. Names stay on the paper consent forms. {consented} consented · {waiting} waiting ·{" "}
            {writers.length - consented - waiting} withdrawn
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-3 border-b p-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-medium">Issue new codes</div>
            <div className="flex items-end gap-2">
              <div className="w-20">
                <Label className="mb-1 text-xs text-muted-foreground">How many</Label>
                <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} />
              </div>
              <PhasePick value={phase} onChange={setNewPhase} />
              <Button
                size="sm"
                className="h-8"
                onClick={async () => (await act(issueCodes, { script, phase, count })) && refresh()}
              >
                <Plus /> Issue
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm font-medium">Register a written code</div>
            <div className="flex items-end gap-2">
              <div className="w-24">
                <Label className="mb-1 text-xs text-muted-foreground">Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={script === "si" ? "SI-001" : "TA-001"} />
              </div>
              <PhasePick value={phase} onChange={setNewPhase} />
              <Button
                size="sm"
                className="h-8"
                disabled={!code.trim()}
                onClick={async () => {
                  if (await act(registerCode, { code, phase, consent: consent ? "on" : undefined })) {
                    setCode("");
                    refresh();
                  }
                }}
              >
                Add
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsentFlag(!!v)} /> Consent form received
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a code" className="h-8 w-48" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="divide-y rounded-lg border">
            {shown.map((w) => (
              <div key={w.code} className={`flex items-center gap-3 px-3 py-2 text-sm ${w.status === "withdrawn" ? "bg-muted/50 text-muted-foreground" : ""}`}>
                <span className="w-20 font-mono font-medium">{w.code}</span>
                <span className="w-12 text-xs text-muted-foreground">{w.phase}</span>
                <span className="w-16 text-xs text-muted-foreground tabular-nums">{scanCount[w.code] ?? 0} {(scanCount[w.code] ?? 0) === 1 ? "scan" : "scans"}</span>
                {w.status === "withdrawn" ? (
                  <Badge variant="destructive">Withdrawn {day(w.withdrawnAt)}</Badge>
                ) : w.consentReceivedAt ? (
                  <Badge variant="secondary" className="bg-success/10 text-success" title={`Checked by ${w.consentVerifiedBy}`}>
                    <Check /> Consent {day(w.consentReceivedAt)}
                  </Badge>
                ) : (
                  <Button variant="outline" size="xs" onClick={async () => (await act(setConsent, { code: w.code, received: "1" }, "Consent recorded")) && refresh()}>
                    Mark consent received
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Actions for ${w.code}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={async () => (await act(setPhase, { code: w.code, phase: w.phase === "main" ? "pilot" : "main" }, "Phase changed")) && refresh()}>
                      Move to {w.phase === "main" ? "pilot" : "main"} phase
                    </DropdownMenuItem>
                    {w.consentReceivedAt && w.status === "active" && (
                      <DropdownMenuItem onSelect={async () => (await act(setConsent, { code: w.code, received: "0" }, "Consent cleared")) && refresh()}>
                        Clear consent date
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {w.status === "active" ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          ask({
                            title: `Withdraw ${w.code}?`,
                            description:
                              "Their scans are excluded from rating and exports right away, and unfinished rating items are removed. You can delete their data afterwards.",
                            confirmLabel: "Withdraw",
                            destructive: true,
                            onConfirm: async () => (await act(withdraw, { code: w.code })) && refresh(),
                          })
                        }
                      >
                        Withdraw…
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onSelect={async () => (await act(reinstate, { code: w.code }, "Reinstated")) && refresh()}>
                          Reinstate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            ask({
                              title: `Delete all data for ${w.code}?`,
                              description: "Permanently deletes their scans and every rating of them. This can't be undone.",
                              confirmLabel: "Delete permanently",
                              destructive: true,
                              onConfirm: async () => (await act(purge, { code: w.code })) && refresh(),
                            })
                          }
                        >
                          Delete data…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {shown.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No writers yet. Issue codes above.</div>}
          </div>
        </div>
      </SheetContent>
      {confirmDialog}
    </Sheet>
  );
}

function PhasePick({ value, onChange }: { value: "main" | "pilot"; onChange: (v: "main" | "pilot") => void }) {
  return (
    <div>
      <Label className="mb-1 text-xs text-muted-foreground">Phase</Label>
      <Select value={value} onValueChange={(v) => onChange(v as "main" | "pilot")}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">Main</SelectItem>
          <SelectItem value="pilot">Pilot</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
