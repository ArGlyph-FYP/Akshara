"use client";

import { Copy, KeyRound, Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addTeamMember, removeTeamMember, resetTeamPassword } from "@/app/admin/team-actions";
import { useConfirm } from "@/components/admin/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface TeamMember {
  uid: string;
  name: string;
  email: string;
  me: boolean;
}

/** Research-team logins for this admin portal. Readers and raters join through study links instead. */
export function TeamSheet({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<{ email: string; password: string } | null>(null);
  const [confirmDialog, ask] = useConfirm();

  async function add() {
    setBusy(true);
    const r = await addTeamMember({ name, email });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setLogin({ email: r.email, password: r.password });
    setName("");
    setEmail("");
    router.refresh();
  }

  async function reset(uid: string) {
    const r = await resetTeamPassword(uid);
    if (!r.ok) return toast.error(r.error);
    setLogin({ email: r.email, password: r.password });
  }

  const details = login ? `Akshara Registry\n${window.location.origin}/login\nEmail: ${login.email}\nPassword: ${login.password}` : "";

  return (
    <Sheet onOpenChange={(o) => !o && setLogin(null)}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <Users /> Team access <span className="ml-auto text-xs tabular-nums">{team.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Team access</SheetTitle>
          <SheetDescription>
            Logins for the research team. Readers and raters don&apos;t need one: they join with a study&apos;s link.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {login && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-brand-soft/40 p-3 text-sm">
              <p className="font-medium">Send these login details to them</p>
              <pre className="rounded-md bg-card p-2 font-mono text-xs whitespace-pre-wrap">{details}</pre>
              <p className="text-xs text-muted-foreground">The password is shown only once.</p>
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(details).catch(() => {});
                  toast.success("Login details copied");
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
          )}

          <ul className="divide-y rounded-lg border">
            {team.map((m) => (
              <li key={m.uid} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.name}
                    {m.me && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`New password for ${m.name}`} title="New password" onClick={() => reset(m.uid)}>
                  <KeyRound />
                </Button>
                {!m.me && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${m.name}`}
                    title="Remove access"
                    onClick={() =>
                      ask({
                        title: `Remove ${m.name}'s access?`,
                        description: "They are signed out and can no longer log in. Their data is kept.",
                        confirmLabel: "Remove access",
                        destructive: true,
                        onConfirm: async () => {
                          const r = await removeTeamMember(m.uid);
                          if (!r.ok) return toast.error(r.error);
                          router.refresh();
                        },
                      })
                    }
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <form
            className="space-y-3 rounded-lg border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <p className="text-sm font-medium">Add a team member</p>
            <div>
              <Label htmlFor="team-name" className="mb-1.5">
                Name
              </Label>
              <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="team-email" className="mb-1.5">
                Email
              </Label>
              <Input id="team-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <Button type="submit" disabled={busy || !name.trim() || !email.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
            </Button>
          </form>
        </div>
        {confirmDialog}
      </SheetContent>
    </Sheet>
  );
}
