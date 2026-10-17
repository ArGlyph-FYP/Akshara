"use client";

import { Copy, KeyRound, MoreHorizontal, Pencil, RefreshCw, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/Confirm";
import { EmptyState, PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCRIPT_LABEL, type Script } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createRater, resetPassword, updateRater } from "./actions";

export interface RaterRow {
  uid: string;
  name: string;
  email: string;
  alias: string;
  role: "admin" | "rater";
  scripts: Script[];
  active: boolean;
  done: number;
  total: number;
  studies: number;
  public: boolean;
  nativeReader: boolean | null;
  ageGroup: string | null;
}

interface Form {
  uid?: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "rater";
  scripts: Script[];
  active: boolean;
}

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newPassword() {
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => CHARS[x % CHARS.length]).join("");
}

function credentialsText(email: string, password: string) {
  return `Hi! Your Akshara rating account is ready.

Log in: ${window.location.origin}/login
Email: ${email}
Password: ${password}

You can change the password with “Forgot password?” on the login page.`;
}

export function RatersView({ rows, script, selfUid }: { rows: RaterRow[]; script: Script; selfUid: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [creds, setCreds] = useState<{ email: string; password: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyScript, setOnlyScript] = useState(true);
  const [showPublic, setShowPublic] = useState(true);
  const [confirmDialog, ask] = useConfirm();

  const shown = rows.filter((r) => (!onlyScript || r.scripts.includes(script) || r.role === "admin") && (showPublic || !r.public));
  const publicCount = rows.filter((r) => r.public && (!onlyScript || r.scripts.includes(script))).length;

  async function save() {
    if (!form) return;
    setBusy(true);
    if (form.uid) {
      const r = await updateRater(form.uid, form);
      setBusy(false);
      if (!r.ok) return toast.error(r.error);
      toast.success("Saved");
      setForm(null);
    } else {
      const r = await createRater(form);
      setBusy(false);
      if (!r.ok) return toast.error(r.error);
      setForm(null);
      setCreds({ email: r.email, password: r.password, title: `Account created for ${form.name}` });
    }
    router.refresh();
  }

  async function reset(row: RaterRow) {
    const r = await resetPassword(row.uid);
    if (!r.ok) return toast.error(r.error);
    setCreds({ email: r.email, password: r.password, title: `New password for ${row.name}` });
  }

  return (
    <div>
      <PageHeader
        title="Raters"
        description="Create logins for raters and survey readers, then send them the login details yourself (WhatsApp, email…). Raters only see the studies assigned to them, never participant codes."
      >
        <Button
          onClick={() => setForm({ name: "", email: "", password: newPassword(), role: "rater", scripts: [script], active: true })}
        >
          <UserPlus /> Create rater
        </Button>
      </PageHeader>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={onlyScript} onCheckedChange={(v) => setOnlyScript(!!v)} />
          Only {SCRIPT_LABEL[script]} raters (and admins)
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={showPublic} onCheckedChange={(v) => setShowPublic(!!v)} />
          Include readers who joined via a public link ({publicCount})
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{shown.length} people</span>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="No raters yet">
          Create an account, then copy the login details and send them to the rater.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[1fr_120px_140px_180px_40px] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Name</span>
            <span>Role</span>
            <span>Scripts</span>
            <span>Progress</span>
            <span />
          </div>
          <div className="divide-y">
            {shown.map((r) => (
              <div key={r.uid} className={cn("grid grid-cols-[1fr_40px] items-center gap-4 px-4 py-3 text-sm md:grid-cols-[1fr_120px_140px_180px_40px]", !r.active && "opacity-55")}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">{r.name.slice(0, 2)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate font-medium">
                      {r.name}
                      <span className="font-mono text-xs font-normal text-muted-foreground">{r.alias}</span>
                      {!r.active && <Badge variant="outline">disabled</Badge>}
                      {r.public && <Badge variant="outline" className="font-normal">via link</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.email || (r.public ? "no contact given" : "")}
                      {r.public && r.ageGroup && ` · ${r.ageGroup}`}
                      {r.public && r.nativeReader !== null && ` · ${r.nativeReader ? "first-language reader" : "not first language"}`}
                    </div>
                  </div>
                </div>
                <div className="hidden md:block">
                  <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role === "admin" ? "Admin" : "Rater"}</Badge>
                </div>
                <div className="hidden gap-1 md:flex">
                  {r.scripts.map((s) => (
                    <Badge key={s} variant="outline" className="font-normal">
                      {SCRIPT_LABEL[s]}
                    </Badge>
                  ))}
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  {r.total ? (
                    <>
                      <Progress value={(100 * r.done) / r.total} />
                      <span className="w-16 text-right text-xs tabular-nums">
                        {r.done}/{r.total}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nothing assigned</span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setForm({ uid: r.uid, name: r.name, email: r.email, password: "", role: r.role, scripts: r.scripts, active: r.active })}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    {!r.public && (
                    <DropdownMenuItem
                      onSelect={() =>
                        ask({
                          title: `Reset ${r.name}'s password?`,
                          description: "Their current password stops working. You'll get a new one to send them.",
                          confirmLabel: "Reset password",
                          onConfirm: () => reset(r),
                        })
                      }
                    >
                      <KeyRound /> Reset password
                    </DropdownMenuItem>
                    )}
                    {r.uid !== selfUid && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant={r.active ? "destructive" : "default"}
                          onSelect={async () => {
                            const res = await updateRater(r.uid, { ...r, active: !r.active });
                            if (!res.ok) return toast.error(res.error);
                            toast.success(r.active ? `${r.name} can no longer sign in` : `${r.name} re-enabled`);
                            router.refresh();
                          }}
                        >
                          {r.active ? "Disable account" : "Enable account"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && !busy && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.uid ? "Edit rater" : "Create rater"}</DialogTitle>
            <DialogDescription>
              {form?.uid ? "Change name, role or scripts." : "You'll get the login details to copy after saving."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus />
              </div>
              <div>
                <Label className="mb-1.5">Email</Label>
                <Input type="email" value={form.email} disabled={!!form.uid} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {!form.uid && (
                <div>
                  <Label className="mb-1.5">Password</Label>
                  <div className="flex gap-2">
                    <Input className="font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Button variant="outline" size="icon" onClick={() => setForm({ ...form, password: newPassword() })} aria-label="New password" title="Generate another">
                      <RefreshCw />
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Form["role"] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rater">Rater</SelectItem>
                      <SelectItem value="admin">Admin (research team)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5">Rates</Label>
                  <div className="flex h-8 items-center gap-3 text-sm">
                    {(["si", "ta"] as const).map((s) => (
                      <label key={s} className="flex items-center gap-1.5">
                        <Checkbox
                          checked={form.scripts.includes(s)}
                          onCheckedChange={(v) => setForm({ ...form, scripts: v ? [...form.scripts, s] : form.scripts.filter((x) => x !== s) })}
                        />
                        {SCRIPT_LABEL[s]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {form?.uid ? "Save" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creds?.title}</DialogTitle>
            <DialogDescription>Copy this and send it to them. The password is shown only now.</DialogDescription>
          </DialogHeader>
          {creds && (
            <pre className="rounded-lg border bg-muted/50 p-3 text-sm whitespace-pre-wrap">{credentialsText(creds.email, creds.password)}</pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreds(null)}>
              Done
            </Button>
            <Button
              onClick={async () => {
                if (!creds) return;
                await navigator.clipboard.writeText(credentialsText(creds.email, creds.password));
                toast.success("Login details copied");
              }}
            >
              <Copy /> Copy login details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
